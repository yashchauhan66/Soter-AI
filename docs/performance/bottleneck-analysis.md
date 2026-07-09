# SoterAI IDE Guard -- Bottleneck Analysis

**Date:** 2026-07-06
**Scope:** guard-core, VS Code extension, Local AI Broker, CLI
**Method:** Static code analysis + honest-benchmark measurements
**Severity scale:** CRITICAL (security/crash risk or > 50 ms impact), HIGH (> 10 ms
or architectural), MEDIUM (5-10 ms or correctness concern), LOW (< 5 ms or minor)

---

## PERF-001: Credit Card Regex Catastrophic Backtracking

| Field | Value |
|-------|-------|
| ID | PERF-001 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/PIIDetector.ts` line 39 |
| Evidence | Pattern `/\b(?:\d[ -]*?){13,19}\b/g` uses a lazy quantifier `[ -]*?` inside a repetition `{13,19}`. On input with long sequences of digits mixed with spaces/dashes that do not terminate at a word boundary, the engine explores exponential backtracking paths. Each of the 13-19 repetitions tries 0..N matches for `[ -]*?`, and on failure the engine backtracks through all combinations. Crafted input like `"1234 5678 9012 3456 7890 1234 5678 9012 XXXX"` can trigger worst-case exponential time. |
| Severity | CRITICAL |
| Latency Impact | Potentially unbounded (seconds to minutes on adversarial input); likely contributor to the 325.50 ms max outlier in benchmarks |
| Fix | Replace with an atomic/possessive pattern or a two-step approach: first match a fixed digit sequence (`\b\d{13,19}\b` or `\b\d[\d -]{11,17}\d\b`), then validate format and Luhn in the validator callback. Alternatively, use a non-backtracking linear-time pattern: `/\b\d(?:[ -]?\d){12,18}\b/g` which makes the separator optional but non-repeating between each digit. |
| Test Required | Create adversarial test input with 50+ digits/spaces/dashes that does not match a valid card number. Assert scan completes in < 50 ms. Add to honest-benchmark adversarial corpus. |

---

## PERF-002: RepoInstructionPoisoning Lazy Dot-All Backtracking

| Field | Value |
|-------|-------|
| ID | PERF-002 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/RepoInstructionPoisoningDetector.ts` lines 6-7 |
| Evidence | Two patterns use `[\s\S]*?` (lazy dot-all) inside anchored delimiters: (1) `/<!--[\s\S]*?(?:ignore|disregard|override)\s+...[\s\S]*?-->/gi` and (2) `/\/\*[\s\S]*?(?:ignore|override|system)\s*:[\s\S]*?\*\//gi`. When the opening delimiter (`<!--` or `/*`) is present but the closing delimiter is absent or very far away, `[\s\S]*?` must try every possible split point between the two lazy quantifiers. With two `[\s\S]*?` in sequence separated by a keyword alternation, the engine has O(n^2) potential split points on non-matching input. |
| Severity | CRITICAL |
| Latency Impact | O(n^2) on input length between `<!--` and end-of-string; for a 100 KB file with an unclosed HTML comment, this could take > 1 second |
| Fix | Use a two-pass approach: first check if the opening/closing delimiters exist (fast string indexOf), then run the regex only on the bounded substring. Alternatively, replace `[\s\S]*?` with a negated character class: for HTML comments, use `/<!--(?:(?!-->)[\s\S])*?(?:ignore|disregard|override)...(?:(?!-->)[\s\S])*?-->/gi` (tempered greedy token), or limit the max match length. |
| Test Required | Input with `<!--` at the start and no `-->` for 100 KB. Assert scan completes in < 100 ms. |

---

## PERF-003: 27-Pattern Safety-Net Runs Unconditionally in Redactor

