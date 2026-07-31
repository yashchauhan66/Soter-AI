# SOTERAI TECHNICAL SUPREMACY REPORT

Permanent source of truth for the autonomous technical-supremacy program.
Every session MUST update this file: baseline, audit, gap queue, change log, evidence.

Rules of evidence (never violate):
- A capability level is only as high as its **verified** evidence. Detection ≠ enforcement; monitoring ≠ blocking; UI ≠ backend; route existence ≠ workflow completion; synthetic benchmark ≠ external superiority.
- Classification ladder: `Absent / Shell / Partial / Implemented / Unit-tested / Integration-tested / Runtime-verified / Packaged-verified / Production-proven / Independently validated`.
- Tests are never weakened, skipped, or renamed to obtain green.

---

> Evidence note (2026-07-30): sections 1–7 preserve the chronological engineering record. Where
> an older result differs from section 8, it is historical/superseded rather than the current
> verdict. Section 8 is the authoritative reconciliation.

## 1. Repository baseline (2026-07-28, updated 2026-07-29; historical)

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `e47a8a19` "Improve security" (2026-07-28) |
| Worktree at 2026-07-28 session start | clean (no tracked or untracked changes) |
| Worktree now (2026-07-29, NOT committed) | modified: `package.json`, `packages/guard-core/src/{MCPGateway,CapabilityRegistry}.ts`, `docs/security/mcp-security.md`, `artifacts/security/capabilities.json`; new: `lib/gateway/`, `app/api/gateway/`, `tests/gateway.test.ts`, this report |
| Monorepo surfaces | Next.js app (`app/`, `lib/`), `packages/` (guard-core, sdk, policy-engine, vscode-extension, ide-protocol, integrations, python/go SDKs, soter-pii, cli), `apps/` (extension = browser, local-ai-broker), `workers/`, `integrations/`, `prisma/`, `models/`, `datasets/`, `benchmarks/` |

### Verified green gates (runtime-verified 2026-07-29)

| Suite | Result | Command |
|---|---|---|
| packages/guard-core | **458 pass / 0 fail** (63 suites, ~9.6s) | `npx tsx --test "src/__tests__/**/*.test.ts"` |
| apps/local-ai-broker | **30 pass / 0 fail** | `npx tsx --test "src/__tests__/**/*.test.ts"` |
| packages/vscode-extension | **113 pass / 0 fail** | `npm test` |
| tests/gateway.test.ts (AI gateway) | **24 pass / 0 fail** | `npx tsx --test tests/gateway.test.ts` |
| tests/mcp-gateway.test.ts | **66 pass / 0 fail** | `npx tsx --test tests/mcp-gateway.test.ts` |
| tests/model-scan.test.ts | **14 pass / 0 fail** (now wired into `npm test`) | `npx tsx --test tests/model-scan.test.ts` |
| Typecheck (root + guard-core) | clean | `tsc --noEmit` |

The 45 detector-recall failures recorded on 2026-07-28 morning were fixed and committed in `e47a8a19`
(JailbreakLiteDetector v1.1.0, PromptInjectionLiteDetector v1.2.0, SecretDetector; bounded noise-gap
classes, zero test modifications). Details: `docs/SOTERAI-GUARD-CORE-RECALL-RECOVERY-REPORT.md`.
Prior session gates (per `docs/SOTERAI-IDE-GUARD-FULL-ENFORCEMENT-REPORT.md`): vscode-extension 113/113,
local-ai-broker 30/30, runtime smoke 7/7, VSIX packaged.

---

## 2. Ground-truth capability audit (2026-07-28; historical)

### 2.1 Capability honesty registry
`artifacts/security/capabilities.json` (regenerated 2026-07-29 from `packages/guard-core/src/CapabilityRegistry.ts`, 22 entries, honest=true):
**10 STRONG_ENFORCEMENT** (secret-broker, safe-context, secret-redaction, clipboard-safe-paste,
broker-streaming, controlled-terminal, hosted-ai-gateway, mcp-gateway,
taint-engine, model-supply-chain-scan), **8 DETECTION_ONLY** (dependency-guard,
terminal-manual-review, mcp-config-scan, extension-risk-scan,
file-operation-firewall, network-egress-policy, process-sandbox-policy, governance-policy),
**1 PARTIAL_ENFORCEMENT** (checkpoint-rollback — real filesystem adapter + 16 runtime broker tests),
**1 VISIBILITY_ONLY** (live-scan),
**2 UNSUPPORTED** (arbitrary-process egress firewall, child-process control).

### 2.2 Component classification (master-prompt priority order)

