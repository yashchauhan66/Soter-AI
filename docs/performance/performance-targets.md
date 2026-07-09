# SoterAI IDE Guard -- Performance Targets

**Date:** 2026-07-06
**Phase:** Phase 2 Performance Optimization
**Applies to:** VS Code extension, guard-core, Local AI Broker, CLI, Web (SEO)

All targets are p95 unless otherwise noted. Targets marked "stretch" are
aspirational for Phase 3; targets marked "hard" are release-blocking.

---

## 1. VS Code Extension Targets

### 1.1 Activation

| Metric | Target | Max (hard) | Current (est.) | Status |
|--------|--------|-----------|----------------|--------|
| Activation time | < 100 ms | < 250 ms | ESTIMATED > 200 ms | FAIL (est.) |
| Startup network calls | 0 | 0 | 0 | PASS |
| Startup cloud calls | 0 | 0 | 0 | PASS |
| Commands registered during activate() | < 20 eagerly; rest deferred | -- | 76 eagerly | FAIL |
| Engine initializations during activate() | 1 | 1 | 2 | FAIL |
| Top-level synchronous imports | < 5 | -- | ~10 | FAIL |

**Requirements:**
- Add scoped `activationEvents` (e.g., `onCommand:soterai.*`, `onView:soterai-*`,
  `workspaceContains:.soterai/`) to replace `"*"` activation.
- Defer all command registration behind lazy wrappers that register the real
  handler on first invocation.
- Eliminate double `initEngine()` call (constructor + explicit call in activate).
- Use dynamic `import()` for heavy modules (BrokerManager, DashboardPanel,
  CanaryManager, VaultManager, LedgerStore) so they load on first use.

### 1.2 Command Response

| Metric | Target (p95) | Max (hard) | Notes |
|--------|-------------|-----------|-------|
| Small selection scan (< 10 KB) | < 100 ms | < 200 ms | Includes DecisionEngine.scan() + UI notification |
| File scan (< 256 KB) | < 200 ms | < 500 ms | Includes file read + scan + diagnostics update |
| Webview panel open (Dashboard) | < 300 ms | < 500 ms | HTML generation + webview creation |
| Memory Inspector open | < 300 ms | < 500 ms | Broker HTTP call + webview render |
| Clipboard copy (redacted) | < 150 ms | < 300 ms | scan + redactForSharing + clipboard write |

### 1.3 Bundle Size

| Artifact | Target | Max (hard) | Current | Status |
|----------|--------|-----------|---------|--------|
| extension.js | < 200 KB | < 300 KB | 159 KB | PASS |
| local-ai-broker.js | < 150 KB | < 200 KB | 99 KB | PASS |
| VSIX total | < 150 KB | < 250 KB | 84.5 KB | PASS |

### 1.4 Memory

| Metric | Target | Max (hard) | Notes |
|--------|--------|-----------|-------|
| Idle memory (extension host) | < 30 MB | < 50 MB | After activation, before any scan |
| After 1000-file workspace scan | < 80 MB | < 120 MB | Includes cached decisions |
| scannedFiles Map | Bounded to 500 entries with LRU eviction | -- | Currently unbounded |
| HashCache | 5,000 entries (current) | OK | Eviction must be O(1) not O(n) |

---

## 2. guard-core Targets

### 2.1 Scan Latency (In-Process)

| Input Size | Target (p95) | Max (hard) | Current (p95) | Status | Notes |
|-----------|-------------|-----------|---------------|--------|-------|
| 10 KB text | < 20 ms | < 40 ms | ~7 ms (bench avg) | PASS | Core detection only |
| 100 KB text | < 80 ms | < 150 ms | -- | UNTESTED | Needs dedicated benchmark |
| 1 MB text | < 500 ms | < 1,000 ms | -- | UNTESTED | Content truncated at 500 KB by default |
| Adversarial input (10 KB) | < 50 ms | < 100 ms | up to 325 ms | FAIL | Regex backtracking on crafted input |

### 2.2 Redaction Latency

| Input Size | Target (p95) | Max (hard) | Notes |
|-----------|-------------|-----------|-------|
| 10 KB text (redactText) | < 15 ms | < 30 ms | 27-pattern safety-net + position redaction |
| 100 KB text (redactText) | < 100 ms | < 200 ms | |
| 10 KB text (redactForSharing) | < 20 ms | < 40 ms | redactText + findSurvivingSecrets |
| 100 KB text (redactForSharing) | < 120 ms | < 250 ms | |

### 2.3 Hash Computation

| Input Size | Target (p95) | Max (hard) | Notes |
|-----------|-------------|-----------|-------|
| 10 KB text (SHA-256) | < 2 ms | < 5 ms | crypto.subtle.digest path |
| 100 KB text (SHA-256) | < 10 ms | < 20 ms | |
| 10 KB text (fallback 32-bit) | < 1 ms | -- | Fallback must not be used in production |

### 2.4 Regex Budget

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| RegExp allocations per scan | 0 (compile once at module load) | ~86-112 per scan | Must cache compiled RegExp at module scope |
| Total patterns per scan+redact | < 200 | ~178 | Acceptable; reduce duplicate patterns |
| Max backtracking steps per pattern | < 10,000 | Unbounded | Must add backtracking guards or rewrite patterns |

---

## 3. Local AI Broker Targets

### 3.1 Endpoint Latency

| Endpoint | Target (p95) | Max (hard) | Notes |
|----------|-------------|-----------|-------|
| GET /health | < 10 ms | < 25 ms | No computation; JSON response only |
| POST /v1/scan (10 KB body) | < 30 ms | < 60 ms | DecisionEngine.scan() + JSON parse/serialize |
| POST /v1/scan (100 KB body) | < 100 ms | < 200 ms | |
| Proxy overhead (excl. provider) | < 100 ms | < 200 ms | Scan + redact + hash + HTTP forwarding |
| POST /v1/chat/completions (5 msgs, streaming) | Provider latency + < 50 ms overhead | -- | Requires streaming proxy implementation |

