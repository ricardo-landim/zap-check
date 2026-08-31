import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { makeHandler } from "../src/server";

let server: Server;
let url = "";

const fakeVerifier = {
  async verify(numbers: string[]) {
    return numbers.map((number) => ({ number, exists: true }));
  },
  async health() {
    return true;
  },
};

beforeAll(async () => {
  server = createServer(makeHandler({ verifier: fakeVerifier, accessToken: "sesame" }));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (addr && typeof addr === "object") url = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server.close());

const auth = { authorization: "Bearer sesame" };

describe("zap-check server", () => {
  test("rejects a missing or wrong bearer token", async () => {
    expect((await fetch(`${url}/health`)).status).toBe(401);
    expect((await fetch(`${url}/health`, { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });

  test("GET /health answers with the verifier's health", async () => {
    const res = await fetch(`${url}/health`, { headers: auth });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("POST /verify round-trips numbers", async () => {
    const res = await fetch(`${url}/verify`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ numbers: ["+15551230001"] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ number: "+15551230001", exists: true }] });
  });

  test("bad payloads are 400, unknown routes are 404", async () => {
    const bad = await fetch(`${url}/verify`, { method: "POST", headers: auth, body: "not json" });
    expect(bad.status).toBe(400);
    const empty = await fetch(`${url}/verify`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ numbers: [] }),
    });
    expect(empty.status).toBe(400);
    expect((await fetch(`${url}/nope`, { headers: auth })).status).toBe(404);
  });
});