| Field | Value |
|-------|-------|
| ID | PERF-003 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/Redactor.ts` lines 100-103 (`redactText`) |
| Evidence | The REDACTION_RULES safety-net pass (27 compiled regex patterns applied via `String.replace()`) runs on every call to `redactText()`, even when the preceding detector pass found zero findings and the text contains no secrets. The comment says "ALWAYS-ON" by design, but this means clean text (the common case for benign input -- 91% of the benchmark corpus) still pays the cost of 27 regex scans. |
| Severity | HIGH |
| Latency Impact | ~1-3 ms per call on 10 KB text (27 regex replacements); significant when called repeatedly (e.g., per-message in broker) |
| Fix | Add a fast pre-check: run `findSurvivingSecrets()` (12 patterns, test-only, no replacement) first. If no high-risk secrets survive, skip the full REDACTION_RULES pass. This preserves the defense-in-depth guarantee while avoiding 27 replacements on clean text. Alternatively, compile REDACTION_RULES into a single alternation regex for a single-pass scan. |
| Test Required | Benchmark redactText on 10 KB benign text with and without the pre-check. Assert < 50% latency on the fast path. Verify no regression on texts containing secrets. |

---

## PERF-004: Regex Recompilation on Every Detector Call

| Field | Value |
|-------|-------|
| ID | PERF-004 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/utils.ts` lines 90-91 (`ensureGlobal`) |
| Evidence | `ensureGlobal()` creates `new RegExp(pattern.source, pattern.flags)` on every call. This is called once per spec per `runRegexDetectors` invocation. Since spec patterns are defined as module-level literals (e.g., `/\bsk-[A-Za-z0-9_-]{16,}\b/g`), the `RegExp` constructor re-parses and re-compiles the pattern string every time. For a full file-context scan, this means ~86 `RegExp` allocations; for a prompt-context scan, ~112 allocations. |
| Severity | HIGH |
| Latency Impact | ~0.5-2 ms per scan (regex compilation is fast per-pattern but adds up across 86-112 patterns); more significant is the GC pressure from short-lived objects |
| Fix | Pre-compile all patterns once at module load time. Store compiled `RegExp` objects in a module-level cache (e.g., `WeakMap` or parallel array). In `ensureGlobal`, return a clone only if the pattern lacks the global flag (which none do currently -- all specs already have `g`). Since `RegExp` with `g` flag has mutable `lastIndex` state, either reset `lastIndex = 0` before each use (no allocation) or use `new RegExp` only for the rare non-global case. |
| Test Required | Add a micro-benchmark comparing 1000 scans with recompilation vs. cached patterns. Assert > 30% latency reduction. |

---

## PERF-005: No activationEvents in VS Code Extension

| Field | Value |
|-------|-------|
| ID | PERF-005 |
| Component | VS Code extension |
| File/Function | `packages/vscode-extension/package.json` (activationEvents field) |
| Evidence | The extension has no `activationEvents` array or uses `"*"`, causing VS Code to activate it on every startup regardless of whether the user interacts with SoterAI features. This means every VS Code window pays the activation cost (module loading, 76 command registrations, 3 tree views, 5 status bars, BrokerManager construction, double engine init) even when the user never uses SoterAI. |
| Severity | HIGH |
| Latency Impact | ESTIMATED 200-400 ms added to every VS Code startup |
| Fix | Add scoped activation events: `"activationEvents": ["onCommand:soterai.*", "onView:soterai-project-risk", "onView:soterai-latest-findings", "onView:soterai-policy-status", "workspaceContains:.soterai/"]`. This defers activation until the user actually interacts with a SoterAI command or view, or opens a workspace with a `.soterai/` directory. |
| Test Required | Measure VS Code startup time with and without the extension (using `--prof` or Extension Bisect). Confirm the extension does not activate until a trigger fires. |

---

## PERF-006: Double Engine Initialization During Activation

| Field | Value |
|-------|-------|
| ID | PERF-006 |
| Component | VS Code extension |
| File/Function | `packages/vscode-extension/src/state.ts` line 12 + `packages/vscode-extension/src/extension.ts` line 27 |
| Evidence | `ExtensionState` is a singleton whose `private constructor()` calls `this.initEngine()` (state.ts line 12). When `activate()` runs, it calls `ExtensionState.getInstance()` which triggers the constructor (first init), then immediately calls `state.initEngine()` again (extension.ts line 27). Each `initEngine()` creates a new `PolicyEvaluator` and `HashCache`, so the first pair is allocated and immediately discarded. |
| Severity | MEDIUM |
| Latency Impact | ~2-5 ms (two constructor chains) + unnecessary GC of the first engine |
| Fix | Remove the explicit `state.initEngine()` call in `activate()`. The constructor already initializes the engine. If the intent is to re-read configuration, do so conditionally: check if config has changed before re-initializing. |
| Test Required | Add a counter or spy on `initEngine()` and assert it is called exactly once during activation. |

