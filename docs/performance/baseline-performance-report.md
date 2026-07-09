# SoterAI IDE Guard -- Baseline Performance Report

**Date:** 2026-07-06
**Environment:** Windows 11 Build 26300, Intel Core i5-8350U @ 1.70 GHz (4C/8T), 16 GB RAM
**Node.js:** v22.16.0 | **VS Code:** 1.85+
**guard-core version:** 0.x (zero runtime dependencies, pure TypeScript)
**Measurement source:** honest-benchmark corpus (1218 samples: 108 attacks, 1110 benign)

---

## A. VS Code Extension

### A.1 Bundle Size

| Artifact | Size (bytes) | Size (human) | Budget | Status |
|----------|-------------|-------------|--------|--------|
| extension.js (esbuild) | 163,067 | 159 KB | < 200 KB | PASS |
| local-ai-broker.js (esbuild) | 101,771 | 99 KB | < 150 KB | PASS |
| VSIX package | 86,493 | 84.5 KB | < 150 KB | PASS |

### A.2 Activation Time (ESTIMATED)

Activation time cannot be measured without a VS Code test harness running
`vscode.extensions.getExtension(...).activate()` under instrumentation. The
estimate below is derived from static analysis of the `activate()` function in
`packages/vscode-extension/src/extension.ts`.

| Factor | Impact | Notes |
|--------|--------|-------|
| No `activationEvents` -- uses `"*"` | Loads on every VS Code startup, not on-demand | Extension contributes no activation trigger |
| All modules imported eagerly at top of extension.ts | ~10 synchronous top-level imports; no dynamic `import()` | state, telemetry, RiskTreeProvider, DashboardPanel, BrokerManager, PolicyStore, all command modules |
| Double `DecisionEngine` initialization | `ExtensionState` constructor calls `initEngine()`; then `activate()` calls `state.initEngine()` again | Two `PolicyEvaluator` + `HashCache` constructions thrown away |
| 76 commands registered synchronously | `registerCommands` (13), `registerFirewallCommands` (31), `registerBrokerCommands` (27), `registerScannerCommands` (7) | All handlers are closures allocated up-front; no lazy registration |
| 3 Tree View providers created | `RiskTreeProvider` x3 (project-risk, latest-findings, policy-status) | Each calls `registerTreeDataProvider` synchronously |
| 5 Status Bar items created and shown | statusBarItem, firewallStatusItem, brokerStatusItem, safeModeStatusItem, memoryStatusItem | All created, configured, and `.show()`-ed during activation |
| `BrokerManager` constructed | Constructor allocates event log array and reads configuration | Does not start the HTTP server during activation (deferred) |
| `DiagnosticsCollection` created at module scope | `vscode.languages.createDiagnosticCollection("soterai-guard")` in commands.ts | Runs at import time, before `activate()` is called |

**ESTIMATED activation time: 200-400 ms**

Reasoning: Each `registerCommand` call is ~0.1 ms (76 calls ~ 8 ms). Tree view
registration is ~1 ms each. Two full `DecisionEngine` constructions with
`HashCache` and `PolicyEvaluator` are ~2-5 ms each. The dominant cost is
synchronous module loading (all imports resolved before `activate()` body runs).
On cold startup with extension host loading, total activation likely exceeds
200 ms.

### A.3 Runtime Memory

| Resource | Lifecycle | Bound | Notes |
|----------|-----------|-------|-------|
| `scannedFiles` Map (ExtensionState) | Grows on every scan; never evicted | UNBOUNDED | Stores full `GuardDecision` objects per file path. In a 1000-file workspace scan, this holds 1000 decision objects indefinitely |
| `HashCache` (guard-core) | LRU-like with eviction | 5,000 entries max | Eviction is O(n) linear scan for oldest entry |
| Broker event log | Array with `.shift()` eviction | 1,000 entries | `Array.shift()` is O(n) per eviction |
| Status bar items | 5 items, permanent | Fixed | Negligible memory |
| Tree view providers | 3 providers, permanent | Fixed | Data refreshed on demand |

### A.4 Workspace Scan

Measured from static analysis of `scanWorkspaceRiskHandler` in
`packages/vscode-extension/src/commands.ts` (lines 135-163).

| Metric | Value | Notes |
|--------|-------|-------|
| Concurrency model | Sequential (`for...of`) | Each file awaited one at a time; no `Promise.all` or worker pool |
| Max files | 1,000 (configurable) | `soterai.scan.maxWorkspaceFiles` setting |
| Cancellable | No | `cancellable: false` passed to `withProgress` |
| File size limit | Per-file only (256 KB default) | `soterai.scan.maxFileSizeKb` checked per file |
| Estimated 1000-file scan time | ESTIMATED > 60 s | At p50 = 4.59 ms per scan + file I/O overhead |
| Progress reporting | Notification bar only | No per-file progress percentage or ETA |
| Error handling | Silent catch (empty block) | Individual file errors swallowed with `catch { }` |

### A.5 Auto-scan on Save

