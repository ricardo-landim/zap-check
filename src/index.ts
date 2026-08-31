/**
 * zap-check: WhatsApp number verification with pluggable providers.
 *
 * The core idea: keep the number that VERIFIES (a disposable account on a
 * third-party provider) fully isolated from the number that MATTERS (your
 * official WhatsApp Cloud API sender). Verification never touches the latter.
 */

export interface CheckResult {
  /** The number as it was queried (normalized to digits + leading "+" kept if given). */
  number: string;
  /** Whether the number has an active WhatsApp account. */
  exists: boolean;
  /** Provider-side id (JID) when available. */
  id?: string;
}

export interface Provider {
  /** Short provider name, e.g. "uazapi". */
  name: string;
  /** Check a batch of numbers. Implementations must never log the numbers. */
  check(numbers: string[]): Promise<CheckResult[]>;
  /** True when the provider instance is reachable and authenticated. */
  health(): Promise<boolean>;
}

export interface VerifierOptions {
  provider: Provider;
  /** Max numbers per provider call. Default 20. */
  batchSize?: number;
  /** Pause between batches, in ms. Protects the verifying account. Default 1000. */
  intervalMs?: number;
  /** Cache TTL in ms for repeated checks. 0 disables the cache. Default 0. */
  cacheTtlMs?: number;
}

interface CacheEntry {
  result: CheckResult;
  at: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Keep digits, preserve a single leading "+". Throws on garbage input. */
export function normalizeNumber(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error(`invalid phone number length: ${digits.length} digits`);
  }
  return plus + digits;
}

export function createVerifier(opts: VerifierOptions) {
  const batchSize = Math.max(1, opts.batchSize ?? 20);
  const intervalMs = Math.max(0, opts.intervalMs ?? 1000);
  const cacheTtlMs = Math.max(0, opts.cacheTtlMs ?? 0);
  const cache = new Map<string, CacheEntry>();

  async function verify(numbers: string[]): Promise<CheckResult[]> {
    const normalized = numbers.map(normalizeNumber);
    const out = new Map<string, CheckResult>();
    const misses: string[] = [];

    const now = Date.now();
    for (const n of normalized) {
      const hit = cacheTtlMs > 0 ? cache.get(n) : undefined;
      if (hit && now - hit.at < cacheTtlMs) {
        out.set(n, hit.result);
      } else if (!out.has(n) && !misses.includes(n)) {
        misses.push(n);
      }
    }

    for (let i = 0; i < misses.length; i += batchSize) {
      if (i > 0 && intervalMs > 0) await sleep(intervalMs);
      const batch = misses.slice(i, i + batchSize);
      const results = await opts.provider.check(batch);
      for (const r of results) {
        out.set(r.number, r);
        if (cacheTtlMs > 0) cache.set(r.number, { result: r, at: Date.now() });
      }
      // A provider that silently drops a number would poison the report:
      // surface the gap as an explicit error instead.
      for (const n of batch) {
        if (!out.has(n)) {
          throw new Error(`provider "${opts.provider.name}" returned no result for one of the numbers`);
        }
      }
    }

    return normalized.map((n) => out.get(n)!);
  }

  return {
    verify,
    health: () => opts.provider.health(),
    /** Test/ops hook: how many entries the cache holds right now. */
    cacheSize: () => cache.size,
  };
}