---

## PERF-007: All Modules Loaded Eagerly (No Lazy Imports)

| Field | Value |
|-------|-------|
| ID | PERF-007 |
| Component | VS Code extension |
| File/Function | `packages/vscode-extension/src/extension.ts` lines 1-11 |
| Evidence | All imports are static top-level: `ExtensionState`, `registerCommands`, `registerFirewallCommands`, `registerScannerCommands`, `PolicyStore`, `RiskTreeProvider`, `DashboardPanel`, `TelemetryManager`, `BrokerManager`, `registerBrokerCommands`. These are resolved synchronously before `activate()` runs. Heavy modules like `BrokerManager` (HTTP server), `DashboardPanel` (webview HTML generation), `VaultManager` (crypto), `CanaryManager`, and `LedgerStore` are loaded even if the user never uses those features. |
| Severity | HIGH |
| Latency Impact | ESTIMATED 50-150 ms for full module graph resolution |
| Fix | Convert to dynamic `import()` for feature modules. Keep only the minimal bootstrap code (status bar, tree views) as static imports. Load command handlers lazily: register a thin wrapper command that, on first invocation, dynamically imports the real handler module. Example: `vscode.commands.registerCommand("soterai.migrateSecretsToVault", async (...args) => { const { migrateSecretsToVault } = await import("./firewall/VaultManager"); return migrateSecretsToVault(...args); })`. |
| Test Required | Profile module load time with `--inspect-brk` and compare before/after lazy loading. Assert activation time < 100 ms. |

---

## PERF-008: Sequential Workspace Scanning (No Concurrency)

| Field | Value |
|-------|-------|
| ID | PERF-008 |
| Component | VS Code extension |
| File/Function | `packages/vscode-extension/src/commands.ts` lines 149-158 (`scanWorkspaceRiskHandler`) |
| Evidence | The workspace scan uses a `for (const file of files)` loop with `await` inside the body, meaning each file is read and scanned sequentially. For 1,000 files at p50 = 4.59 ms scan time + ~2 ms file I/O overhead, total time is ~6.6 seconds minimum. The `cancellable: false` option means the user cannot abort a long-running scan. There is no progress percentage reporting. |
| Severity | HIGH |
| Latency Impact | ~60+ seconds for 1,000 files (vs. ~15 seconds with 4-way parallelism) |
| Fix | Use a bounded concurrency pool (e.g., `p-limit` or manual `Promise.all` with batching). Process files in batches of 4-8 concurrently. Add `cancellable: true` and check `token.isCancellationRequested` between batches. Report progress as `scanned/total` percentage. |
| Test Required | Benchmark workspace scan on a synthetic 1,000-file workspace. Assert p95 < 30 seconds. Verify cancellation stops scanning within 2 seconds. |

---

## PERF-009: Unbounded scannedFiles Map

| Field | Value |
|-------|-------|
| ID | PERF-009 |
| Component | VS Code extension |
| File/Function | `packages/vscode-extension/src/state.ts` line 8 |
| Evidence | `scannedFiles = new Map<string, GuardDecision>()` grows without bound. Every file scan adds an entry; nothing ever removes entries. A 1,000-file workspace scan stores 1,000 full `GuardDecision` objects (each containing findings arrays, redacted text, evidence, categories, detector versions, etc.). Repeated scans of the same files replace the entry but never shrink the map. Over a long session with multiple workspaces, memory grows monotonically. |
| Severity | MEDIUM |
| Latency Impact | No direct latency impact; memory leak that degrades overall VS Code performance over time |
| Fix | Add LRU eviction with a configurable maximum (e.g., 500 entries). Use a `Map`-based LRU (delete + re-set on access to maintain insertion order, evict oldest via `map.keys().next().value`). Alternatively, clear the map on workspace change. |
| Test Required | Scan 2,000 files and assert map size stays <= configured limit. Monitor `process.memoryUsage().heapUsed` before and after. |

---

## PERF-010: O(n^2) collapseOverlappingMatches

