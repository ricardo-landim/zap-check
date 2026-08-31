<!-- Banner -->
<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F0E0D,35:075E54,70:25D366,100:F5E6D3&height=240&section=header&text=zap-check&fontSize=58&fontColor=F5E6D3&animation=fadeIn&fontAlignY=38&desc=Verify%20WhatsApp%20numbers%20%E2%80%94%20without%20ever%20risking%20your%20official%20sender&descAlignY=60&descSize=16" />
</div>

<!-- Typing -->
<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=21&duration=2800&pause=900&color=25D366&center=true&vCenter=true&width=840&lines=Verify+before+you+message+%E2%80%94+never+burn+your+sender;Pluggable+providers+%E2%80%94+UAZAPI+first%2C+yours+in+one+file;The+verifying+number+is+disposable+%E2%80%94+the+official+one+never+risks;Numbers+never+logged+%C2%B7+secrets+only+via+env" />
</div>

<!-- Status -->
<div align="center">
  <img src="https://img.shields.io/badge/For-WhatsApp%20senders-075E54?style=for-the-badge&logo=whatsapp&logoColor=F5E6D3" />
  <img src="https://img.shields.io/badge/Providers-Pluggable-25D366?style=for-the-badge&logo=plug&logoColor=white" />
  <img src="https://img.shields.io/badge/Privacy-Numbers%20never%20logged-0F0E0D?style=for-the-badge&logo=adguard&logoColor=F5E6D3" />
  <img src="https://img.shields.io/badge/Runtime-Bun%20%2B%20TypeScript-8C4A32?style=for-the-badge&logo=bun&logoColor=F5E6D3" />
  <img src="https://img.shields.io/badge/License-MIT-25a162?style=for-the-badge" />
</div>

> **zap-check** answers "does this number have WhatsApp?" before you spend money and sender
> reputation messaging it — through a separate, disposable verifying account, so your official
> WhatsApp Cloud API sender never participates in verification. One library, one CLI, one
> optional micro-service; providers are pluggable in a single file.

> Not affiliated with or endorsed by Meta, WhatsApp or any provider. "WhatsApp" is a Meta
> trademark.

[Leia em português](README.pt-BR.md)

<br>

## What it is

```yaml
product:     WhatsApp number verification with pluggable providers
isolation:   a disposable verifying account checks; your official sender never does
providers:   UAZAPI built in — add yours by implementing one interface in one file
surfaces:    TypeScript library · CLI · optional HTTP micro-service (bearer auth)
protection:  batching + pauses (rate limit) shield the verifying account from bursts
privacy:     verified numbers are never logged; errors never echo request bodies
secrets:     env only (.env.example) — never argv, never files in the repo
runtime:     Bun-first, zero runtime dependencies (standard fetch and node:http)
```

## The problem

If you send through the official WhatsApp Cloud API, there is no way to ask "does this number
even exist on WhatsApp?" without actually messaging it. Messaging dead numbers burns money and,
worse, sender reputation — the thing that keeps your templates approved and your number alive.

Third-party providers can answer that question, but pointing one at your official number means
tying your most valuable asset to an unofficial connection.

## Architecture

```
 your app ──▶ zap-check ──▶ verifying instance        (disposable, 3rd-party provider)
     │                       answers: exists / not
     │
     └───────────────────▶ official Cloud API sender  (only messages numbers that exist)

 the two lanes NEVER cross: if the verifying account is banned, you swap it;
 the official sender never took the risk
```

## Quick start

```bash
git clone https://github.com/ricardo-landim/zap-check.git
cd zap-check
bash install.sh          # checks Bun, runs the test suite, links the CLI
cp .env.example .env     # fill in ZAPCHECK_URL and ZAPCHECK_TOKEN
```

Library:

```ts
import { createVerifier } from "./src/index";
import { uazapiProvider } from "./src/providers/uazapi";

const verifier = createVerifier({
  provider: uazapiProvider({ url: process.env.ZAPCHECK_URL!, token: process.env.ZAPCHECK_TOKEN! }),
  batchSize: 20,      // numbers per provider call
  intervalMs: 1000,   // pause between batches — protects the verifying account
  cacheTtlMs: 60_000, // optional cache for repeated checks
});

const results = await verifier.verify(["+15551234567", "+15557654321"]);
// [{ number: "+15551234567", exists: true, id: "15551234567@s.whatsapp.net" }, ...]
```

CLI and micro-service:

```bash
zap-check +15551234567 +15557654321     # one line per number: <number>\t<yes|no>
zap-check --health

ZAPCHECK_ACCESS_TOKEN=change-me bun src/server.ts    # listens on :8377
curl -s -X POST http://localhost:8377/verify \
  -H "Authorization: Bearer change-me" -H "Content-Type: application/json" \
  -d '{"numbers": ["+15551234567"]}'
```

> [!NOTE]
> Nothing is hosted for you: the micro-service runs where you run it, and any stack (any
> language, nothing to install) consumes it with one POST.

## Surfaces

| | Surface | What it does |
|:---:|---|---|
| 📚 | `src/index.ts` | `createVerifier()` — batching, rate limit, optional TTL cache, dedupe |
| 🔌 | `src/providers/` | UAZAPI built in; `_template.ts` is the one-file contract for yours |
| ⌨️ | `zap-check <numbers>` | CLI — tab-separated output, `--health`, exit codes for scripting |
| 🌐 | `src/server.ts` | HTTP micro-service — `POST /verify`, `GET /health`, bearer auth, body limits |
| 🧪 | `bun test` | 16 tests across 3 suites, fully against local fakes — no network leaves the machine |

## Adding a provider (one file)

Copy [`src/providers/_template.ts`](src/providers/_template.ts), implement `check()` and
`health()`, wire it in `src/config.ts`. The contract: one result per number (a provider that
silently drops a number is an explicit error), never log the numbers, credentials come from
options — the CLI and the server feed them from env.

## Troubleshooting

> [!WARNING]
> The verifying account lives on an unofficial connection and can be limited or banned by
> WhatsApp at any time. That is the design: use a number you can afford to lose, and never
> point zap-check at your official sender's number.

If checks start failing, `zap-check --health` tells you whether the verifying instance is
reachable and authenticated. A `429` from the provider means you are pushing too hard: raise
`ZAPCHECK_INTERVAL_MS` or lower `ZAPCHECK_BATCH_SIZE`.

## Requirements

- [Bun](https://bun.sh) 1.0+
- A verification instance on a supported provider (UAZAPI today) with its URL and token

## Security notes

- Verified numbers are never written to logs, and provider errors never echo request bodies
  (some providers mirror the request back — zap-check refuses to print it).
- Secrets travel only via env (`.env.example`); never on argv, where `ps` exposes them.
- The micro-service supports bearer auth (`ZAPCHECK_ACCESS_TOKEN`) and enforces body limits.
- Built-in batching and pauses keep the verifying account under the provider's radar.

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — invariants and ADRs
- [`install.sh`](install.sh) — what lands where (`~/bin/zap-check`)

---

## Made by Six Quasar

**Six Quasar** builds AI agents that actually work: WhatsApp as the interface, a deterministic
core, AI at the edge. This tool was born from operating WhatsApp fleets where the official
senders must never be the ones taking risks.

<a href="https://github.com/ricardo-landim"><img src="https://img.shields.io/badge/GitHub%20profile-181717?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://sixquasar.shop"><img src="https://img.shields.io/badge/sixquasar.shop-25D366?style=for-the-badge&logo=safari&logoColor=F5E6D3" /></a>

<!-- Footer -->
<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:25D366,40:075E54,100:0F0E0D&height=120&section=footer" />
</div>
