/**
 * UAZAPI provider: the first concrete Provider.
 *
 * Talks to a UAZAPI instance's number-verification endpoint. The instance is
 * expected to be YOUR disposable verifying account; this module never logs the
 * numbers it checks and never puts the token on a command line.
 */
import type { CheckResult, Provider } from "../index";

export interface UazapiOptions {
  /** Base URL of the UAZAPI instance, e.g. https://your-subdomain.uazapi.com */
  url: string;
  /** Instance token. Sent as the "token" header, never logged. */
  token: string;
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Verification path. Default "/chat/check". */
  path?: string;
}

/**
 * Different UAZAPI builds label the response fields differently; normalize
 * defensively instead of trusting one exact shape.
 */
function normalizeItem(raw: Record<string, unknown>): CheckResult | null {
  const number =
    (raw.query as string) ?? (raw.number as string) ?? (raw.phone as string) ?? null;
  if (!number) return null;
  const exists =
    (raw.isInWhatsapp as boolean) ??
    (raw.exists as boolean) ??
    (raw.isValid as boolean) ??
    false;
  const id = (raw.jid as string) ?? (raw.id as string) ?? undefined;
  return { number: String(number), exists: Boolean(exists), id };
}

export function uazapiProvider(opts: UazapiOptions): Provider {
  const base = opts.url.replace(/\/+$/, "");
  const path = opts.path ?? "/chat/check";
  const timeoutMs = opts.timeoutMs ?? 15000;

  async function post(body: unknown): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(base + path, {
        method: "POST",
        headers: { token: opts.token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "uazapi",

    async check(numbers: string[]): Promise<CheckResult[]> {
      const res = await post({ numbers });
      if (!res.ok) {
        // Do not echo the body: some builds mirror the request (with numbers) back.
        throw new Error(`uazapi responded HTTP ${res.status}`);
      }
      const data = (await res.json()) as unknown;
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>).results)
          ? ((data as Record<string, unknown>).results as unknown[])
          : null;
      if (!list) throw new Error("uazapi returned an unexpected payload shape");

      const byDigits = new Map<string, CheckResult>();
      for (const item of list) {
        const r = normalizeItem(item as Record<string, unknown>);
        if (r) byDigits.set(r.number.replace(/\D/g, ""), r);
      }
      // Answer in the caller's own normalized numbers, matched by digits.
      return numbers.map((n) => {
        const hit = byDigits.get(n.replace(/\D/g, ""));
        return hit ? { ...hit, number: n } : { number: n, exists: false };
      });
    },

    async health(): Promise<boolean> {
      try {
        const res = await post({ numbers: [] });
        return res.status < 500;
      } catch {
        return false;
      }
    },
  };
}
