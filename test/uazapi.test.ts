import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { uazapiProvider } from "../src/providers/uazapi";

/**
 * A local fake that imitates the UAZAPI verification endpoint, including the
 * field-name variations seen across builds. No network leaves the machine.
 */
let server: Server;
let url = "";
let lastToken = "";
let mode: "array" | "wrapped" | "altfields" | "broken" = "array";

beforeAll(async () => {
  server = createServer(async (req, res) => {
    lastToken = String(req.headers.token ?? "");
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const { numbers } = JSON.parse(Buffer.concat(chunks).toString() || "{}") as { numbers: string[] };
    const items = (numbers ?? []).map((n, i) => {
      const digits = n.replace(/\D/g, "");
      if (mode === "altfields") return { number: n, isValid: i % 2 === 0, id: `${digits}@s.net` };
      return { query: n, isInWhatsapp: i % 2 === 0, jid: `${digits}@s.net` };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    if (mode === "wrapped") return res.end(JSON.stringify({ results: items }));
    if (mode === "broken") return res.end(JSON.stringify({ nope: true }));
    res.end(JSON.stringify(items));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (addr && typeof addr === "object") url = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server.close());

describe("uazapiProvider", () => {
  test("sends the token header and maps the plain-array shape", async () => {
    mode = "array";
    const p = uazapiProvider({ url, token: "test-token-value" });
    const out = await p.check(["+15551230001", "+15551230002"]);
    expect(lastToken).toBe("test-token-value");
    expect(out).toEqual([
      { number: "+15551230001", exists: true, id: "15551230001@s.net" },
      { number: "+15551230002", exists: false, id: "15551230002@s.net" },
    ]);
  });

  test("maps the {results: [...]} wrapped shape", async () => {
    mode = "wrapped";
    const p = uazapiProvider({ url, token: "t" });
    const out = await p.check(["+15551230001"]);
    expect(out[0].exists).toBe(true);
  });

  test("maps alternative field names (number/isValid/id)", async () => {
    mode = "altfields";
    const p = uazapiProvider({ url, token: "t" });
    const out = await p.check(["+15551230001"]);
    expect(out[0]).toEqual({ number: "+15551230001", exists: true, id: "15551230001@s.net" });
  });

  test("an unexpected payload is an explicit error", async () => {
    mode = "broken";
    const p = uazapiProvider({ url, token: "t" });
    await expect(p.check(["+15551230001"])).rejects.toThrow(/unexpected payload/);
  });

  test("health is true against a live instance and false against a dead one", async () => {
    mode = "array";
    expect(await uazapiProvider({ url, token: "t" }).health()).toBe(true);
    expect(await uazapiProvider({ url: "http://127.0.0.1:1", token: "t", timeoutMs: 500 }).health()).toBe(false);
  });
});
