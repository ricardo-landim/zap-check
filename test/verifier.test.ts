import { describe, expect, test } from "bun:test";
import { createVerifier, normalizeNumber, type CheckResult, type Provider } from "../src/index";

function fakeProvider(log: string[][], existing: Set<string>): Provider {
  return {
    name: "fake",
    async check(numbers: string[]): Promise<CheckResult[]> {
      log.push([...numbers]);
      return numbers.map((number) => ({ number, exists: existing.has(number) }));
    },
    async health() {
      return true;
    },
  };
}

describe("normalizeNumber", () => {
  test("keeps a leading plus and strips everything else", () => {
    expect(normalizeNumber(" +1 (555) 123-4567 ")).toBe("+15551234567");
    expect(normalizeNumber("15551234567")).toBe("15551234567");
  });
  test("rejects garbage", () => {
    expect(() => normalizeNumber("abc")).toThrow();
    expect(() => normalizeNumber("+123")).toThrow();
  });
});

describe("createVerifier", () => {
  test("answers every number, preserving input order", async () => {
    const log: string[][] = [];
    const v = createVerifier({ provider: fakeProvider(log, new Set(["+15551230001"])), intervalMs: 0 });
    const out = await v.verify(["+1 555 123 0002", "+15551230001"]);
    expect(out.map((r) => r.number)).toEqual(["+15551230002", "+15551230001"]);
    expect(out.map((r) => r.exists)).toEqual([false, true]);
  });

  test("splits batches at batchSize", async () => {
    const log: string[][] = [];
    const v = createVerifier({ provider: fakeProvider(log, new Set()), batchSize: 2, intervalMs: 0 });
    await v.verify(["+15551230001", "+15551230002", "+15551230003"]);
    expect(log.length).toBe(2);
    expect(log[0].length).toBe(2);
    expect(log[1].length).toBe(1);
  });

  test("cache with TTL avoids repeat provider calls", async () => {
    const log: string[][] = [];
    const v = createVerifier({ provider: fakeProvider(log, new Set()), cacheTtlMs: 60_000, intervalMs: 0 });
    await v.verify(["+15551230001"]);
    await v.verify(["+15551230001"]);
    expect(log.length).toBe(1);
    expect(v.cacheSize()).toBe(1);
  });

  test("deduplicates within one call", async () => {
    const log: string[][] = [];
    const v = createVerifier({ provider: fakeProvider(log, new Set()), intervalMs: 0 });
    const out = await v.verify(["+15551230001", "+1 555 123 0001"]);
    expect(log[0].length).toBe(1);
    expect(out.length).toBe(2);
  });

  test("a provider that drops a number is an explicit error, not a silent gap", async () => {
    const dropper: Provider = {
      name: "dropper",
      async check() {
        return [];
      },
      async health() {
        return true;
      },
    };
    const v = createVerifier({ provider: dropper, intervalMs: 0 });
    await expect(v.verify(["+15551230001"])).rejects.toThrow(/no result/);
  });
});