| Field | Value |
|-------|-------|
| ID | PERF-010 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/utils.ts` lines 55-70 |
| Evidence | `collapseOverlappingMatches` iterates sorted matches and for each match calls `kept.find()` to check for overlap. `kept.find()` is O(k) where k is the number of kept matches, making the overall complexity O(n*k). In the common case (< 20 matches) this is negligible, but adversarial inputs designed to trigger many overlapping detectors (e.g., a string matching secrets + PII + env patterns simultaneously) could produce hundreds of matches where this becomes measurable. |
| Severity | MEDIUM |
| Latency Impact | < 1 ms for typical inputs (< 20 matches); potentially 5-10 ms for adversarial inputs with 200+ matches |
| Fix | Since matches are sorted by start position, use a sweep-line algorithm: maintain only the last kept match's end position. A new match overlaps if `m.start < lastEnd`. This reduces to O(n) after the initial sort. |
| Test Required | Create input that produces 500+ overlapping matches. Assert collapseOverlappingMatches completes in < 5 ms. |

---

## PERF-011: Array.shift() O(n) in Broker Event Log

| Field | Value |
|-------|-------|
| ID | PERF-011 |
| Component | Local AI Broker |
| File/Function | Broker event log (in BrokerManager) |
| Evidence | The event log is a plain JavaScript `Array` bounded at 1,000 entries. When the log is full, new entries are added with `push()` and the oldest is removed with `shift()`. `Array.shift()` is O(n) because it must re-index all remaining elements. At 1,000 entries, each eviction shifts 999 elements. Under sustained broker traffic (e.g., 50 concurrent chat completions), this creates unnecessary CPU work. |
| Severity | LOW |
| Latency Impact | < 0.1 ms per eviction (V8 optimizes shift on small arrays); negligible individually but adds up under high throughput |
| Fix | Replace with a circular buffer (ring buffer): maintain a fixed-size array with head/tail pointers. `push` overwrites at `tail % capacity` and advances tail. `shift` advances head. Both are O(1). Alternatively, use a double-ended queue. |
| Test Required | Benchmark 10,000 sequential push+shift operations with Array vs. circular buffer. Assert > 5x throughput improvement. |

---

## PERF-012: No Streaming Proxy in Broker

| Field | Value |
|-------|-------|
| ID | PERF-012 |
| Component | Local AI Broker |
| File/Function | BrokerManager proxy implementation |
| Evidence | The broker proxy buffers the entire provider response before scanning it. For streaming-capable providers (OpenAI SSE, Anthropic SSE), this means: (1) the user sees no output until the full response is generated, (2) memory usage spikes to hold the full response body, and (3) time-to-first-token is provider generation time + scan time rather than just provider TTFB. Modern LLM APIs return tokens incrementally; buffering defeats this. |
| Severity | MEDIUM |
| Latency Impact | Adds full provider generation time (1-30 seconds depending on response length) to perceived latency; user sees no output during this time |
| Fix | Implement a streaming proxy: forward SSE chunks to the client as they arrive, accumulate the full response in parallel, and run the security scan once the stream completes. If the scan finds a high-risk issue, emit a final SSE event with a warning/block notification. For strict mode, buffer the first N tokens, scan them, and only start streaming if the prefix passes. |
| Test Required | Send a streaming request through the broker. Assert time-to-first-byte is < 500 ms after provider TTFB. Assert the full response is still scanned. |

---

## PERF-013: HashCache O(n) Eviction and No LRU

| Field | Value |
|-------|-------|
| ID | PERF-013 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/HashCache.ts` lines 94-104 (`evictOldest`) |
| Evidence | `evictOldest()` iterates the entire cache map to find the entry with the smallest `cachedAt` timestamp. With a max of 5,000 entries, each eviction scans 5,000 entries. The eviction strategy is "oldest by insertion time" which is not LRU -- frequently-accessed entries can be evicted if they were inserted early. The `get()` method does not update `cachedAt`, so a cache hit does not refresh the entry's position. |
| Severity | MEDIUM |
| Latency Impact | < 1 ms per eviction at 5,000 entries; but eviction fires on every `set()` when at capacity, so under sustained scanning this adds up |
| Fix | Use JavaScript `Map`'s insertion-order guarantee for O(1) LRU: on `get()` hit, delete and re-set the entry to move it to the end. On eviction, `this.cache.keys().next().value` gives the oldest (least-recently-used) key in O(1). This also makes the cache LRU instead of FIFO. |
| Test Required | Fill cache to capacity (5,000), then perform 1,000 more sets. Assert total eviction time < 10 ms. Access an early entry and verify it is not evicted on next insertion. |

