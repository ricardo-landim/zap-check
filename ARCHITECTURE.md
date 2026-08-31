# Architecture: zap-check

## Problem

Official WhatsApp Cloud API senders cannot ask "does this number exist on WhatsApp?" without
messaging it, and messaging dead numbers costs money and sender reputation. Third-party
providers can answer the question, but pointing one at the official number ties the most
valuable asset of the operation to an unofficial connection.

## Features

- One verification core with batching, rate limiting, optional TTL cache and deduplication.
- Providers pluggable through a one-file interface; UAZAPI ships built in.
- Three surfaces over the same core: TypeScript library, CLI, HTTP micro-service.
- Privacy by default: verified numbers never reach logs, errors never echo request bodies.
- Secrets via environment only, validated at startup.

## Dependencies

| Foundation | Consumers |
|---|---|
| `Provider` interface (`src/index.ts`) | every provider implementation |
| `createVerifier` core | library callers, CLI, server |
| env wiring (`src/config.ts`) | CLI and server (never the library, which takes options) |
| local fakes (`test/`) | the whole suite — no network in tests |

## Invariants

1. The verifying account and the official Cloud API sender never share a number. The tool has
   no code path that touches a Cloud API credential.
2. A verified number never reaches stdout logs, stderr or error messages; provider error
   bodies are never echoed (some providers mirror the request back).
3. Secrets travel only via environment variables; nothing reads tokens from argv or from
   files inside the repository.
4. Every call answers one result per input number, or fails loudly: a provider that silently
   drops a number is an explicit error, never a silent gap.
5. Batching and inter-batch pauses are on by default; the verifying account is protected from
   bursts unless the operator explicitly opts out.
6. The test suite runs entirely against local fakes; `bun test` never sends network traffic
   off the machine.

## ADR-001: verification through a disposable third-party account

**Status:** accepted.

The whole point of the tool. Unofficial connections can be limited or banned at any time, so
the account used for verification must be one the operator can afford to lose. The official
sender stays on the official API and only ever messages numbers that verified as existing.

Consequence: zap-check depends on the provider's continued tolerance of verification traffic;
rate limiting (invariant 5) exists to keep that tolerance.

## ADR-002: providers behind a one-file interface

**Status:** accepted.

`Provider` is two methods, `check()` and `health()`. UAZAPI response shapes vary across
builds, so the built-in provider normalizes defensively (`query`/`number`/`phone`,
`isInWhatsapp`/`exists`/`isValid`, `jid`/`id`) instead of trusting one exact schema.

Consequence: adding a provider is copying `_template.ts` and wiring one switch case in
`config.ts`; the core and both frontends stay untouched.

## ADR-003: the micro-service is node:http, not a framework

**Status:** accepted.

The server exists so that any stack can consume verification with one POST and zero installs.
`node:http` runs under Bun and Node alike, needs no dependency, and the handler is exported
separately from `listen()` so tests mount it on an ephemeral port.

Consequence: no middleware ecosystem; auth (bearer token) and body limits are implemented
explicitly in the handler, which keeps them visible and testable.