The extension registers `onDidSaveTextDocument` (extension.ts line 103) which
fires `soterai.scanCurrentFile` on every file save with scheme `"file"`. This
runs the full `DecisionEngine.scan()` pipeline (all detectors + redaction safety
net + hash computation) on every save regardless of file type or whether the
file has changed since the last scan.

---

## B. guard-core

### B.1 analyzeText Latency (honest-benchmark)

| Metric | p50 | p95 | p99 | min | max | avg | Sample Size | Notes |
|--------|-----|-----|-----|-----|-----|-----|-------------|-------|
| analyzeText (in-process) | 4.59 ms | 7.05 ms | 10.55 ms | -- | 325.50 ms | -- | 1,218 | Corpus: 108 attacks + 1,110 benign |

The 325.50 ms max outlier is attributable to regex backtracking on adversarial
input or JIT warm-up on the first sample. The p99 of 10.55 ms indicates the
long tail is compact for well-formed inputs.

### B.2 Detector Breakdown

| Detector | File | Pattern Count | Context(s) | Notes |
|----------|------|--------------|------------|-------|
| SecretDetector | `SecretDetector.ts` | 24 | all | Uses `runRegexDetectors` (shared util) |
| TerminalCommandRiskDetector | `TerminalCommandRiskDetector.ts` | 21 | terminal | Inline regex exec loop |
| AIGeneratedCodeRiskDetector | `AIGeneratedCodeRiskDetector.ts` | 18 | file, workspace, git | Uses `runRegexDetectors` |
| PromptInjectionLiteDetector | `PromptInjectionLiteDetector.ts` | 15 | prompt, selection | Inline regex exec loop |
| JailbreakLiteDetector | `JailbreakLiteDetector.ts` | 11 | prompt, selection | Uses `runRegexDetectors` |
| FileContextRiskDetector | `FileContextRiskDetector.ts` | 12 | file, workspace, git | Uses `runRegexDetectors` |
| RepoInstructionPoisoningDetector | `RepoInstructionPoisoningDetector.ts` | 8 | file, workspace | Inline regex exec loop |
| PIIDetector | `PIIDetector.ts` | 7 | all | Uses `runRegexDetectors` + Luhn validator |
| IndiaPIIDetector | `IndiaPIIDetector.ts` | 7 | all | Uses `runRegexDetectors` + UPI validator |
| OutputExfiltrationDetector | `OutputExfiltrationDetector.ts` | 6 | (via OutputLeakScanner) | Inline regex exec loop |
| MCPConfigRiskDetector | `MCPConfigRiskDetector.ts` | 6 | file, workspace | Uses `runRegexDetectors` |
| EnvFileDetector | `EnvFileDetector.ts` | 4 | all | Uses `runRegexDetectors` |
| **Total detector patterns** | | **~139** | | |

### B.3 Regex Allocation per Scan

Every detector call allocates new `RegExp` objects. In `runRegexDetectors`
(`packages/guard-core/src/detectors/utils.ts` line 90-91), `ensureGlobal()`
creates a new `RegExp(pattern.source, pattern.flags)` for every spec in every
call. Detectors with inline loops (PromptInjection, TerminalCommand,
RepoInstructionPoisoning, OutputExfiltration) also call
`new RegExp(spec.pattern.source, spec.pattern.flags)` per pattern.

For a full "file" context scan (SecretDetector + EnvFile + PII + IndiaPII +
FileContextRisk + AIGeneratedCodeRisk + RepoInstructionPoisoning + MCPConfigRisk),
the allocation count is: 24 + 4 + 7 + 7 + 12 + 18 + 8 + 6 = **~86 RegExp
objects per scan**. A "prompt" context scan adds PromptInjection (15) +
Jailbreak (11) = **~112 RegExp objects**.

### B.4 Redaction Pipeline

| Stage | Patterns | Runs When | Notes |
|-------|----------|-----------|-------|
| Position-based redaction (findings) | 0 (position arithmetic) | When findings have start/end | O(n) in findings count |
| REDACTION_RULES safety-net pass | 27 | ALWAYS (unconditional) | `Redactor.ts` lines 100-103: iterates all 27 rules via `String.replace()` |
| HIGH_RISK_SECRET_PATTERNS verification | 12 | After redaction (`findSurvivingSecrets`) | Used by `DecisionEngine.scan()` and `redactForSharing()` |
| **Total regex operations per scan+redact** | **~178** | | Detectors + safety-net + verification |

### B.5 collapseOverlappingMatches Complexity

`collapseOverlappingMatches` in `packages/guard-core/src/detectors/utils.ts`
(lines 55-70) uses a `kept.find()` call inside the main loop, making it
O(n * k) where n is sorted matches and k is kept matches. For typical scans
with < 20 matches this is negligible; for adversarial inputs with hundreds of
matches it could become measurable.

---

## C. Local AI Broker

All broker measurements require a running broker instance. These values are
ESTIMATED from code analysis of the HTTP server in the BrokerManager and the
`scanBrokerRequest` / `scanBrokerResponse` functions in
`packages/guard-core/src/BrokerScanner.ts`.

### C.1 Endpoint Latency (ESTIMATED)