### 3.2 Throughput and Stability

| Metric | Target | Max (hard) | Notes |
|--------|--------|-----------|-------|
| Concurrent requests (stable memory) | 50 | -- | No memory leak under sustained load |
| Memory under 50 concurrent requests | < 200 MB | < 500 MB | |
| Event log eviction | O(1) | -- | Replace Array.shift() with circular buffer |
| Timeout behavior | Fail closed (block) | -- | Never forward un-scanned content |
| Hash computations per N-message request | N (not N+1) | -- | Eliminate redundant joined-content hash |

### 3.3 Streaming Support

| Metric | Target | Notes |
|--------|--------|-------|
| SSE (Server-Sent Events) proxy | Supported | Scan incrementally or buffer first chunk |
| Chunked transfer encoding | Supported | |
| Time-to-first-byte (streaming) | Provider TTFB + < 100 ms | Must not wait for full response |
| Backpressure handling | Supported | Pause upstream if client is slow |

---

## 4. Workspace Scan Targets

### 4.1 Scan Performance

| Workspace Size | Target (p95) | Max (hard) | Current (est.) | Notes |
|---------------|-------------|-----------|----------------|-------|
| 100 files | < 5 s | < 10 s | ESTIMATED ~5-10 s | Sequential scan |
| 1,000 files | < 30 s | < 60 s | ESTIMATED > 60 s | Needs concurrency |
| 10,000 files | < 5 min | < 10 min | -- | Requires streaming + cancellation |

### 4.2 Required Features

| Feature | Target | Current | Status |
|---------|--------|---------|--------|
| Cancellation support | User can cancel mid-scan | `cancellable: false` | FAIL |
| Progress reporting | Per-file % complete + ETA | Notification only, no % | FAIL |
| Concurrency | 4-8 parallel file scans | Sequential (1 at a time) | FAIL |
| File size limit | Configurable, skip > limit | 256 KB default | PASS |
| Directory exclusions | Skip node_modules, .git, dist, etc. | Configurable via excludeGlobs | PASS |
| Incremental scan | Only re-scan changed files (hash-based) | Re-scans everything | FAIL |
| Binary file skip | Auto-detect and skip binary files | No detection | FAIL |

---

## 5. SEO / Web Performance Targets

### 5.1 Core Web Vitals

| Metric | Target | Good Threshold (Google) | Notes |
|--------|--------|------------------------|-------|
| Largest Contentful Paint (LCP) | < 2.5 s | < 2.5 s | Must be met on 75th percentile of page loads |
| Interaction to Next Paint (INP) | Good (< 200 ms) | < 200 ms | Replaces FID as of March 2024 |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.1 | No layout shifts from lazy-loaded content |

### 5.2 Lighthouse

| Metric | Target | Min (hard) | Notes |
|--------|--------|-----------|-------|
| Lighthouse Performance score | > 90 | > 80 | Mobile and desktop |
| Lighthouse Accessibility score | > 90 | > 85 | |
| Lighthouse Best Practices score | > 90 | > 85 | |
| Lighthouse SEO score | > 95 | > 90 | Entity schema, sitemap, meta tags already implemented |

### 5.3 Asset Loading

| Metric | Target | Notes |
|--------|--------|-------|
| Total page weight (initial load) | < 500 KB | Compressed; excluding images |
| Font loading | Local only (next/font/local) | No Google Fonts network calls (already enforced) |
| JavaScript bundle (first load) | < 200 KB compressed | Next.js code-split chunks |
| Images | WebP/AVIF with explicit width/height | Prevent CLS |
| Third-party scripts | 0 render-blocking | Defer or async all third-party |

---

## 6. Target Verification Matrix

Each target must be verified by an automated test or benchmark before the
performance optimization phase is considered complete.

| Target Area | Verification Method | Automation |
|-------------|-------------------|------------|
| Activation time | VS Code extension test with `performance.now()` wrapper | CI: `@vscode/test-electron` |
| Scan latency (in-process) | honest-benchmark with percentile output | CI: Jest benchmark suite |
| Scan latency (large input) | Dedicated 100 KB / 1 MB benchmark files | CI: Jest benchmark suite |
| Redaction latency | Dedicated benchmark with timed redaction calls | CI: Jest benchmark suite |
| Regex backtracking | Adversarial input corpus with timeout guards | CI: timeout-based regression |
| Bundle size | `stat` check on build artifacts | CI: size assertion |
| Workspace scan | Synthetic workspace with 100 / 1,000 files | Manual or CI integration test |
| Broker endpoints | k6 or autocannon load test against local broker | CI: load test script |
| Web vitals | Lighthouse CI or PageSpeed Insights API | CI: Lighthouse CI |
| Memory | `process.memoryUsage()` assertions | CI: memory profiling test |

---

## 7. Priority Order

Targets are prioritized by user-visible impact:

1. **P0 (Release-blocking):** Regex backtracking (adversarial p95), activation
   time max, scan latency max, fail-closed timeout behavior
2. **P1 (High):** Workspace scan cancellation, scannedFiles eviction, regex
   recompilation elimination, streaming proxy
3. **P2 (Medium):** Workspace scan concurrency, incremental scanning, event log
   O(1) eviction, hash deduplication
4. **P3 (Low):** CLI bundling, binary file skip, stretch latency targets

---

*Targets defined 2026-07-06. Review and update after Phase 2 implementation.*