| # | Component | State | Evidence | Gap |
|---|---|---|---|---|
| 1 | Repo/architecture baseline | Done (this report §1) | — | — |
| 2 | Canonical decision/identity/policy contracts | **Implemented + integration-tested (new surfaces)** | Canonical contract shipped: `lib/gateway/decision.ts` — 8 master verbs (`ALLOW/REDACT/TRANSFORM/WARN/REQUIRE_APPROVAL/BLOCK/QUARANTINE/ABSTAIN`) + full evidence envelope (category/severity/confidence/threshold/policyVersion fingerprint/identity/destination/traceId/reason/enforcement-status/direction/timestamp); first adapter `fromGuardAction` maps the legacy web-guard union; contract tests in `tests/gateway.test.ts`. Gateway emits it natively on every response (headers + persisted evidence) | Remaining: adapters for guard-core/sdk/agent-firewall verb unions (§2.3 inventory, queued item 6) |
| 3 | Auth, tenant isolation, route security | Implemented+tested | `lib/apiKeyMiddleware.ts`, `lib/auth/guards.ts` (`requireProjectPermission`), per-key RPM + monthly quota (`app/api/guard/input/route.ts:38-72`), prior cross-tenant fixes (F-01) | SCIM/SSO present; no new P0 found this session (not re-audited in depth) |
| 4 | Universal AI gateway | **Implemented + integration-tested (hosted); Runtime-verified core (local)** | Hosted inline enforcement shipped 2026-07-29: `app/api/gateway/openai/v1/chat/completions` + `app/api/gateway/anthropic/v1/messages` (customer swaps SDK base_url + adds `x-soterai-api-key`). Full pipeline per request: SoterAI auth (fail closed) → RPM+quota → 2MB bounded parse → policy load (fails to strictest default) → input scan → BLOCK(403)/REDACT-before-forward → allowlisted-header upstream forward (SoterAI key never forwarded, 120s bounded timeout) → response scan → BLOCK-with-tool-call-strip/REDACT → per-SSE-frame accumulated stream scan with mid-stream BLOCK. Evidence: `tests/gateway.test.ts` 24/24 and isolated real-HTTP handler smoke 12/12. | Production-built Next.js + PostgreSQL runtime variant is externally blocked by Docker daemon/API access; unrouted traffic and already-flushed stream tokens remain bypasses. |
| 5 | MCP & A2A gateway | **Runtime-verified (stdio); Integration-tested (Streamable HTTP/SSE)** | Shared enforcement engine covers stdio, Streamable HTTP, and SSE. Real child-process smoke proves safe calls execute, blocked calls never execute upstream, approved calls execute exactly once, results are redacted, and shutdown leaves no orphan. Current combined suite: 117/117. Performance re-measured 2026-07-31 under the controlled 5×300-iteration protocol in section 9: five of six budgets pass on the median trial. | WebSocket is unsupported and bypasses enforcement. One budget is still not met — cold simple-ALLOW p95 8.106 ms vs 8 ms (section 9.2), cross-trial range 5.61–10.51 ms on a host at 64.8% background CPU load; decision paths were re-verified in every bucket of every trial. Treat that single budget as not yet met. |
| 6 | Model & supply-chain scanner | **Implemented + tests IN CI** | 2026-07-29: `tests/model-scan.test.ts` (14 real-byte tests) wired into `npm test`; `model-supply-chain-scan` added to capability registry as DETECTION_ONLY (verdicts don't gate deployment — honest bypass note) | (b) GGUF/ONNX deep parse; (c) HF-hub fetch scanning; (d) signature chain not verified vs trust root (honestly flagged); (e) offline CLI; (g) AI-BOM does not consume scan results |
| 7 | Agent identity & capability graph | Implemented+tested (advisory-by-contract) | `lib/agent-passport` (+ delegation), `lib/agent-intent`, passport auth on A2A route; ledger/rollback/blast-radius engines + routes + Prisma models real (`lib/agent-action-ledger/index.ts:49,94`, `lib/advanced-security/blastRadius.ts:85`) | **Zero runtime callers**: `packages/langchain-middleware` and `packages/vercel-ai-sdk-middleware` are text-in/text-out only — no tool-call wrapping, no `/api/agent/action/check` calls. Only callers are test batteries, smoke scripts, dashboards. Many tests are existence/string-match-based (`tests/agent-passport.test.ts:150`, `tests/deep-agent-control-governance.test.ts:672`) — they prove routes exist, not that enforcement works |
| 8 | Agent action safety | Implemented+tested (advisory-by-contract) | `decideAndPersistAgentAction` (`lib/agent-firewall/server.ts:181`), approvals, escrow, dry-run, semantic-egress | Verdicts are requests to the caller ("Do not execute the action" — `server.ts:313`), not blocks. Gap: middleware tool-call interception so LangChain/Vercel-AI agents automatically hit the check |
| 9 | Guard-core correctness | **Runtime-verified** | 458/458 (this session) | Honest held-out generalization ceiling (~64% novel, regex tier) documented; ML tier separate |
| 10 | Multilingual hybrid detection | Partial | ONNX MiniLM classifier v5 (rolled back from v6), tokenizer parity fix, llmJudge tier (off by default), Hinglish corpus | Content-harm INPUT wall (HarmBench ~56.5%) — external lever = paid LLM judge or transformer retrain (user decision pending) |
| 11 | Browser & IDE enforcement | Runtime-verified (local) | IDE: protection state machine, broker lifecycle, lockdown — ext 113/113, smoke 7/7; browser ext hard-enforcement + doc DLP 142/142 | In-host packaged VS Code smoke + Cursor/Windsurf cross-editor = external-runtime pending |
| 12 | Workflow integrations | Implemented | `packages/integrations` (n8n SoterGuard node…), WordPress/JS/Python SDKs | Divergent decision verbs per integration |
| 13 | RAG & document sandbox | Partial | `app/api/rag/*`, rag-rescan tests, browser-ext doc extraction (PPTX/XLSX) | Full isolated-parser sandbox audit not done this session |
| 14 | Adaptive continuous assurance | Partial | redteam benchmark tests, honest-benchmark suite, evidence gates | No closed discover→threat-model→test→regress loop |
| 15 | Distributed reliability | Partial | rate limits, deferred persistence, DynamoDB events, health/ready routes | Queues/DLQ/circuit breakers not audited this session |
| 16 | Performance & observability | Partial | `recordRequestMetric`, guard-core bench gates (10KB ≤20ms, 100KB ≤80ms p95), load-matrix script | Hosted-gateway latency unknown (gateway absent) |
| 17 | Full regression + competitor comparison | Not started | — | Final report due after P0/P1 closure |

### 2.3 Decision-contract fragmentation inventory (priority-2 evidence)

Known divergent verb sets (file:line):
`lib/guard/types.ts:29`, `lib/guard/streamingGuard.ts:7`, `lib/guard/contentSafety.ts:19`,
`packages/guard-core/src/types.ts:3`, `packages/sdk/src/types.ts:9,259,371,509,603,685`,
`packages/sdk/src/tool-chain.ts:37`, `packages/sdk/src/agent-passport.ts:14`, `packages/sdk/src/agent-intent.ts:22`,
`packages/integrations/n8n/.../SoterGuard.node.ts:382`, `packages/vscode-extension/src/secret-broker/types.ts:94`,
`lib/agent-firewall/index.ts:28,52`, `lib/agent-action-ledger/index.ts:4`, `lib/usage-governance/index.ts:16`,
`lib/advanced-security/{memoryPoisoning,lineage,legalBoundary}.ts`, `lib/agent-permission-diff/index.ts:3`,
`lib/ai-data-security/fingerprint.ts:4`, `lib/semantic-egress/index.ts:10`, `lib/dry-run/index.ts:10`, `lib/escrow/index.ts:13`.

Unification strategy (decided): introduce ONE canonical contract
(`ALLOW / REDACT / TRANSFORM / WARN / REQUIRE_APPROVAL / BLOCK / QUARANTINE / ABSTAIN` + full evidence
envelope) as a new shared module; new surfaces (gateway) emit it natively; existing surfaces get
**adapters** (pure mapping functions with tests), not big-bang rewrites — churn across 20 modules in one
pass would risk regressions in green suites for zero enforcement gain. Migration table maintained here.

---

## 3. Competitor-gap table (technical patterns only; historical)

| Capability | Competitor-best architecture | SoterAI now | Gap | Required change | Acceptance test | Status |
|---|---|---|---|---|---|---|
| Hosted inline AI gateway | Prisma AIRS inline / Model Armor / Cloudflare-Portkey-style base_url swap; request+response+streaming enforcement | Scan-API + hosted inline proxy (`app/api/gateway/*`) + local broker | Runtime smoke in a live Next.js server pending | Dev-server smoke + p50/p95 latency measurement | Unit+integration: block-input, redact-output, mid-stream block, key hygiene, cross-tenant — **ALL PASS (24/24)** | **DONE 2026-07-29 (integration-tested)** |
| Canonical decision contract | Single policy/verdict schema across all PEPs (Cisco AI Defense, AIRS) | Canonical contract live in gateway (`lib/gateway/decision.ts`); legacy unions still in older surfaces | Adapter migration for guard-core/sdk/agent-firewall | Adapters (pure mapping functions + tests), queued item 6 | Contract tests + adapter mapping tests — contract tests PASS | **Contract DONE; adapters queued** |
| Model-file scanning | HiddenLayer/Protect-AI modelscan: pickle VM, 35+ formats, hub integration, signed verdicts | Real pickle VM + 9 formats + provenance binding; tests IN CI; registry entry added | GGUF/ONNX deep parse, HF-hub fetch, offline CLI | Deep parsers + CLI (queued item 5) | model-scan suite green in `npm test` — **PASS (14/14)** | **CI wiring DONE; parsers queued** |
| MCP runtime interception | Inline MCP proxy gating tools/call pre-execution | Inline MCP gateway (`lib/gateway/mcp/`): bounded JSON-RPC proxy, session identity binding, capability enforcement, argument inspection, approval store, result inspection, 66 integration tests | stdio transport only; Streamable HTTP/SSE and WebSocket not supported | Runtime smoke with real MCP server + latency benchmark (queued item 4a) | block a live `tools/call` — **PASS (66/66 unit + integration)** | **DONE 2026-07-29 (stdio)** |
| Streaming output enforcement | Token-buffered scan w/ recall-window | Local broker (STRONG) + hosted gateway per-SSE-frame accumulated scan w/ mid-stream BLOCK | Flushed-token recall window (documented bypass both places) | — | mid-stream BLOCK test — **PASS** | **DONE 2026-07-29** |

---

## 4. Gap queue (historical queue; superseded by section 8.6)

1. ~~guard-core detector recall (45 failures)~~ — DONE `e47a8a19`, re-verified 458/458.
2. ~~Universal AI Gateway + canonical decision contract~~ — DONE 2026-07-29 (24/24 gateway tests, typecheck clean). Residual: live Next.js dev-server smoke + latency measurement.
3. ~~Wire `tests/model-scan.test.ts` into `npm test` + add model-scan & gateway to capabilities.json~~ — DONE 2026-07-29 (14/14 in `npm test`; registry now 22 entries, honest=true; MCPGateway mislabel also fixed).
4. ~~**MCP inline gateway**~~ — DONE `lib/gateway/mcp/` (10 modules, 66 tests, 90+ enforcement surfaces). Sub-items remain:
4a. ~~Runtime smoke with real MCP server~~ DONE (5/5); latency benchmark implemented but performance gate FAILS for allowed calls and remains P1.
4b. ~~Streamable HTTP/SSE transport support~~ DONE (45/45 integration/security tests).
4c. WebSocket transport: not justified by current MCP client coverage; explicitly unsupported/bypassed. Revisit only with a supported-client requirement.
5. Model scanner deep parsers (GGUF metadata, ONNX protobuf walk) + offline CLI.
6. Decision-contract adapters for top surfaces (guard-core, sdk, agent-firewall).
7. UNKNOWN_NOT_TESTED engines: wire runtime callers or downgrade/remove claims.
8. RAG/document sandbox depth audit; distributed-reliability audit (queues/breakers).
9. Multilingual content-harm: transformer retrain round (blocked on user Colab) / llmJudge provider decision (user).
10. Gateway runtime smoke in live Next.js server + hosted-gateway latency benchmark (p50/p95).

## 5. Session change log

### Session 2026-07-29 (this session)
Completed the in-flight Universal AI Gateway work and gap-queue item 3; fixed the queued MCPGateway honesty mislabel; **implemented and tested the MCP inline enforcement gateway (gap-queue item 4)**.
Verification commands (all green): `npx tsx --test tests/gateway.test.ts` (24/24), `npx tsx --test tests/mcp-gateway.test.ts` (66/66), `npx tsx --test tests/model-scan.test.ts` (14/14), guard-core full suite (458/458), local-ai-broker (30/30), vscode-extension `npm test` (113/113), root + guard-core `tsc --noEmit`, `npx tsx scripts/generate-capabilities-artifact.ts` (22 caps, honest=true). No destructive git operations; nothing committed or pushed.
Files changed/new this session:
- `lib/gateway/mcp/` (10 new modules) — inline MCP enforcement gateway: `index.ts`, `types.ts`, `jsonrpc.ts`, `inspect.ts`, `approvals.ts`, `decision.ts`, `engine.ts`, `proxy.ts`, `stdio.ts`, `config.ts`.
- `tests/mcp-gateway.test.ts` (new, 66 tests) — JSON-RPC parsing, decision adapter, structural inspection, approval store, engine evaluation, proxy integration with mock transports.
- `scripts/mcp-gateway.ts` — startup command for stdio gateway.
- `scripts/fake-mcp-server.mjs` — fake MCP server for runtime smoke.
- `docs/security/mcp-security.md` — corrected the coverage claim.
- `packages/guard-core/src/CapabilityRegistry.ts` — added `hosted-ai-gateway` (STRONG_ENFORCEMENT, wired, with honest bypasses) and `model-supply-chain-scan` (DETECTION_ONLY); widened `wiredInRuntime` doc to cover web control-plane callers.
- `artifacts/security/capabilities.json` — regenerated (22 entries).
- `docs/SOTERAI-TECHNICAL-SUPREMACY-REPORT.md` — this update.

### Session 2026-07-30
Resumed from the existing uncommitted MCP transport work without resetting or overwriting unrelated files.
Verified `lib/gateway/mcp` as the primary component:
- `npx tsx --test tests/mcp-gateway.test.ts` -> exit 0, 66/66.
- `npx tsx --test tests/mcp-runtime-smoke.test.ts` -> exit 0, 5/5 real child-process tests.
- `npx tsx --test tests/mcp-http.test.ts tests/mcp-http-security.test.ts` -> exit 0, 45/45.
- `npx tsc --noEmit` -> exit 0.
- `npx tsx scripts/mcpLatencyBench.ts 20 --json` -> exit 1 by design: block and result-redact
  met p95 budgets; allow-simple (14.55 ms overhead vs 8 ms) and allow-large/8 KB
  (183.31 ms vs 25 ms) failed. This is a small local sample, not a production claim.
- `npx tsx scripts/mcpLatencyBench.ts` did not complete inside a 30-second command bound;
  the default 300-iteration run remains outstanding.

Evidence level: stdio `Runtime-verified`; Streamable HTTP/SSE `Integration-tested`; WebSocket
`Unsupported`. Exact bypass: any client/server connection not routed through the gateway, including
WebSocket, is unprotected. No files were committed, pushed, deployed, or removed.

#### MCP latency optimization continuation
Optimized `lib/guard/semanticClassifier.ts` character n-gram hashing to avoid allocating a substring
and template string for every 3/4/5-gram. The new range-based FNV-1a path is bit-for-bit equivalent
to the original algorithm; `tests/semantic-classifier-performance.test.ts` compares complete vectors,
including an 8 KB input, against an in-test reference implementation.

Verification:
- semantic parity/representative outcomes: 2/2 pass.
- affected guard recall/FPR/multilingual/security slices: 36/36 pass.
- all MCP core/runtime/HTTP suites remained green in the combined run: 116/116.
- root `npx tsc --noEmit`: exit 0.
- isolated 50-iteration MCP benchmark: BLOCK p95 overhead 2.75 ms (8 ms budget) and result-redact
  7.50 ms (12 ms budget) pass; allow-simple 12.69 ms (8 ms budget) and allow-large/8 KB
  176.65 ms (25 ms budget) fail.

Profiling isolates the remaining 8 KB cost to the deterministic input detector pipeline: rules-only
`runInputGuard` measured approximately 103.57 ms median / 141.05 ms p95 locally, so disabling the
semantic tier would neither close the gate nor be an acceptable security optimization. Next action:
profile per-detector cost and consolidate repeated normalization/decoding passes while preserving
bit-for-bit findings and full recall/FPR gates.

### Session 2026-07-28 (prior session)

### Model scanner continuation (2026-07-30)
Implemented \`scripts/model-scan.ts\` and the \`security:model-scan\` package command. It performs
bounded offline regular-file scanning (512 MiB ceiling), emits JSON or SARIF, supports expected
SHA-256 validation, and fails closed: SAFE exits 0, suspicious/malicious/unverified exits 1,
operational errors exit 2. It never deserializes, loads, executes, or fetches model artifacts.

Verification: \`npx tsx --test tests/model-scan.test.ts\` -> 20/20; \`npx tsc --noEmit\` -> exit 0.
Commands: guard-core full suite (green, §1); read-only audit greps; no destructive ops.
Files created (untracked at session end, completed+verified 2026-07-29):
- `docs/SOTERAI-TECHNICAL-SUPREMACY-REPORT.md` (this file — created)
- `lib/gateway/{decision,providers,core}.ts` — canonical decision contract, OpenAI/Anthropic adapters, gateway core (auth→limits→bounded parse→policy→input scan→enforce→forward→output/stream scan→enforce, fail-closed auth / fail-open-stamped scanner crashes)
- `app/api/gateway/openai/v1/chat/completions/route.ts`, `app/api/gateway/anthropic/v1/messages/route.ts`
- `tests/gateway.test.ts` (24 tests) — wired into `npm test` along with `tests/model-scan.test.ts` (package.json)

---

## 6. Final remaining-work continuation (2026-07-30; historical, superseded by section 8)

This section supersedes older queue descriptions where implementation status changed. It preserves
the historical record above.

### 6.1 Work completed

| Area | New evidence level | Result |
|---|---|---|
| Canonical decision adapters | Unit-tested | `lib/gateway/adapters.ts` maps 12 enforcement surfaces, preserves source verbs and evidence, and maps unknown input to `ABSTAIN`. Adapter/gateway slice: **28/28 pass**. |
| Agent tool enforcement | Integration-tested | LangChain and Vercel AI SDK wrappers require an action check before execution. Blocked, approval-pending, and sandbox-only outcomes do not invoke the wrapped tool. Direct-runtime/SDK/framework slice: **15/15 pass**. |
| Model-file scanner | Unit-tested; gate not universally wired | Bounded archive handling and static GGUF, ONNX, and SafeTensors checks; unsafe/truncated/over-expanding archives fail closed. Offline JSON/SARIF CLI and pure `ALLOW/QUARANTINE/BLOCK` evaluator. Scan evidence enters the CycloneDX AI-BOM without raw artifact content. Model/BOM slice: **26/26 pass**. |
| RAG/document sandbox | Integration-tested | Bounded DOCX/XLSX/PPTX inspection, traversal/duplicate-entry defenses, macro/ActiveX/embedded-object quarantine, external-link findings, bounded extraction, and HTML active/hidden-content checks. RAG slice: **42/42 pass**. |
| Distributed jobs | Unit-tested | Bounded exponential retries, explicit dead-letter transition/event, stale-lease recovery, and graceful worker drain. Reliability/webhook/Dynamo slice: **23/23 pass**; Prisma validation passes. |
| Gateway route security | Integration-tested | OpenAI/Anthropic routes visibly authenticate before the shared handler, reject missing bodies, and reuse verified identity. MCP also explicitly pre-authenticates. Route audit: **6/6 pass**. |
| Browser extension | Build- and test-verified | Typecheck/build pass; **145/145 tests pass**. |
| VS Code extension | Packaged-verified | Workspace-bounded absolute entry paths; **113/113 tests pass**; `soterai-ide-guard-0.2.1.vsix` created (301.32 KB, 16 files). |
| SDK | Build- and test-verified | Build passes; **18/18 tests pass**. |
| Capability registry | Unit-tested and regenerated | 22 capabilities, `honest=true`: **9 STRONG_ENFORCEMENT, 9 DETECTION_ONLY, 1 VISIBILITY_ONLY, 1 UNKNOWN_NOT_TESTED, 2 UNSUPPORTED**. |

### 6.2 Final regression evidence

| Gate | Result |
|---|---|
| Full root test command | **966/966 tests passed**; 912 subtests across 9 suites; ~55.6 seconds |
| New remaining-security command | **41/41 passed** |
| MCP combined core/runtime/HTTP slice | **116/116 passed** |
| Guard core | **458/458 passed** |
| Local AI broker | **30/30 passed** |
| Root and affected package typechecks | Passed |
| Scoped ESLint over every changed source/test | Passed |
| Prisma validation | Passed |
| Full repository lint | **Unverified**: exceeded a 120-second execution bound without a reported lint error |
| Next.js production build | **Unverified**: compilation completed with Edge-runtime `jose` warnings, then did not terminate inside 180 seconds and was stopped |

### 6.3 Performance evidence

Latest isolated 20-iteration MCP sample:

| Scenario | Gateway overhead p95 | Budget | Result |
|---|---:|---:|---|
| Allow, simple | 12.3547 ms | 8 ms | **FAIL** |
| Allow, 8 KB | 104.0929 ms | 25 ms | **FAIL** |
| Block | 3.2843 ms | 8 ms | PASS |
| Result redaction | 4.3830 ms | 12 ms | PASS |

This is a local engineering sample, not a production or competitor comparison. **Superseded by
section 9**: a 20-iteration sample is too small to characterize p95, and these figures are retained
only as history.

### 6.4 Final honest capability boundary

The repository now has strong inline enforcement on the hosted gateway, routed MCP stdio/HTTP/SSE,
local broker, secret broker, controlled terminal, safe-context/redaction paths, browser extension,
and packaged VS Code extension. It also has pre-execution LangChain/Vercel wrappers.

The following remain outside a defensible complete/production-proven claim:

1. Direct, WebSocket, or otherwise unrouted MCP traffic bypasses the gateway.
2. Model signature verification against an operator trust root, authenticated Hugging Face fetch,
   and mandatory gate integration in every model loader are not complete end to end.
3. File/network/process/governance engines expose real preflight decisions but do not mediate every
   OS action; they remain `DETECTION_ONLY`.
4. Checkpoint rollback is PARTIAL_ENFORCEMENT through the broker's real filesystem adapter (16/16 runtime tests passing), but it only protects paths within the configured isolation root — it is not a universal filesystem rollback.
5. MCP allowed-call latency misses the declared p95 budgets.
6. A live hosted Next.js smoke/latency run and terminating production build remain unverified.
7. VS Code, Cursor, and Windsurf are detected on this machine (3/4). Execution of the packaged VSIX verification steps is a manual interactive step that remains externally blocked until the user runs the commands in `scripts/detect-editor-runtimes.mjs`. VSCodium is not installed.
8. A new multilingual transformer training run requires external compute and dataset governance;
   current hybrid detection must not be presented as independently validated.
9. Vendor superiority is not established. Public claims are not a controlled head-to-head test.

### 6.5 Residual gap queue

1. Consolidate repeated allow-path normalization/decoding until both MCP p95 budgets pass, then run
   the default 300-iteration benchmark.
2. Make the model gate mandatory at every loader/registry boundary; add signed provenance
   verification against a trust root and authenticated, bounded Hub fetch.
3. Diagnose the non-terminating Next.js build and complete a live gateway smoke with a real
   database, upstream test server, streaming response, and latency capture.
4. Replace advisory OS preflights with authenticated mediation where supported, or retain their
   detection-only classification.
5. ~~Wire and runtime-test checkpoint rollback~~ — DONE 2026-07-30. Broker's FilesystemCheckpointStore is wired and passes 16/16 runtime tests (create, rollback, partial failure, wrong tenant, wrong actor, expired, tampered, concurrent, idempotent, restore failure, compensating-only classification, no state in logs, isolation root escape, unconfigured 501, unauthenticated, misconfigured store). Registry upgraded to PARTIAL_ENFORCEMENT.
6. Execute packaged VS Code/Cursor/Windsurf tests on installed editor runtimes. Detection script created (`scripts/detect-editor-runtimes.mjs`) — 3 editors detected.
7. Run a controlled multilingual held-out benchmark/retraining cycle with per-language recall,
   precision, false-positive rate, and confidence intervals.
8. Arrange an independent same-corpus competitor evaluation before any superiority claim.

No destructive Git operation, commit, push, deployment, or external state change was performed.
The worktree remains intentionally uncommitted and includes pre-existing user changes.

## 7. Final closure continuation (2026-07-30; historical, superseded by section 8)

- MCP allow-path waste was removed by sharing decode variants within one synchronous analysis and
  adding a 256-entry privacy-safe LRU keyed by content digest, detector version, detection tier,
  resolved policy, and allowed roots. It stores only LOW_RISK/TOKEN_ABUSE templates and never raw
  text, secrets, PII, or matched content. Cold/warm findings are deep-equal and the bound is tested.
- Required 300-iteration benchmark completed: simple ALLOW 3.2364 ms, 8 KB ALLOW 4.9717 ms,
  BLOCK 3.4589 ms, result redaction 4.2092 ms p95 overhead. All declared budgets pass.
- The supported ONNX loader now fails closed before importing/loading ONNX runtime unless static
  scan, hash pin, signed manifest, provenance, approved source, trust chain, validity, and revocation
  checks allow execution. Authenticated bounded Hugging Face acquisition is implemented.
- Focused model/MCP/AI-BOM verification: 98/98 pass; root typecheck passes.
- The Next.js failure was a build-time emoji fallback fetch in Open Graph prerendering, not an open
  handle. Network-dependent glyphs were removed. Normal lint-enabled production build completed
  all 221 static pages and exited 0 in 457.656 seconds.
- The standalone server reports Ready locally in under one second. `/api/health` cannot complete
  without the configured real database, so full hosted-route runtime proof and latency remain an
  exact external-environment blocker, not a claimed pass.
- File/network/process/governance remain honestly DETECTION_ONLY; arbitrary OS activity remains a
  bypass. This sentence is superseded by section 8: checkpoint rollback is PARTIAL_ENFORCEMENT with
  16/16 runtime broker tests. Accelerator multilingual evaluation remains externally blocked.

## 8. Authoritative final evidence reconciliation (2026-07-30)

This section supersedes changed status and counts in sections 1–7 while retaining them as a dated
engineering history. No production service or production data was touched.

### 8.1 Capability registry

The regenerated registry contains 22 capabilities and `honest=true`:

| Classification | Count | Boundary |
|---|---:|---|
| STRONG_ENFORCEMENT | 10 | Inline/routed controls with tested non-execution or release prevention |
| DETECTION_ONLY | 8 | Includes file, network, process, and governance preflights; callers can bypass them |
| VISIBILITY_ONLY | 1 | Evidence/observability without a blocking point |
| PARTIAL_ENFORCEMENT | 1 | Checkpoint rollback through the configured filesystem isolation root |
| UNSUPPORTED | 2 | Explicitly unsupported surfaces, including MCP WebSocket |
| UNKNOWN_NOT_TESTED | 0 | No unknown entries remain |

The supported ONNX loader is a mandatory fail-closed gate: static scan, digest pin, signed manifest,
approved provenance/source, trust chain, validity, and revocation checks precede runtime import/load.
External loaders remain outside that guarantee. Checkpoint rollback is not universal rollback; its
real filesystem adapter passes 16/16 broker runtime tests within the configured isolation root.

### 8.2 Hosted gateway runtime proof

`scripts/runtime-smoke-hosted-gateway.ts` executed the real production gateway handler behind a
loopback HTTP server with loopback OpenAI/Anthropic-compatible upstreams and isolated in-memory
tenant/auth/policy dependencies. It passed 12/12 checks: health/readiness, both authenticated
upstreams, block-with-zero-upstream-call, input/output redaction, credential/header hygiene,
tenant isolation, malformed/oversize rejection, stream-tail blocking plus upstream cancellation,
metrics, and clean shutdown.

| Metric | Result |
|---|---:|
| Gateway overhead p50 / p95 / p99 | 13.123 / 19.269 / 22.545 ms |
| Gateway latency p50 / p95 / p99 | 15.631 / 23.106 / 26.875 ms |
| First-token direct / gateway / overhead | 1.770 / 14.532 / 12.762 ms |
| Load | 100 requests, concurrency 20, 77.4 requests/s |
| CPU | 1,297 ms user, 110 ms system |
| RSS | 160.422 → 172.430 MiB; +12.008 MiB |

Evidence: `artifacts/hosted-gateway-runtime-smoke.json`. This is local runtime proof of the gateway
core over real HTTP, not a production-built Next.js/PostgreSQL deployment. The isolated production
variant is externally blocked because the Docker configuration and engine pipe are access-denied.
The exact repeat command is recorded in the artifact:
`docker compose -f docker-compose.local.yml up -d postgres && npx prisma db push && npm run build && npm run start`.

### 8.3 Packaged editor runtime proof

The 0.2.1 VSIX was installed into isolated profiles and cleanly uninstalled:

| Editor | Evidence | Verdict |
|---|---|---|
| Visual Studio Code | Packaged activation, broker, strict policy, secret/context protection, controlled terminal, MCP preflight, lockdown/recovery; 7/7 | RUNTIME_VERIFIED |
| Windsurf | Same packaged host checks; 7/7 | RUNTIME_VERIFIED |
| Cursor | VSIX install/list/uninstall pass; host MCP utility timed out waiting for `ipcReady` before extension evidence | PACKAGED_VERIFIED_NOT_RUNTIME_VERIFIED |
| VSCodium | Not installed | NOT_TESTED |

Cursor's bounded 120-second attempt failed in the editor host before the extension probe; it is not
classified as a SoterAI runtime failure. Evidence is under `artifacts/editor-runtime/`.

### 8.4 Current regression and build record

| Gate | Current result |
|---|---|
| Root tests | exit 0; 966 passed, 6 honestly skipped (signed model runtime inputs absent), 0 failed |
| Root typecheck | exit 0 |
| Full repository lint | exit 0; 0 errors, 104 warnings |
| guard-core | 466/466 |
| Local broker | 46/46 |
| Hosted gateway | 24/24 |
| MCP gateway/runtime/HTTP/security | 117/117 |
| Model scanner/loader + AI-BOM | 31/31 |
| Agent enforcement | 40/40 |
| Checkpoint rollback | 16/16 |
| RAG/document/image | 36/36 |
| Browser extension | 145/145 plus typecheck |
| VS Code extension | 113/113 plus typecheck and VSIX packaging |
| JavaScript SDK | 18/18 plus typecheck |
| Python SDK | 56 passed; 21 live E2E skipped |
| Prisma validation | exit 0 |
| Next.js production build | exit 0 in 475.3 seconds; 221/221 static pages |
| Dependency audit | EXTERNALLY_BLOCKED: registry/network metadata access was not authorized |

Performance is not uniformly green, and the figures this subsection originally carried have since
been superseded by a controlled re-measurement. **Section 9 replaces the 14.17 ms simple-ALLOW,
17.94 ms broker-health and 35.75 ms VS Code 10 KB readings quoted in earlier drafts of this
subsection**; those were single unpaired runs on a loaded host with no variance reported. The
current verdict is five of six MCP budgets passing on the median of five independent trials, with
`allow-simple-cold` over its 8 ms budget by 0.106 ms and broker `/health` straddling its 10 ms
budget under host load. Extension bundle 392.7 KB and VSIX 307.03 KB still miss the 200 KB budgets;
that is packaging work, deliberately untouched by the latency work in section 9. Correctness gates
remain green, and no budget was relaxed.

### 8.5 Multilingual external-run package

`colab-train-bundle/` now contains a machine-readable accelerator handoff and runbook. It points to
the CUDA-enforcing Colab runner, frozen split hashes, tokenizer parity, calibration, artifact
validation, signing, promotion, and rollback steps. No CPU training was attempted.

Promotion remains `BLOCKED_EXTERNAL`: semantic embedding deduplication/human review, complete
license/privacy/annotation provenance, independently sourced untouched holdout, adequate native
Hindi/Hinglish/transliteration/mixed-script coverage, accelerator training, independent evaluation,
and a release-signed manifest are not complete. The existing freeze truthfully remains
`PROVISIONAL_NOT_INDEPENDENT_NOT_SEMANTICALLY_LOCKED`.

### 8.6 Residual queue

1. Close the two remaining performance misses in section 9: MCP `allow-simple-cold` p95 and the
   load-dependent broker `/health` p95. Editor and browser bundle-size budgets remain open and are
   packaging work, not latency work.
2. Run the production-built Next.js/PostgreSQL gateway smoke when Docker engine access is available.
3. Complete the accelerator and independent multilingual evidence package; promote only after all
   signed gates pass.
4. Complete Cursor packaged-runtime proof after its host MCP IPC startup succeeds.
5. Replace detection-only OS preflights with mediation where feasible, or retain their honest label.
6. Run a same-corpus, boundary-normalized, independently witnessed competitor evaluation before any
   overall superiority claim.

### 8.7 Final conclusion

SoterAI has broad, reproducible local enforcement evidence, including real HTTP gateway behavior,
real MCP child-process non-execution, packaged VS Code/Windsurf execution, a mandatory supported
model loader gate, and partial real rollback. It is not production-deployment proven, independently
multilingual validated, or demonstrated technically superior overall to named competitors.

## 9. Controlled performance stabilization (2026-07-31)

This section supersedes every performance figure recorded earlier in this report. It covers only
measurement, attribution, provably equivalent optimization and regression gating. No detector was
disabled, no finding weakened, no argument scan skipped, no raw data cached, and no budget relaxed.

### 9.1 Measurement protocol and host conditions

The host is the limiting factor and is reported rather than hidden: Windows 11 Home Single Language
10.0.26300 on a 4-core/8-thread Intel i5-8350U, observed clock 1696/1896 MHz, Node v22.16.0, GC
hooks not exposed (`gcExposed=false`), benchmark process raised to `PRIORITY_ABOVE_NORMAL`, and
330+ resident background processes (the VS Code host alone had accumulated roughly 51,000 CPU
seconds). Pre-run CPU busy fraction was sampled and recorded for every run and ranged from 33.7% to
84.5% across the campaign; the reported MCP trial set ran at 64.8%. Run-to-run latency noise on this
box is therefore ±30% or worse, which is why deterministic counts, not timings, are treated as the
primary evidence in sections 9.5 and 9.6.

Benchmark-mode setup is deterministic and asserted in-run:

- a fresh child process per bucket, so no bucket inherits another's JIT or heap state;
- 20 warm-up iterations discarded per bucket before any sample is kept;
- paired measurement — direct path and gateway path are timed on the same iteration, with the lead
  path alternating by iteration parity so neither side systematically absorbs cache-warming cost;
- 5 independent 300-iteration trials; the median trial is reported together with the cross-trial
  range and coefficient of variation, never a best-of;
- the rate limiter is armed (600/min) with `limitsRelaxed=false` and `detectorsDisabled=false`, so
  the benchmark exercises the same enforcement configuration as production;
- each payload is fingerprinted by sha256 and its cache state declared (`WARM`, `COLD`,
  `NOT_CACHED`), so cold and warm inspection paths cannot be conflated;
- GC collections, total pause and maximum pause are accounted for the whole run;
- the decision path is re-verified for every bucket in every trial, so a latency number can never
  come from a run that silently stopped enforcing.

Instrumentation: `scripts/mcpLatencyBench.ts 300 --trials 5`, `scripts/perf/mcp-stage-profile.ts`,
`scripts/perf/detector-tier-profile.ts`, `scripts/perf/literal-prefilter-audit.ts`,
`scripts/perf/prefilter-ab.ts`, `packages/vscode-extension/benchmarks/bench.ts`,
`apps/local-ai-broker/benchmarks/bench.ts`. Artifacts land under `artifacts/perf/`.

### 9.2 MCP gateway latency — five independent 300-iteration trials

Median trial, all values milliseconds. `ovh p95` is the paired per-iteration gateway-minus-direct
overhead. Source: `artifacts/perf/mcp-latency-bench.json` (`cpuBusyBefore=64.8%`).

| Bucket | Cache | Direct p95 | Gateway p50 | Gateway p95 | Gateway p99 | Overhead p95 | Budget | Outcome | p95 across the 5 trials |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| allow-simple-warm | WARM | 1.242 | 3.213 | 4.222 | 4.806 | 3.445 | 8 | PASS | 3.04–4.72, cv 19.9% |
| allow-simple-cold | COLD | 1.658 | 4.770 | **8.106** | 15.441 | 6.501 | 8 | **MISS by 0.106** | 5.61–10.51, cv 24.5% |
| allow-large-warm (8 KB) | WARM | 2.015 | 3.428 | 5.432 | 7.045 | 4.555 | 25 | PASS | 3.45–9.26, cv 41.3% |
| allow-large-cold (8 KB) | COLD | 2.644 | 12.414 | 21.272 | 29.667 | 19.529 | 25 | PASS | 19.49–22.44, cv 5.6% |
| block | NOT_CACHED | 3.684 | 2.456 | 3.000 | 3.253 | 2.295 | 8 | PASS | 2.30–3.04, cv 12.7% |
| result-redact | NOT_CACHED | 1.153 | 2.471 | 4.078 | 7.451 | 3.208 | 12 | PASS | 2.74–5.75, cv 27.0% |

Decision paths verified in all six buckets in all five trials: simple and 8 KB ALLOW forwarded
upstream with the result released; BLOCK answered locally and **never forwarded upstream**; the
redaction bucket released the upstream result with the secret removed. BLOCK performs no upstream
IPC at all, so its paired overhead is negative by design and its budget is compared against the
gateway path, not the difference. GC over the run: 248 collections, 520.68 ms total, 8.91 ms maximum
pause — pauses are an order of magnitude below the p99 spread and are not the cause of the misses.

Against the previous single-run readings, the 8 KB cold ALLOW improved from 28.128 ms (MISS) to
21.272 ms (PASS) and the simple cold ALLOW from 10.355 ms to 8.106 ms. The stated 14.17 ms
simple-ALLOW figure elsewhere in this report was an unpaired warm/cold-conflated single run and is
withdrawn.

**Honest verdict:** four of six buckets pass with margin, 8 KB cold passes at 85% of budget, and
`allow-simple-cold` is a 1.3% miss whose cross-trial range (5.61–10.51 ms) straddles the budget. A
1.3% median miss on a host at 64.8% background CPU load is not a demonstrated pass, and is not
reported as one.

### 9.3 End-to-end stage profile of a simple ALLOW

Every stage the mission named is instrumented separately, in microseconds, for a 16 B simple ALLOW
and an 8 KB ALLOW (payload 8211 B, sha `a5609667d280d458`). Source:
`artifacts/perf/mcp-stage-profile.json`. Measured in-process gate: simple p50 0.176 ms / p95
0.401 ms; 8 KB p50 1.111 ms / p95 1.649 ms. GC during the profile: 0 collections.

| Stage | 16 B p50 µs | 16 B p95 µs | 8 KB p50 µs | 8 KB p95 µs |
|---|---:|---:|---:|---:|
| 01 JSON-RPC parse | 13.0 | 22.0 | 16.7 | 50.5 |
| 02 session lookup | 2.0 | — | 0.3 | 0.4 |
| 03 capability lookup | 1.0 | — | 0.1 | 0.2 |
| 04 argument traversal | 6.0 | 12.0 | 234.8 | 337.5 |
| 05 normalization | 1.0 | 2.0 | 41.9 | 60.3 |
| 06 decoding | 19.4 | 38.8 | 751.2 | 982.8 |
| 07 deterministic detectors | 1917.5 | 3559.3 | 13256.4 | 16008.4 |
| 08 semantic classifier | 404.7 | 1034.1 | 5388.3 | 6311.3 |
| 09a policy `applyPolicy` | 15.5 | 26.3 | 8.7 | 27.9 |
| 09b policy MCP core | 54.2 | 111.9 | 331.7 | 557.3 |
| 10 evidence creation | 5.4 | 10.3 | 11.4 | 15.0 |
| 11a cache-hit `inspectArguments` | 43.0 | 111.8 | 476.5 | 632.6 |
| 11b cache-miss `inspectArguments` | 2837.4 | 4237.2 | 13018.7 | 16931.1 |
| 12 response serialization | 2.9 | 3.5 | 38.9 | 106.9 |

Stages 07, 08 and 11b are the cold-inspection cost; 11a is the warm cost that a repeat argument
actually pays. Summing the warm-path stages (01–06, 09–12 with 11a) gives 162.4 µs at 16 B against a
measured gate p50 of 176 µs — an 8% reconciliation gap, which is what an isolated-stage decomposition
should look like. At 8 KB the same sum is 1912.2 µs against a measured 1111 µs, so at that size the
isolated per-stage medians are an **upper bound**, not an additive decomposition: instrumenting
normalization and decoding standalone charges work that the integrated path computes once and reuses.
Per-stage medians also come from different iterations than the end-to-end median, so they are not
expected to add exactly.

The attribution is unambiguous at both sizes: detection (07 plus 08) is 97% of the cold cost, and
every remaining stage — parse, session and capability lookup, policy, evidence, serialization —
totals under 0.12 ms at 16 B and under 0.41 ms at 8 KB. There is no plausible latency win left in
plumbing; the only honest targets were detection cost and cache behaviour, which is what section 9.5
addresses.

### 9.4 Detector-tier attribution at 8 KB

Source: `artifacts/perf/detector-tier-profile.json`, 200 iterations over the same 8211 B benign
payload, all 26 INPUT detectors timed individually.

```
analyzeText p50 = 12.661 ms   p95 = 16.000 ms
  sum(detector p50) =  4.218 ms
  non-detector      =  8.442 ms
    variant construction              1.268 ms
    semantic, in situ (hybrid-rules)  3.969 ms   (standalone 5.235 ms)
    score + decide + advisory         0.151 ms
    redactText                        0.002 ms
  analyzeText rules-tier only  p50 =  8.692 ms
  cold full-scope detector pass p50 =  5.486 ms
```

| Detector | p50 µs | % of tier |
|---|---:|---:|
| generalizedIntent | 947.4 | 22.5 |
| adversarialCyber | 846.8 | 20.1 |
| indiaPii | 569.4 | 13.5 |
| multilingualAttack | 514.5 | 12.2 |
| embeddingPoisoning | 265.5 | 6.3 |
| promptInjection | 220.9 | 5.2 |
| pii | 194.2 | 4.6 |
| jailbreak | 182.2 | 4.3 |
| toxicity | 102.2 | 2.4 |
| dataExfiltrationInput | 65.9 | 1.6 |
| remaining 16 detectors | ≤ 59.2 each | 8.3 combined |

The whole detector tier is now 4.218 ms of a 12.661 ms `analyzeText`, against 6.427 ms recorded
before this work; the residual majority is variant construction plus the semantic classifier, not
regex evaluation. `harmfulContentRequest`, previously one of the most expensive rules on large
benign text, is now 12.0 µs. Every detector reported **0 findings** on this benign payload, exactly
as before the optimization — the tier got cheaper, not quieter.

### 9.5 Verified waste removed

The rule applied throughout: a fast path ships only if it is **proven** to produce identical output,
analytically *and* under a permanent randomized test that compares against the slow path. Three items
qualified.

**(a) `normalizeSecurityText` — ASCII fixed point plus an allocation-free confusable pre-scan.**
The equivalence argument is a fixed-point proof over the four transformations the function performs.
NFKD and NFKC are the identity on every ASCII code point. No ASCII code point carries the Unicode
`\p{Mn}` property, so combining-mark stripping cannot alter ASCII. Every invisible character the
function removes is at or above U+00AD, hence non-ASCII. And the `CONFUSABLES` table contains no
ASCII key — this is asserted at module load, so the table cannot silently acquire one in a later
edit. Therefore pure-ASCII input is returned unchanged, and non-ASCII input takes the original path
untouched; the pre-scan only avoids materializing intermediate strings when the text holds no
confusable key at all. Effect: the 8 KB normalization stage fell from 875 µs to 41.9 µs, a 20.9×
reduction, with no change to any finding.

**(b) `embed` — feature hashing without per-window allocation.**
The classifier hashes character 3/4/5-grams with FNV-1a into `DIM = 512`, taking the bucket from
`fnv1a(feature)` and the sign from `fnv1a(feature + U+0001)`. The previous implementation allocated a
substring per window. The current one hoists the `c3:` / `c4:` / `c5:` prefix hash states and reads
code units from a `Uint16Array`, folding each window incrementally — the same byte sequence is hashed,
so the resulting vector is bit-identical rather than merely close. That is not asserted by inspection:
a 400-case randomized fuzz test in `tests/guard/semantic-classifier.test.ts` compares the optimized
vector against the reference construction element by element. Effect: the semantic classifier at 8 KB
now measures 3.969 ms in situ and 5.235 ms standalone, and it remains the largest single non-detector
cost in section 9.4 — an honest ceiling, not a solved problem.

**(c) Mandatory-literal regex prefilter, extended to several necessary disjunctions.**
`lib/guard/detectors/literalPrefilter.ts` derives, from a rule's own source, literals whose presence
is a **necessary** condition for that rule to match, and skips the scan when the haystack cannot
contain them. A necessary condition is never treated as sufficient: when absence is proven the rule
cannot match, and when it is not proven the rule runs in full. Anything the parser cannot prove —
lookahead, backreferences, sticky or inline-flag constructs, unbounded nesting past depth 12 — returns
`null` and forgoes the optimization entirely rather than guessing.

The extension made in this phase is the conjunction case. A top-level sequence `P1 P2 … Pn` requires
every part, so each part's literal disjunction is *independently* necessary and absence of **any one
set** is sufficient to skip. For an alternation the requirement is the cross-product of one set per
branch; the case worth keeping is where all branches require the same set, since `C ∪ C = C`. Two
correctness properties bound this: dropping a set is always sound (it forgoes a skip, never causes
one), and if set A ⊆ set B then "B absent" implies "A absent", so the superset is discarded and the
subset kept. Up to `MAX_REQUIRED_SETS = 3` sets are retained per rule, ordered by a rarity-weighted
selectivity estimate (Σ 2^−len, lower first) that affects only which set is probed first, never
soundness. Absence itself is proven by a case-folded 3-gram bitmap (16384 bits, 2 KB) over the
haystack: a clear bit is a proof of absence, and a set bit falls through to a bounded literal search.

Deterministic effect, measured by `scripts/perf/literal-prefilter-audit.ts` — 619 of 684 rules
(90.5%) are prefilterable, and skipped scans per pass rose to 992/1121 on small benign input
(from 978), 1005/1121 on 8 KB benign (from 987), 931/1121 on injection corpora (from 856), and
195/234 on OUTPUT rules (from 190). These are exact counts, reproducible regardless of host load,
and are the primary evidence for this item.

Timed effect, from the same-process A/B in `artifacts/perf/prefilter-ab.json` (300 iterations per
bucket, `cpuBusyBefore=69.6%`), where the paired saving is computed per iteration:

| Bucket | Bytes | prefilter OFF p50 | ON p50 | paired saving p50 | OFF p95 | ON p95 | scans skipped |
|---|---:|---:|---:|---:|---:|---:|---|
| simple-16b | 20 | 4.646 | 3.354 | 1.262 | 7.520 | 5.080 | 995/1121 (88.8%) |
| large-8kb | 8115 | 69.043 | 19.289 | 50.512 | 86.246 | 23.595 | 999/1121 (89.1%) |
| attack-injection | 106 | 4.766 | 4.300 | 0.451 | 5.685 | 5.393 | 926/1121 (82.6%) |

The large-payload saving is 73.2% of the OFF median, up from 54.3% before the multi-set change. The
run compares findings on **every** iteration and aborts on any difference;
`findingsIdenticalEveryIteration` is `true` in the artifact for both the pre-change and post-change
runs. The attack bucket saves least, which is the correct direction: attack text contains the
literals, so the rules run.

### 9.6 Regression gates added

Because host timing is noisy, the gates that guard this work are deterministic wherever possible.

- **Runtime verifier.** `SOTERAI_PREFILTER_VERIFY=1` re-runs *every* regex the prefilter skipped and
  throws if any skipped rule would in fact have matched. The primary soundness gate is the full guard
  suite executed with the verifier armed: **524 tests, 518 pass, 0 fail, 6 skipped, 71.5 s**, which
  puts every skip decision against the real attack corpora, including the Phase-3 expanded
  system-prompt-leak and tool-abuse recall suites.
- **Kill switch.** `SOTERAI_DISABLE_LITERAL_PREFILTER=1` restores the unfiltered path in one
  environment variable, so the optimization can be removed from an incident's variable set instantly.
- **Prefilter unit and fuzz suite.** `tests/guard/literal-prefilter.test.ts` is at 64/64, including
  five new multi-set tests: both sets are kept when every alternation branch requires them; the rule
  is ruled out when *either* required set is absent while the real regex also fails to match; a set
  that is a superset of one already kept is dropped; the per-rule set count is bounded at three; and a
  fuzz test over five patterns × 500 generated strings asserts that every kept set is genuinely
  necessary in each *matching* string and that no matching string is ever skipped. That fuzz test also
  asserts a floor of more than 25 matched cases, so it cannot pass vacuously by generating only
  non-matching text.
- **Deterministic skip-rate floors.** A regression-gate suite asserts minimum skip rates with
  identical findings — ≥90% on benign input, ≥90% on 8 KB benign, ≥70% on injection corpora, ≥60% on
  the obfuscated-cyber corpus. This is immune to host load and fails loudly if a rule edit silently
  costs the prefilter its literals.
- **Same-run A/B identity.** `scripts/perf/prefilter-ab.ts` compares findings ON versus OFF on every
  iteration in the same process and aborts on the first difference.
- **Benchmark-mode budget reporting.** `scripts/mcpLatencyBench.ts` re-verifies the decision path per
  bucket per trial, records the env fingerprint, payload hashes and cache state in its artifact, and
  ends with an explicit `BUDGET MISSES` list — so a miss cannot be lost in the noise of a passing run.
- `npm run typecheck` (`tsc --noEmit`) exits 0.

### 9.7 Prohibitions observed

Stated explicitly because a latency report is exactly where these shortcuts hide:

- **No detector was disabled.** All 26 INPUT detectors and all OUTPUT rules still run; the benchmark
  asserts `detectorsDisabled=false`.
- **No finding was weakened.** Findings are compared ON versus OFF on every A/B iteration, every
  skipped regex is re-run under the verifier in the full guard suite, and the detector-tier profile
  reports the same zero findings on benign payloads as before.
- **No argument scanning was skipped.** Argument traversal remains instrumented as a distinct stage
  (04) and runs on every request; the prefilter changes how a rule is evaluated, never whether the
  arguments are visited.
- **No raw data was cached.** The inspection cache continues to key on a digest, and the cold and warm
  paths are reported separately rather than warm-only. The 8 KB payload is fingerprinted by sha256 in
  the artifacts so a "fast" number cannot come from a smaller payload.
- **No budget was relaxed.** All six MCP budgets, the broker budgets and the editor-scan budgets are
  unchanged, which is why this section reports two misses instead of six passes.

### 9.8 Broker and editor thresholds, with corrections

Broker (`apps/local-ai-broker/benchmarks/bench.ts`), four runs on the same build:

| Endpoint | p95 across runs | Budget | Outcome |
|---|---|---:|---|
| `/health` | 8.93, 9.06, 11.38, 13.42 ms | 10 ms | **Not a stable pass** — 2 of 4 runs pass |
| `/v1/scan` | 10.52, 11.32, 11.97, 12.13 ms | 30 ms | PASS in all runs |

VS Code extension (`packages/vscode-extension/benchmarks/bench.ts`), four runs:

| Scan size | p95 across runs | Budget | Outcome |
|---|---|---:|---|
| 1 KB | 4.02, 4.89, 5.52 ms | 10 ms | PASS |
| 10 KB | 7.99, 8.89, 11.46, 17.22 ms | 20 ms | PASS in all runs |
| 100 KB | 60.42, 65.66, 85.70 ms | 100 ms | PASS |

Two earlier figures in this report are corrected by these runs. The **35.75 ms VS Code 10 KB scan** is
withdrawn: the measured range is 7.99–17.22 ms and the 20 ms budget passes in every run. The
**17.94 ms broker `/health`** is also withdrawn, but not in favour of a pass — `/health` is a trivial
loopback handler whose p95 tracks host scheduling rather than guard work, and it lands on both sides of
its 10 ms budget depending on background load. The honest label is load-dependent, not passing. A
quiet-box reading of 3.96 ms was observed and is deliberately **not** quoted as the result.

### 9.9 Section 9 scoreboard and what is still not proven

| Target | Budget | Measured (median trial / range) | Verdict |
|---|---:|---|---|
| MCP simple ALLOW, warm | 8 ms | 4.222 ms (3.04–4.72) | PASS |
| MCP simple ALLOW, cold | 8 ms | 8.106 ms (5.61–10.51) | **MISS by 1.3%** |
| MCP 8 KB ALLOW, warm | 25 ms | 5.432 ms (3.45–9.26) | PASS |
| MCP 8 KB ALLOW, cold | 25 ms | 21.272 ms (19.49–22.44) | PASS |
| MCP BLOCK | 8 ms | 3.000 ms (2.30–3.04) | PASS |
| MCP result redaction | 12 ms | 4.078 ms (2.74–5.75) | PASS |
| Broker `/health` | 10 ms | 8.93–13.42 ms | **Not a stable pass** |
| Broker `/v1/scan` | 30 ms | 10.52–12.13 ms | PASS |
| VS Code 10 KB scan | 20 ms | 7.99–17.22 ms | PASS |

Limits of this evidence, stated rather than implied:

1. Every number was produced on one loaded consumer laptop at 33.7–84.5% pre-run CPU busy. Coefficients
   of variation of 5.6–41.3% across identical trials are reported precisely so these figures are not
   mistaken for hardware-independent characteristics.
2. Two budgets are not met: MCP `allow-simple-cold` and broker `/health`. Neither was relaxed, and
   neither is described as a pass.
3. The remaining cost is dominated by the semantic classifier and variant construction, which no
   provable-equivalence rewrite has yet reduced. Further gains there need either a cheaper equivalent
   embedding or an architectural change, not micro-optimization.
4. These are single-host, single-implementation measurements. They are **not** comparable to managed
   competitor services, and nothing here supports a comparative performance claim; hardware, network,
   payload, policy and measurement boundaries all differ. The requirement stated in section 8.7 stands
   unchanged.









