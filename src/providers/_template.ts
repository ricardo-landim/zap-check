/**
 * Provider template: copy this file to add a new provider in ONE file.
 *
 * Contract (see Provider in ../index.ts):
 *   1. check(numbers) receives normalized numbers and MUST return one result
 *      per number, in any order. Never log the numbers.
 *   2. health() answers "is the instance reachable and authenticated?" and
 *      must never throw.
 *   3. Read credentials from options (the CLI/server wire them from env);
 *      never hardcode, never put secrets on argv.
 */
import type { CheckResult, Provider } from "../index";

export interface MyProviderOptions {
  url: string;
  token: string;
}

export function myProvider(opts: MyProviderOptions): Provider {
  return {
    name: "my-provider",

    async check(numbers: string[]): Promise<CheckResult[]> {
      void opts; // call your provider's verification endpoint here
      return numbers.map((number) => ({ number, exists: false }));
    },

    async health(): Promise<boolean> {
      return false;
    },
  };
}
