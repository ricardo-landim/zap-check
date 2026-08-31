/**
 * Environment wiring shared by the CLI and the server.
 * Secrets come from env only: never argv, never files inside the repo.
 */
import type { Provider } from "./index";
import { uazapiProvider } from "./providers/uazapi";

export interface EnvConfig {
  provider: Provider;
  batchSize: number;
  intervalMs: number;
  cacheTtlMs: number;
}

function intEnv(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function providerFromEnv(): Provider {
  const kind = (process.env.ZAPCHECK_PROVIDER ?? "uazapi").toLowerCase();
  switch (kind) {
    case "uazapi": {
      const url = process.env.ZAPCHECK_URL;
      const token = process.env.ZAPCHECK_TOKEN;
      if (!url || !token) {
        throw new Error("set ZAPCHECK_URL and ZAPCHECK_TOKEN (see .env.example)");
      }
      return uazapiProvider({ url, token });
    }
    default:
      throw new Error(`unknown ZAPCHECK_PROVIDER: ${kind}`);
  }
}

export function configFromEnv(): EnvConfig {
  return {
    provider: providerFromEnv(),
    batchSize: intEnv("ZAPCHECK_BATCH_SIZE", 20),
    intervalMs: intEnv("ZAPCHECK_INTERVAL_MS", 1000),
    cacheTtlMs: intEnv("ZAPCHECK_CACHE_TTL_MS", 0),
  };
}
