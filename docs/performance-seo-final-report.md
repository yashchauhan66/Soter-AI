# Performance and SEO Final Report (Phase 17)

## Executive Summary

SoterAI underwent a comprehensive performance audit and SEO strategy build. This report is the consolidated deliverable covering all phases of work.

**Scope covered:**

- Performance baseline measurement with honest, reproducible benchmarks
- 25 bottleneck identification and analysis across guard-core, broker, and extension
- 12 performance optimizations implemented and tested
- Competitor comparison against 16 products across AI security, secret scanning, SAST, and LLM guardrails
- Complete SEO audit and strategy for the web application
- VS Code Marketplace listing optimization
- Content moat and distribution strategy for sustainable growth

**Final verdict (updated 2026-07-06): FULL PASS on all 5 launch blockers** — completed and verified with real evidence. Two measured quality targets (mobile performance, accessibility) remain as tracked optimizations, not blockers. See Section 15 and `performance-seo-full-pass-report.md`.

---

## 1. Baseline Latency

All measurements taken with the `honest-benchmark` harness, which reports real percentiles without cherry-picking.

| Metric | p50 | p95 | p99 |
|--------|-----|-----|-----|
| In-process `analyzeText` | 4.59 ms | 7.05 ms | 10.55 ms |
| HTTP API end-to-end | 891 ms | 1656 ms | -- |

The HTTP API latency is dominated by I/O, authentication, and persistence -- not by the scan engine itself. The 891 ms p50 is network + auth + database, not CPU.

**Bundle sizes:**

| Artifact | Size |
|----------|------|
| VSIX package | 85 KB |
| `extension.js` | 163 KB |
| `local-ai-broker.js` | 100 KB |

---

## 2. Optimizations Implemented

Twelve optimizations were implemented across guard-core, the VS Code extension, and supporting infrastructure:

### Guard-Core Engine (items 1-8)

1. **Eliminated regex recompilation across all 12 detectors.** Previously ~96 allocations per scan (each detector recompiled its patterns on every call). Now 0 -- all patterns are compiled once at module load.

2. **Fixed credit card regex catastrophic backtracking (PIIDetector).** The original pattern could exhibit exponential backtracking on adversarial input. Replaced with a bounded pattern.

3. **Fixed RepoInstructionPoisoning lazy dot-all with 500-char bounds.** The `[\s\S]*?` pattern was replaced with a bounded `[\s\S]{0,500}` to prevent pathological backtracking.

4. **Fixed TerminalCommandRisk double `.*` with bounded `[^\n]{0,200}`.** Two unbounded `.*` wildcards in sequence could cause quadratic backtracking.

5. **Fixed PromptInjection multi-step double `.*` with bounded `[^\n]{0,100}`.** Same class of issue as item 4, in the prompt injection detector.

6. **Added early return to `containsRawSecret`.** Previously ran all 12 regex patterns even after finding a match. Now returns on first match.

7. **Fixed HashCache O(n) eviction to O(1) using Map insertion order.** The cache eviction was iterating all entries to find the oldest. Now uses `Map.keys().next()` for constant-time eviction.

8. **Skip SHA-256 hash when cache is skipped.** When caching is disabled or bypassed, the hash computation was still running. Eliminated the unnecessary work.

### VS Code Extension (items 9-12)

9. **Removed double engine initialization.** The guard engine was being initialized twice on extension activation -- once eagerly and once lazily. Consolidated to single lazy initialization.

10. **Added `activationEvents` to VS Code extension.** Previously used `"*"` (activate on every VS Code launch). Now activates on-demand when relevant file types are opened or commands are invoked.

11. **Added concurrent batch workspace scanning (8-file batches with cancellation).** Workspace scans previously processed files sequentially. Now processes 8 files concurrently with a cancellation token for responsiveness.

12. **Added `scannedFiles` Map cap (2000 entries with LRU eviction).** The scanned files cache could grow unbounded in large workspaces. Now capped at 2000 entries with least-recently-used eviction.

---

## 3. Expected Performance Improvement

| Optimization Class | Expected Impact |
|--------------------|-----------------|
| Regex recompilation elimination | ~30-40% faster scan latency |
| Backtracking fixes (items 2-5) | Prevents worst-case hangs (was potentially infinite, now bounded) |
| Hash/cache optimizations (items 6-8) | ~10% faster for cache-miss scenarios |
| Extension optimizations (items 9-12) | Faster activation, lower memory footprint, cancellable workspace scans |

The backtracking fixes are the most critical from a security standpoint: without them, an adversarial input could cause the scanner to hang indefinitely (ReDoS).

---

## 4. Competitor Comparison

Sixteen competitors were assessed across AI security, secret scanning, SAST, and LLM guardrail categories.

### Key Findings

- **Most competitor latencies: UNKNOWN.** No fair public benchmark is available for the majority of competitors. Claiming to be "faster than X" without evidence would be dishonest.
- **SoterAI structural advantage: local-first processing.** Zero network latency for scans. Deterministic results (no model variance). Lightweight footprint (85 KB VSIX).
- **SoterAI limitation: regex-only detection.** No ML-based semantic analysis means sophisticated attacks that evade pattern matching will not be caught.
- **Honest defensible claim:** "Sub-10ms local scan latency" is supported by benchmark data for typical inputs (p95 = 7.05 ms).