| Endpoint | p50 (est.) | p95 (est.) | Bottleneck | Notes |
|----------|-----------|-----------|-----------|-------|
| GET /health | < 1 ms | < 5 ms | None | Simple JSON response, no computation |
| POST /v1/scan | 5-10 ms | 15-25 ms | `DecisionEngine.scan()` | Single-message scan + hash + redaction |
| POST /v1/chat/completions (proxy) | Provider-dominated | Provider + 50-100 ms | No streaming; full buffer required | Overhead = scan + redact + hash |
| POST /v1/messages (proxy) | Provider-dominated | Provider + 50-100 ms | No streaming; full buffer required | Same as above |

### C.2 scanBrokerRequest Analysis

`scanBrokerRequest` in `BrokerScanner.ts` (lines 72-147) performs the following
per request:

1. `joinMessages()` -- O(n) string concatenation of all messages
2. `hashContent(joined)` -- SHA-256 hash #1 of the full joined text
3. Per-message loop: `engine.scan(m.content)` for each message
   - Each `scan()` call internally calls `hashContent(content)` again (hash #2..N+1)
   - Total hashes = 1 (joined) + N (per-message) = N+1 hashes
4. `redactForSharing()` on each message (27-pattern safety net per message)
5. `findSurvivingSecrets()` on the re-joined redacted messages (12 patterns)
6. `matchCanaries()` on the joined text (if canaries configured)

For a 5-message request, this means 6 SHA-256 hashes and 5 full
redaction passes (135 regex replacements total).

### C.3 Resource Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Request body size | 1 MB | Default; configurable |
| Request timeout | 30 s | |
| Headers timeout | 15 s | |
| Event log | 1,000 entries max | `Array.shift()` eviction = O(n) |
| Connection pooling | None | New connection per upstream request |
| Streaming proxy | Not supported | Response fully buffered before scanning; no SSE/chunked passthrough |

### C.4 Sequential Multi-Message Scanning

When scanning a multi-message request, each message is scanned sequentially in
a `for...of` loop (`BrokerScanner.ts` lines 89-101). There is no parallelism
even though messages are independent. For a 10-message conversation, total scan
time is ~10x single-message scan time.

---

## D. CLI

### D.1 Cold Start (ESTIMATED)

| Metric | Value (est.) | Notes |
|--------|-------------|-------|
| Cold start | ESTIMATED > 500 ms | No bundling; tsc output loaded via Node.js module resolution |
| Module load | Loads full ide-common + guard-core dependency chain | No tree-shaking or dead-code elimination |
| File scan | Delegates to broker HTTP call | Adds HTTP round-trip latency on top of scan time |
| Streaming | Not supported | Full output buffered before display |

### D.2 File Scan via CLI

The CLI delegates scanning to the broker's HTTP API, meaning CLI scan latency =
broker overhead + `DecisionEngine.scan()` + HTTP round-trip. For the HTTP API
endpoint, the measured values from load testing are:

| Metric | p50 | p95 | p99 | min | max | avg | Sample Size | Notes |
|--------|-----|-----|-----|-----|-----|-----|-------------|-------|
| HTTP API (full stack) | 891 ms | 1,656 ms | 2,719 ms | -- | -- | -- | -- | Includes auth, rate limit, DB persistence, network |

These HTTP API numbers include authentication, rate limiting, and database
persistence overhead, so they are not directly comparable to the in-process
guard-core benchmarks. The in-process p95 of 7.05 ms vs HTTP p95 of 1,656 ms
indicates ~99.6% of the HTTP latency is infrastructure, not scan computation.

---

## E. HTTP API (Full Stack)

| Metric | p50 | p95 | p99 | Target p95 | Status | Notes |
|--------|-----|-----|-----|-----------|--------|-------|
| HTTP /api/guard/scan | 891 ms | 1,656 ms | 2,719 ms | < 750 ms | FAIL | Auth + rate limit + DynamoDB + Neon DB overhead |

The HTTP API significantly exceeds the p95 < 750 ms target. Root causes were
identified in prior analysis as primarily I/O-bound (database persistence and
authentication), not CPU-bound (guard-core scan computation).

---

## F. Summary of Key Findings

| Area | Status | Primary Concern |
|------|--------|-----------------|
| Bundle size | PASS | All artifacts well under budget |
| In-process scan latency | PASS (p95 < 25 ms target) | p95 = 7.05 ms is within budget |
| HTTP API latency | FAIL (p95 < 750 ms target) | p95 = 1,656 ms; dominated by I/O, not scan |
| Activation time | ESTIMATED FAIL | No activationEvents + double init + 76 eager commands |
| Memory management | CONCERN | Unbounded scannedFiles Map; O(n) cache eviction |
| Workspace scan | CONCERN | Sequential scanning; no cancellation; no progress |
| Regex allocation | CONCERN | ~86-112 RegExp objects per scan; recompiled every call |
| Redaction overhead | CONCERN | 27-pattern safety-net runs unconditionally even when no findings |
| Broker throughput | CONCERN | N+1 hashes per request; no streaming; sequential message scanning |

---

*Report generated 2026-07-06. Values marked ESTIMATED require runtime
instrumentation to confirm. All in-process measurements from honest-benchmark
corpus.*