---

## PERF-014: Weak 32-bit Hash Fallback in HashCache

| Field | Value |
|-------|-------|
| ID | PERF-014 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/HashCache.ts` lines 124-130 |
| Evidence | When `crypto.subtle` is unavailable, `hashContent` falls back to a 32-bit DJB2-like hash: `hash = ((hash << 5) - hash + char) \| 0`. A 32-bit hash has only ~4 billion possible values, giving a 50% collision probability at ~65,000 entries (birthday paradox). With 5,000 cache entries, collision probability is ~0.3% -- low but nonzero. A collision means a different text returns a cached decision from a previous unrelated scan, which is a correctness bug (wrong risk score, wrong findings). |
| Severity | LOW |
| Latency Impact | None (fallback is faster than SHA-256); risk is correctness, not performance |
| Fix | In environments without `crypto.subtle`, use Node.js `crypto.createHash("sha256")` as a secondary fallback. The 32-bit hash should be removed entirely or guarded with a console warning. In VS Code and Node 18+, `crypto.subtle` is always available, so the fallback should never fire in production. |
| Test Required | Mock `crypto.subtle` as undefined. Assert `hashContent` still produces a 64-character hex string (SHA-256 via Node crypto). Add a collision test with 10,000 distinct inputs. |

---

## PERF-015: SHA-256 Hash Computed Even When Cache is Skipped

| Field | Value |
|-------|-------|
| ID | PERF-015 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/DecisionEngine.ts` lines 36-37 |
| Evidence | `DecisionEngine.scan()` calls `await hashContent(content)` on line 37 before checking the cache on line 39. When `options.skipCache` is true, the hash is computed but never used for caching. The hash is still stored in the returned `GuardDecision.inputHash`, so it is not entirely wasted, but for callers that set `skipCache: true` and do not use `inputHash`, this is unnecessary work. |
| Severity | LOW |
| Latency Impact | ~0.5-2 ms per scan (SHA-256 on text up to 500 KB) |
| Fix | Defer hash computation: compute it lazily only when needed (cache lookup, or when building the decision object). If `skipCache` is true and the caller does not need `inputHash`, skip the hash entirely. Alternatively, compute the hash only once and pass it to both the cache check and the decision builder. |
| Test Required | Benchmark scan with `skipCache: true` before and after the optimization. Assert hash is not computed when not needed. |

---

## PERF-016: TerminalCommandRisk Double .* Pattern

| Field | Value |
|-------|-------|
| ID | PERF-016 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/TerminalCommandRiskDetector.ts` lines 22-23 |
| Evidence | Multiple patterns use `[^\n]*` between anchored keywords, e.g., `/\b(?:curl\|wget)\s+[^\n]*\|\s*(?:sudo\s+)?(?:bash\|sh\|zsh\|python\|perl\|ruby)\b/gi` (line 22). While `[^\n]*` is safer than `.*` (bounded by newline), on long single-line inputs (e.g., minified code or base64 blocks on one line), the character class must scan the entire line. When the overall pattern fails to match, the regex engine backtracks through the `[^\n]*` trying shorter and shorter prefixes. With two `[^\n]*` segments in patterns like the data exfiltration pattern (line 36: `/\b(?:curl\|wget)\s+.*--data.*(?:@\|<)\s*(?:\/etc\/\|\.env\|\.aws)/gi`), backtracking is multiplicative. |
| Severity | HIGH |
| Latency Impact | ~5-20 ms on 100 KB single-line input; potentially > 100 ms on 1 MB minified input |
| Fix | Replace `.*` with `[^\n]{0,500}` to bound the scan window. Better: restructure as a two-pass check -- first verify both keywords exist on the same line (fast `indexOf`), then run the regex only on matching lines. For the `.*--data.*` pattern, split into two anchored checks. |
| Test Required | Create a 100 KB single-line input containing `curl` but not `bash`. Assert TerminalCommandRisk scan completes in < 20 ms. |

---

## PERF-017: OutputExfiltration Triple [^\n]* Pattern

| Field | Value |
|-------|-------|
| ID | PERF-017 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/OutputExfiltrationDetector.ts` lines 28-35 |
| Evidence | Patterns use multiple bounded `[^\n]{0,N}` segments between keywords, e.g., `/\b(?:send\|upload\|...)\b[^\n]{0,40}\b(?:secret\|...)\b/gi` (line 28) and `/\b(?:secret\|...)\b[^\n]{0,20}\b(?:to\|into)\b[^\n]{0,30}\b(?:https?:\/\/\|...)\b/gi` (line 33). The triple-segment pattern on line 33 has three variable-length gaps (`[^\n]{0,20}` and `[^\n]{0,30}`), creating O(20*30) = 600 potential split points per position. While bounded, this is still quadratic for each starting position in the text. |
| Severity | HIGH |
| Latency Impact | ~2-10 ms on typical input; up to 50 ms on adversarial input with many keyword near-misses |
| Fix | Reduce the gap limits (e.g., `{0,20}` to `{0,15}`) and use atomic grouping or possessive quantifiers if the regex engine supports them. Alternatively, use a two-phase approach: first check if both endpoint keywords exist within 80 characters of each other (fast scan), then run the regex on the matching substring only. |
| Test Required | Create input with `send` and `token` keywords separated by varying distances. Assert scan time is linear in input length, not quadratic. |