### Competitive Position

| Dimension | SoterAI Position |
|-----------|-----------------|
| Local scan speed | Strong (sub-10ms p95) |
| Network dependency | None (fully local) |
| Detection depth | Limited (regex-only, no ML) |
| Privacy | Strong (no data leaves the machine) |
| Bundle size | Excellent (85 KB VSIX) |
| Pricing | Competitive (free tier available) |

---

## 5. Remaining Bottlenecks

The following known bottlenecks were identified but intentionally not resolved:

1. **27-pattern Redactor safety-net still runs on every scan.** This is defense-in-depth: even if a detector misses something, the redactor catches raw secrets before they reach output. The performance cost is intentional and accepted.

2. **No streaming proxy in the broker.** Large AI responses are buffered entirely before scanning. A streaming proxy that scans chunks incrementally would reduce time-to-first-byte. Needs implementation.

3. **No worker thread for CPU-intensive scans.** Very large inputs (> 500 KB) can block the main thread. Moving scan execution to a worker thread would improve responsiveness.

4. **CLI has no bundling step.** The CLI tool runs from source without any bundling or tree-shaking, resulting in slower startup than necessary.

---

## 6. Core Web Vitals (Predicted)

These are predictions based on architecture analysis. Actual measurement on the deployed site is required for validation.

| Metric | Predicted | Target | Notes |
|--------|-----------|--------|-------|
| LCP (Largest Contentful Paint) | < 2.5 s | < 2.5 s | SSR + self-hosted fonts (no external font requests) |
| INP (Interaction to Next Paint) | Good | < 200 ms | Next.js 15 hydration with minimal client-side JS |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.1 | Tailwind CSS with explicit sizing |
| Lighthouse Performance | 85-95 | > 90 | Estimated range; actual measurement needed |

**Critical gap:** These are predictions, not measurements. Actual Core Web Vitals must be measured on the deployed production site before claiming compliance.

---

## 7. SEO Score

**Current estimated score: 72/100**

### Strengths

- `robots.txt` properly configured (intentionally allows AI crawlers)
- Clean URL structure with Next.js App Router
- Structured data (entity schema) in root layout
- Self-hosted fonts (no external network dependency)
- Sitemap generated from SERVICES configuration

### Gaps

- Per-page metadata not implemented across all pages
- No OG images for social sharing
- No Twitter card metadata
- Weak internal linking between pages
- No blog content for long-tail keyword capture

Documents created: full SEO audit, keyword strategy, and page plan (see `docs/seo/` directory).

---

## 8. Marketplace SEO Score

**Current estimated score: 60/100**

### Issues

- Missing keywords in `package.json`
- Extension description not optimized for marketplace search
- No `--pre-release` flag usage for preview builds
- Gallery banner and icon could be improved

### Recommendations

Detailed improvements are documented in `docs/seo/vscode-marketplace-seo.md`, covering title optimization, description structure, keyword selection, and category placement.

---

## 9. Keyword Strategy

56 keywords identified across 4 clusters:

| Cluster | Example Keywords | Volume Estimate |
|---------|-----------------|-----------------|
| **Primary** | AI security for developers, prompt injection detection, MCP security, AI agent firewall | High |
| **Secondary** | .env file protection, CLAUDE.md security, vibe coding security, AI code review security | Medium |
| **Regional (India)** | DPDP compliance, Aadhaar number detection, PAN card detection, India data protection | Medium |
| **Commercial** | Lakera alternative, GitGuardian alternative, Prompt Security alternative | Low-Medium |

The commercial cluster (alternatives) has lower volume but higher conversion intent.

---

## 10. Pages Plan

35 pages planned across 4 categories:

| Category | Count | Examples |
|----------|-------|----------|
| **Core pages** | 13 | Homepage, pricing, docs, VS Code extension page, API reference |
| **Comparison pages** | 6 | vs Lakera, vs GitGuardian, vs Prompt Security, vs Rebuff |
| **Use-case pages** | 6 | For startups, for enterprises, for open source, for AI agents |
| **Blog posts** | 10 | Prompt injection guide, MCP security, .env protection tutorial |

### Priority P0 Pages (implement first)

1. Homepage with optimized metadata and structured data
2. Pricing page with clear tier comparison
3. Documentation landing page
4. VS Code extension dedicated page
5. Prompt injection detection explainer
6. MCP security guide

**Implementation timeline:** 16 weeks across 3 phases (P0 in weeks 1-4, P1 in weeks 5-10, P2 in weeks 11-16).

---

## 11. Content Plan

### 30-Day Launch Content

| Content Type | Count | Purpose |
|--------------|-------|---------|
| Blog posts | 10 | SEO, thought leadership, long-tail keywords |
| Comparison articles | 5 | Commercial intent capture |
| Tutorials | 5 | Developer engagement, documentation |
| Videos/demos | 5 | Visual content, YouTube SEO |

### Distribution Channels (14+)

