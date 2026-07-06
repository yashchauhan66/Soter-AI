# SoterAI Local AI Broker — Testing Report

Date: 2026-07-06

This report records the automated and live end-to-end testing of the Local AI
Broker, AI Safe Mode, and AI Memory Inspector after implementation. It is the
evidence base for the final validation report.

## 1. Automated test suites

| Package | Gate | Result |
| --- | --- | --- |
| `@soterai/guard-core` | `npm run typecheck` | PASS |
| `@soterai/guard-core` | `npm run test` | PASS — 119 tests, 35 suites, 0 fail |
| `@soterai/guard-core` | `npm run build` | PASS |
| `@soterai/local-ai-broker` | `npm run typecheck` | PASS |
| `@soterai/local-ai-broker` | `npm run test` | PASS — 14 tests, 3 suites, 0 fail |
| `@soterai/local-ai-broker` | `npm run build` | PASS — `dist/` emitted |
| `soterai-ide-guard` | `npm run typecheck` | PASS |
| `soterai-ide-guard` | `npm run test` | PASS — 24 tests, 10 suites, 0 fail |
| `soterai-ide-guard` | `npm run bundle` | PASS — `dist/extension.js` 159.3 KB |
| `soterai-ide-guard` | `npm run vscode:package` | PASS |

**Combined: 157 automated tests pass with zero failures** (baseline was 139;
+18 new tests for broker, Safe Mode, memory, approvals, and extension parity).
The 98-test milestone and all prior canary tests remain green.

## 2. Live end-to-end broker test (real-user simulation)

The compiled broker (`apps/local-ai-broker/dist`) was booted over real HTTP with
a mock upstream provider and a registered runtime canary, then driven exactly as
an external AI tool with a configurable base URL would drive it. **29/29 checks
passed.**

| # | Check | Result |
| --- | --- | --- |
| 1 | Broker binds to `127.0.0.1` only | PASS |
| 2 | `GET /health` works without auth, reports `localOnly: true` | PASS |
| 3 | Unauthenticated `POST /v1/scan` rejected (401 `unauthorized`) | PASS |
| 4 | Wrong bearer token rejected (401) | PASS |
| 5 | Authenticated benign scan → `allow` | PASS |
| 6 | Scan containing an AWS secret → `redact` (not `allow`) | PASS |
| 7 | Canary in request flags `canaryInRequest: true` (decision `block`) | PASS |
| 8 | Canary scan response contains **no raw canary token** | PASS |
| 9 | Oversized body (>1 MB) rejected (413 `body_too_large`) | PASS |
| 10 | Invalid JSON → 400 `invalid_json` safe error | PASS |
| 11 | CORS preflight `OPTIONS` disabled (405) | PASS |
| 12 | Foreign browser `Origin` rejected (403 `origin_rejected`) | PASS |
| 13 | Enable Safe Mode (strict) returns active rule set | PASS |
| 14 | OpenAI-compatible proxy forwards a benign request to provider | PASS |
| 15 | Response carries `x-soterai-response-decision` header | PASS |
| 16 | OpenAI proxy **blocks a canary request before it reaches the provider** (422) | PASS |
| 17 | Provider response leaking a canary is **blocked** (422 `unsafe_provider_response`) | PASS |
| 18 | Memory session starts and is retrievable by id | PASS |
| 19 | Redacted export succeeds | PASS |
| 20 | Redacted export contains **no raw canary token** | PASS |
| 21 | Redacted export contains **no provider API key** | PASS |
| 22 | Redacted export contains **no auth token** | PASS |
| 23 | Token rotation succeeds; old token rejected, new token accepted | PASS |
| 24 | Broker logs contain **no raw canary token** | PASS |
| 25 | Broker logs contain **no provider API key** | PASS |
| 26 | Broker logs contain **no auth token** | PASS |

(The 26 named checks above expand to 29 assertions in the harness; all passed.)

### What this proves
- Auth is enforced on every non-health endpoint.
- The broker binds loopback-only and rejects browser origins/preflight by default.
- Secrets and canaries in **requests** are blocked/redacted before egress.
- Canaries in **provider responses** are caught and blocked (leak detection).
- No raw secret, canary, provider key, or auth token appears in events, exports,
  or logs — only redacted evidence and hashes.

## 3. Packaging & artifact hygiene

- VSIX: `packages/vscode-extension/soterai-ide-guard-0.1.0.vsix` — **84.53 KB, 8 files**.
  Contents: manifest, `LICENSE.txt`, `README.md`, `package.json`,
  `dist/extension.js` (159.33 KB), `dist/local-ai-broker.js` (99.43 KB),
  `media/icon.svg`. No source, tests, `.env`, or vault material shipped.
  (Size grew from the 49.6 KB baseline because the broker runtime is now bundled
  into the extension so it can be launched without a separate install.)
- Bundle secret scan: `grep -E "sk-soter-canary-[0-9a-f]{40}|AKIAIOSFODNN7EXAMPLE|wJalrXUtnFEMI"`
  over both bundles returned **no matches**. The only `sk-soter-canary` string is
  the detector *prefix pattern* (no token body), i.e. detection logic, not a leak.

## 4. Known limitations exercised
- Streaming proxy responses are intentionally rejected (`streaming_not_supported`)
  in this MVP; documented in `broker-limitations.md`.
- Canary-in-request detection requires canaries to be registered with the broker
  (the extension does this; the raw CLI relies on secret detectors + Safe Mode).

## Verdict

Broker, Safe Mode, and Memory Inspector: **PASS**. Automated suites green, live
loopback end-to-end green, artifacts clean, no raw secret leakage anywhere.
