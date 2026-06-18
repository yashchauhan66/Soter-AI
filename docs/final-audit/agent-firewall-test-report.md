# Agent Firewall Test Report

Date: 2026-06-18
Branch: `bug-stabilization-final`

## Commands Run

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | PASS — 0 errors |
| `npm test` (`tsx --test ...`) | PASS — 265/265 |
| SDK build (`tsc -p tsconfig.json`) | PASS |
| `npm run build` (`next build`) | PASS — all routes/pages compiled |
| `npx prisma validate` | PASS — schema valid |
| `npx prisma generate` | PASS |

## Passed Tests

265 of 265 across the configured suites. Agent Firewall coverage (52 tests):

**Action Firewall** — safe browser read → ALLOW; gmail.send w/o secret → ASK_APPROVAL; gmail.send with API key → BLOCK; external API post with private data → BLOCK; calendar read → ALLOW; calendar create → policy-based; `rm -rf` → BLOCK; `curl | bash` → BLOCK; `npm publish` → BLOCK/ASK_APPROVAL; `git push --force` → BLOCK.

**Data Egress** — OpenAI key external → BLOCK; DB URL external → BLOCK; PAN/Aadhaar to unknown → BLOCK/ASK_APPROVAL; redacted PII to allowed domain → ALLOW; public summary → ALLOW.

**MCP Scanner** — filesystem.read → HIGH; filesystem.delete → CRITICAL; terminal.run → CRITICAL; browser.read → LOW/MEDIUM; gmail.send → HIGH.

**Manifest** — blocked tool blocks safe-looking action; approvalRequired forces approval; allowlisted domain reduces risk; blocked `.env` pattern blocks; most restrictive wins.

**Approval** — request created for high-risk email; token hashed; approved allows; denied blocks; expired rejected; reuse rejected.

**Browser Form Guard** — safe trusted form → ALLOW; password → TAKEOVER_REQUIRED; OTP → TAKEOVER_REQUIRED; API key in form → BLOCK; PAN/Aadhaar unknown form → ASK_APPROVAL/BLOCK; page injection → BLOCK.

**Memory Firewall** — safe preference → ALLOW; API key → BLOCK; password → BLOCK; poisoning instruction → BLOCK; private email → BLOCK/REDACT.

**RAG Trust** — trusted clean → TRUSTED; "ignore previous instructions" → QUARANTINED; system-prompt leak → QUARANTINED; secrets → REVIEW/REDACT_AND_INDEX; unknown suspicious → NEEDS_REVIEW.

**Canary** — create token; hash-only storage; canary in output → CRITICAL BLOCK; canary in tool call → CRITICAL BLOCK; no canary → ALLOW.

**Replay** — timeline present; blocked action present; approval event present; canary leak present; no raw secrets exposed. Incident PDF builder returns a valid `%PDF` buffer with no raw secret bytes embedded.

**SDK** — `@cybersecurityguard/guard` builds clean after adding MVP 3 client methods (`scanMcpTools`, `checkBrowserForm`, `checkMemory`, `scoreRagDocument`, `createCanary`, `checkCanaryLeak`, `getAgentReplay`, `createGenericChatbotWrapper`), their standalone function forms, new request/response types, and a `get` request helper.

**Integration (mock agents)** — OpenClaw checks every tool call; browser agent does not execute blocked submit; MCP tool executes only after ALLOW; LangChain wrapper pauses on approval; generic chatbot follows input→action→data→output order.

**Failure / regression** — guard unavailable + HIGH/CRITICAL → FAIL_CLOSED; low-risk read follows configured policy; 429 → action not executed; invalid API key rejected; cross-project session denied; raw secrets never logged; `/api/guard/input|output|analyze` still pass; existing RAG, API-key auth, and dashboard build regressions all green.

## Failed Tests

None.

## Skipped Tests

None.

## Root Cause of Failures (during development)

Two pre-existing TypeScript errors in `lib/agent-firewall/mvp3.ts` were found and fixed before completion:

1. `scanMcpTools` — `recommendedDecision` inferred as `string`, not the literal union. **Fix:** annotated the variable as `"ALLOW" | "ASK_APPROVAL" | "BLOCK"`.
2. `scoreRagDocument` — pushed a `"SUSPICIOUS_ENCODING"` finding whose `type` did not match the guard finding union. **Fix:** widened the local `findings` array element type to `{ type: string; label: string; severity: string }`.

After both fixes `tsc --noEmit` returns 0 errors.

## Fixes Applied

- mvp3.ts type annotations (above).
- Added missing dashboard pages `/dashboard/agent-firewall/rag-trust` and `/dashboard/agent-firewall/replay`.
- Added sub-navigation on the agent-firewall landing page linking all seven sub-pages.
- Added the agent-incident PDF builder (`lib/pdf/agentIncidentReport.ts`) and wired `?format=pdf` into the replay route (Node runtime, signed, redacted-only).
- Added MVP 3 SDK methods + standalone exports + types + a `get` helper to `@cybersecurityguard/guard`.
- Added `tests/agent-firewall-mvp3.test.ts` (22 tests) and wired it into `npm test`.

## Remaining Blockers

None. All required checks pass. Run the MVP 3 migration (`prisma migrate deploy`) in the target environment before enabling the feature flag.