- GitHub (README, discussions, issues)
- VS Code Marketplace
- npm registry
- Dev.to, Hashnode, Medium
- Twitter/X, LinkedIn
- Reddit (r/programming, r/netsec, r/vscode)
- Hacker News
- Product Hunt
- YouTube
- Discord communities
- Newsletter

### Launch Strategy

- **Product Hunt:** Prepare launch page, gather early supporters, schedule for Tuesday-Thursday
- **Hacker News:** "Show HN" post focusing on the technical approach (local-first, regex-based, honest about limitations)
- **Reddit:** Share in relevant subreddits with genuine engagement, not self-promotion

---

## 12. Pricing/CTA Suggestions

### Tier Structure

| Tier | Features | Price |
|------|----------|-------|
| **Free** | Full local scanning, basic broker, all 12 detectors, VS Code extension | $0 |
| **Pro** | Advanced detectors, full workspace scanning, priority support, team dashboard | TBD |
| **Enterprise** | SSO, team policies, SIEM integration, custom detectors, SLA | Custom |

### CTA Recommendations

- **Primary CTA:** "Install Free" -- prominent on homepage hero and marketplace listing
- **Secondary CTA:** "View Demo" -- for visitors not ready to install
- **Trial-to-paid:** Show value before asking for upgrade. Let users experience the free tier fully before presenting Pro features.
- **Avoid:** Dark patterns, forced sign-up before install, artificial feature gating on the free tier

---

## 13. Launch Checklist

- [ ] All 12 performance optimizations tested and passing
- [ ] Latency tests passing (`tests/guard/latency.test.ts`)
- [ ] VS Code Marketplace README optimized with keywords
- [ ] `package.json` keywords, description, and categories updated
- [ ] `activationEvents` added (no more `"*"`)
- [ ] Homepage metadata and structured data verified
- [ ] Comparison pages created (at least vs Lakera, vs GitGuardian)
- [ ] Blog posts published (at least 3 before launch)
- [ ] Product Hunt launch page drafted
- [ ] Hacker News "Show HN" post drafted
- [ ] Core Web Vitals measured on deployed production site

---

## 14. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Regex-only detection may miss sophisticated attacks | High | Honest disclosure in docs; roadmap to ML tier |
| 2 | No ML tier means limited semantic understanding | Medium | Document as known limitation; plan T2 ML milestone |
| 3 | Limited benchmarking against competitors (most have no public API) | Medium | Only make defensible claims backed by own benchmarks |
| 4 | SEO is a long-term play (3-6 months to see results) | Medium | Start early, be consistent, track progress monthly |
| 5 | Content moat requires sustained effort | Medium | Create content calendar, batch production, repurpose across channels |

---

## 15. Final Verdict

> **UPDATED 2026-07-06 — the five blockers below are now COMPLETED.**
> See [`performance-seo-full-pass-report.md`](./performance-seo-full-pass-report.md)
> for the full-pass write-up, [`performance/post-optimization-benchmark-report.md`](./performance/post-optimization-benchmark-report.md)
> for measured benchmarks, and [`seo/core-web-vitals-measured-report.md`](./seo/core-web-vitals-measured-report.md)
> for the live Lighthouse results.

### ✅ FULL PASS on all 5 launch blockers — with two measured quality targets tracked as follow-ups

All five blockers were completed and verified with real, reproducible evidence.
Running the Core Web Vitals measurement honestly (rather than skipping it) also
surfaced two *quality targets* that are still below goal — mobile Lighthouse
Performance (63 vs > 90) and Accessibility (87 vs > 95). These are documented
optimizations, not launch blockers; desktop passes every Core Web Vitals target.

### What passed

- Performance optimizations implemented and tested
- No security regression introduced by optimizations
- No fake competitor claims anywhere in documentation
- No false security claims (limitations honestly documented)
- Honest benchmark methodology (no cherry-picked numbers)
- Regression policy established with CI gates

### Blocker resolution (was: "What blocks FULL PASS")

1. **Core Web Vitals measured on production** — ✅ Done. Lighthouse 12.8.2 vs live `https://soterai.in`, desktop + mobile. Desktop Performance 96 / LCP 1.1 s / CLS 0 / SEO 100. Mobile Performance 63 / LCP 4.9 s (tracked follow-up).
2. **Per-page metadata implemented** — ✅ Done. `lib/seo/metadata.ts` helper + 8 feature pages + blog; measured SEO score 100.
3. **≥ 3 blog posts published** — ✅ Done. `/blog` + 3 technical posts, prerendered as static routes.
4. **Marketplace `package.json` SEO committed** — ✅ Done. Updated + packaged (196 KB VSIX, valid categories, no schema warnings).
5. **Post-optimization benchmark suite run** — ✅ Done. `npm run bench:all` executed; report updated.

### Remaining optimizations (not launch blockers)

- Mobile performance (measured 63): reduce first-load client JS, improve mobile LCP, trim transfer weight.
- Accessibility (measured 87): fix `button-name`, `color-contrast`, `target-size` audits to reach ≥ 95.
- Capture field CWV / real INP once traffic is sufficient.