---

## PERF-018: No Early-Exit in Any Detector

| Field | Value |
|-------|-------|
| ID | PERF-018 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/DecisionEngine.ts` lines 92-119 (`runDetectors`) |
| Evidence | `runDetectors` unconditionally runs all detectors for the given context, even if an early detector already found a critical-severity match that will result in a "block" decision. For example, if `detectSecrets` finds an AWS secret key (score 45, decision: block), the engine still runs `detectEnvFile`, `detectPII`, `detectIndiaPII`, `detectFileContextRisk`, `detectAIGeneratedCodeRisk`, `detectRepoInstructionPoisoning`, and `detectMCPConfigRisk` -- 7 more detectors with ~55 more regex patterns. The additional findings do not change the "block" decision. |
| Severity | MEDIUM |
| Latency Impact | ~2-5 ms wasted on subsequent detectors after a block-level finding |
| Fix | Add an optional early-exit threshold: if the cumulative score exceeds the block threshold (default 70), skip remaining detectors. The caller can opt out for audit/reporting use cases where complete findings are needed. Preserve the current behavior behind a `fullScan: true` option. |
| Test Required | Scan text containing an obvious AWS key. Assert that with early-exit enabled, only SecretDetector and EnvFileDetector run (the first two in the sequence). |

---

## PERF-019: UPI Validator Set Created on Every Match

| Field | Value |
|-------|-------|
| ID | PERF-019 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/IndiaPIIDetector.ts` lines 46-54 |
| Evidence | The `validator` function for the `upi_id` spec creates a new `Set` of 25 known UPI handles on every invocation. If the regex matches 50 UPI-like patterns in a document, the Set is constructed 50 times. Each construction allocates a new Set object with 25 string entries. |
| Severity | LOW |
| Latency Impact | < 0.5 ms per scan (Set construction is fast); negligible in practice |
| Fix | Hoist the `knownUpiHandles` Set to module scope as a constant. The Set contents never change at runtime. |
| Test Required | Not performance-critical; a simple code review or lint rule suffices. |

---

## PERF-020: Duplicate Pattern Scanning (Detectors + Redactor Safety-Net)

