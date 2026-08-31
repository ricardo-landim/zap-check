#!/usr/bin/env bun
/**
 * zap-check HTTP micro-service (optional deployment mode).
 *
 *   POST /verify {"numbers": ["+15551234567"]}  ->  {"results": [{number, exists, id?}]}
 *   GET  /health                                ->  {"ok": true|false}
 *
 * Built on node:http so it runs under Bun and Node alike. If
 * ZAPCHECK_ACCESS_TOKEN is set, every request must send
 * "authorization: Bearer <token>". Numbers are never logged.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createVerifier } from "./index";
import { configFromEnv } from "./config";

const MAX_BODY = 64 * 1024;
const MAX_NUMBERS = 500;

export interface ServerDeps {
  verifier: { verify(numbers: string[]): Promise<unknown[]>; health(): Promise<boolean> };
  accessToken?: string;
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** The request handler, separated from listen() so tests can mount it. */
export function makeHandler(deps: ServerDeps) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (deps.accessToken) {
        const auth = req.headers.authorization ?? "";
        if (auth !== `Bearer ${deps.accessToken}`) return send(res, 401, { error: "unauthorized" });
      }

      if (req.method === "GET" && req.url === "/health") {
        return send(res, 200, { ok: await deps.verifier.health() });
      }

      if (req.method === "POST" && req.url === "/verify") {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += (chunk as Buffer).length;
          if (size > MAX_BODY) return send(res, 413, { error: "body too large" });
          chunks.push(chunk as Buffer);
        }
        let numbers: unknown;
        try {
          numbers = (JSON.parse(Buffer.concat(chunks).toString("utf8")) as { numbers?: unknown }).numbers;
        } catch {
          return send(res, 400, { error: "invalid JSON" });
        }
        if (!Array.isArray(numbers) || numbers.length === 0 || !numbers.every((n) => typeof n === "string")) {
          return send(res, 400, { error: 'expected {"numbers": ["+1555..."]}' });
        }
        if (numbers.length > MAX_NUMBERS) {
          return send(res, 400, { error: `too many numbers (max ${MAX_NUMBERS})` });
        }
        const results = await deps.verifier.verify(numbers as string[]);
        return send(res, 200, { results });
      }

      return send(res, 404, { error: "not found" });
    } catch (err) {
      // Never echo request content back: numbers must not leak into logs or errors.
      return send(res, 500, { error: (err as Error).message });
    }
  };
}

if (import.meta.main) {
  const port = Number.parseInt(process.env.ZAPCHECK_PORT ?? "8377", 10);
  const access = process.env.ZAPCHECK_ACCESS_TOKEN ?? "";
  const verifier = createVerifier(configFromEnv());
  createServer(makeHandler({ verifier, accessToken: access || undefined })).listen(port, () => {
    console.log(`zap-check server listening on :${port} (auth: ${access ? "bearer token" : "open"})`);
  });
}
