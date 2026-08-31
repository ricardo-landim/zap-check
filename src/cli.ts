#!/usr/bin/env bun
/**
 * zap-check CLI.
 *
 *   ZAPCHECK_URL=... ZAPCHECK_TOKEN=... bun src/cli.ts +15551234567 +15557654321
 *
 * Output: one line per number, "<number>\t<yes|no>". Exit 0 on success,
 * 1 on any error, 2 on usage error. Numbers never appear in error output.
 */
import { createVerifier } from "./index";
import { configFromEnv } from "./config";

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.error("usage: zap-check <number> [number...]   (env: see .env.example)");
    return 2;
  }
  if (args[0] === "--health") {
    const cfg = configFromEnv();
    const ok = await cfg.provider.health();
    console.log(ok ? "healthy" : "unhealthy");
    return ok ? 0 : 1;
  }

  const cfg = configFromEnv();
  const verifier = createVerifier(cfg);
  const results = await verifier.verify(args);
  for (const r of results) {
    console.log(`${r.number}\t${r.exists ? "yes" : "no"}`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: Error) => {
    // Keep numbers out of stderr: print only the error class/message we control.
    console.error(`zap-check: ${err.message}`);
    process.exit(1);
  });