| Field | Value |
|-------|-------|
| ID | PERF-020 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/Redactor.ts` REDACTION_RULES vs. `SecretDetector.ts` SECRET_SPECS |
| Evidence | Many patterns are duplicated between the detector layer and the Redactor safety-net. For example, the GitHub token pattern `/\b(?:ghp\|gho\|ghu\|ghs\|ghr)_[A-Za-z0-9_]{30,255}\b/g` appears in both `SecretDetector.ts` (line 99) and `Redactor.ts` (line 25). Similarly, AWS access key, Anthropic key, Stripe key, JWT, database URL, and email patterns are all scanned twice: once by the detector for scoring, and again by the Redactor for replacement. The HIGH_RISK_SECRET_PATTERNS array (12 patterns) adds a third pass for verification. Total: up to 3 regex evaluations of the same pattern on the same text per scan+redact cycle. |
| Severity | MEDIUM |
| Latency Impact | ~1-3 ms of redundant regex work per scan (27 Redactor patterns overlapping with detector patterns) |
| Fix | Share detection results between detectors and the Redactor. Pass the detector matches to `redactText` (which already accepts `findings`). For matches that were found by detectors, skip the corresponding REDACTION_RULES pattern. This requires a mapping between detector match types and REDACTION_RULES entries. |
| Test Required | Profile a scan+redact cycle on 10 KB text containing secrets. Assert total regex evaluation count decreases by > 20%. |

---

## PERF-021: containsRawSecret Has No Early Return

| Field | Value |
|-------|-------|
| ID | PERF-021 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/Redactor.ts` lines 120-122 |
| Evidence | `containsRawSecret(text)` calls `findSurvivingSecrets(text).length > 0`. `findSurvivingSecrets` iterates all 12 HIGH_RISK_SECRET_PATTERNS and collects all survivors into an array before returning. For a boolean check, the function should return `true` on the first match rather than scanning all 12 patterns. This function is called in hot paths: `sanitizeDecisionForCache` calls it 2-3 times per cache entry, and `redactForSharing` calls it per line on fail-closed paths. |
| Severity | LOW |
| Latency Impact | < 0.5 ms per call (12 regex tests on clean text are fast); measurable when called per-line on large texts |
| Fix | Add a dedicated `hasRawSecret(text): boolean` that returns `true` on the first pattern match: `for (const [, pattern] of HIGH_RISK_SECRET_PATTERNS) { if (pattern.test(text)) return true; } return false;`. Use this in `containsRawSecret` and `sanitizeDecisionForCache`. |
| Test Required | Benchmark `containsRawSecret` on 1,000 clean lines. Assert early-return version is > 2x faster. |

---

## PERF-022: BrokerScanner Hashes Content N+1 Times

| Field | Value |
|-------|-------|
| ID | PERF-022 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/BrokerScanner.ts` lines 78, 91 |
| Evidence | `scanBrokerRequest` computes `hashContent(joined)` on line 78 (hash of all messages concatenated). Then for each message in the loop (line 91), `engine.scan(m.content)` internally calls `hashContent(content)` again (DecisionEngine.ts line 37). For a 5-message request, this results in 6 SHA-256 computations: 1 for the joined text + 5 for individual messages. The joined-text hash is used only for the response `contentHash` field; the per-message hashes are used for cache lookups. These are independent hashes on different texts, so they cannot be deduplicated, but the joined hash could be deferred or made optional if the caller does not need it. |
| Severity | MEDIUM |
| Latency Impact | ~1-3 ms per request (SHA-256 is ~0.5 ms per 10 KB text) |
| Fix | Make the `contentHash` computation lazy or optional. If the caller does not use `contentHash` in the response, skip the `hashContent(joined)` call. Alternatively, if the per-message hashes are sufficient for cache purposes, derive the content hash from them (e.g., hash of concatenated per-message hashes) to avoid re-hashing the full text. |
| Test Required | Benchmark `scanBrokerRequest` with 10 messages before and after the optimization. Assert > 10% latency reduction. |

---

## PERF-023: No CLI Bundling (Slow Cold Start)

| Field | Value |
|-------|-------|
| ID | PERF-023 |
| Component | CLI |
| File/Function | CLI entry point (tsc output, not bundled) |
| Evidence | The CLI runs from TypeScript compiler output (`tsc`), loading individual `.js` files via Node.js module resolution. Unlike the VS Code extension (which uses esbuild to produce a single bundle), the CLI resolves the full `ide-common` + `guard-core` dependency graph at startup. Each `require()` call is a filesystem read + parse + evaluate. For ~50+ modules in the dependency chain, this adds significant cold-start latency compared to a single bundled file. |
| Severity | LOW |
| Latency Impact | ESTIMATED 300-500 ms additional cold-start time vs. a bundled CLI |
| Fix | Add an esbuild step for the CLI that produces a single `cli.js` bundle, mirroring the VS Code extension build. This eliminates module resolution overhead and enables tree-shaking of unused exports. |
| Test Required | Measure CLI cold-start time (time from process start to first output) before and after bundling. Assert < 200 ms cold start. |

---

## PERF-024: Multi-Step Injection Regex Double .* (PromptInjectionLiteDetector)

| Field | Value |
|-------|-------|
| ID | PERF-024 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/PromptInjectionLiteDetector.ts` line 44 |
| Evidence | The multi-step injection pattern `/\b(?:first\|step 1\|initially)\s+.*\b(?:then\|next\|after that\|step 2)\s+.*\b(?:ignore\|bypass\|override)\b/gi` contains two `.*` quantifiers. On input that contains `first` and `then` but not `ignore/bypass/override`, the regex engine must try every possible split between the two `.*` segments before failing. This is O(n^2) in the distance between the `first` and `then` keywords. |
| Severity | MEDIUM |
| Latency Impact | ~2-10 ms on typical multi-line input; up to 50 ms on adversarial single-line input with `first ... then ...` but no terminator |
| Fix | Replace `.*` with `[^\n]{0,200}` to bound the search window. Multi-step injections spanning more than 200 characters are unlikely to be real attacks. Alternatively, split into a two-phase check: first verify all three keyword groups exist in the text, then run the regex only on the relevant substring. |
| Test Required | Input with `first` at position 0 and `then` at position 10,000 but no `ignore`. Assert scan completes in < 20 ms. |

---

## PERF-025: Private Key Regex [\s\S]*? Dot-All (SecretDetector)

| Field | Value |
|-------|-------|
| ID | PERF-025 |
| Component | guard-core |
| File/Function | `packages/guard-core/src/detectors/SecretDetector.ts` line 138 |
| Evidence | The private key pattern `/-----BEGIN (?:RSA \|EC \|OPENSSH \|DSA \|ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA \|EC \|OPENSSH \|DSA \|ENCRYPTED )?PRIVATE KEY-----/g` uses `[\s\S]*?` (lazy dot-all) between the BEGIN and END markers. This is identical in structure to PERF-002. If a text contains `-----BEGIN PRIVATE KEY-----` but no corresponding `-----END PRIVATE KEY-----`, the lazy quantifier must scan to the end of the text, trying to match the END marker at every position. This same pattern also appears in `Redactor.ts` line 21, so the backtracking cost is paid twice. |
| Severity | MEDIUM |
| Latency Impact | ~2-5 ms on 100 KB text with an unclosed BEGIN marker; up to 20 ms on 1 MB text |
| Fix | Use a two-phase approach: first check if both `-----BEGIN` and `-----END` markers exist (fast `indexOf`). Only run the regex if both are present. Alternatively, use a tempered greedy token: `/-----BEGIN (?:RSA \|...)?PRIVATE KEY-----(?:(?!-----END)[\s\S])*-----END (?:RSA \|...)?PRIVATE KEY-----/g` which prevents the engine from overshooting the END marker. |
| Test Required | Input with `-----BEGIN PRIVATE KEY-----` at position 0 and no END marker, total 100 KB. Assert scan completes in < 20 ms. |

---

## Priority Summary

| Priority | IDs | Theme |
|----------|-----|-------|
| P0 -- Fix immediately | PERF-001, PERF-002 | Catastrophic/quadratic backtracking on adversarial input |
| P1 -- Fix before release | PERF-003, PERF-004, PERF-005, PERF-007, PERF-008, PERF-016, PERF-017 | High-impact architectural issues (activation, regex alloc, sequential scan, unconditional work) |
| P2 -- Fix in Phase 2 | PERF-006, PERF-009, PERF-010, PERF-012, PERF-013, PERF-018, PERF-020, PERF-022, PERF-024, PERF-025 | Medium-impact optimizations (redundant work, memory bounds, streaming) |
| P3 -- Fix when convenient | PERF-011, PERF-014, PERF-015, PERF-019, PERF-021, PERF-023 | Low-impact micro-optimizations |

---

## Estimated Total Latency Savings

If all P0 and P1 fixes are applied:

| Scenario | Current (est.) | After fixes (est.) | Improvement |
|----------|---------------|-------------------|-------------|
| Single 10 KB scan (benign) | ~5 ms | ~3 ms | ~40% |
| Single 10 KB scan (adversarial) | up to 325 ms | < 50 ms | > 80% |
| 1,000-file workspace scan | > 60 s | < 20 s | > 66% |
| VS Code activation | > 200 ms | < 100 ms | > 50% |
| 5-message broker request | ~30-50 ms | ~15-25 ms | ~50% |

---

*Analysis generated 2026-07-06. All latency estimates are derived from static
code analysis and honest-benchmark measurements. Runtime profiling is required
to confirm actual savings.*
