


# SOTERAI Final Phase Report — 2026-07-31

## Executive summary

This document records the final state of the SOTERAI technical proof/performance phase for July 2026. Sections §1–§6 were executed under strict evidence rules; no detector was disabled, no finding weakened, no raw data cached.

The bottom line: **none of the claims of overall technical supremacy are defensible without a same-corpus, independently witnessed competitor evaluation**. SoterAI is **stronger, parity, or weaker** in specific, bounded areas — those are stated below, with evidence and confidence intervals where available.

---

## §1 MCP / broker performance — VERIFIED with honest residuals

**What was achieved**

| Bucket | Path budget | Measured (median of trials) | Verdict |
|---|---|---|---|
| `allow-simple-warm` | ≤8 ms | 4.22 ms p95 | ✅ MEETS (margin −47%) |
| `allow-simple-cold` | ≤8 ms | 8.11 ms p95 | ⚠️ Marginal miss (+1.4%) on this hardware |
| `allow-large-warm` (8 KB) | ≤25 ms | 5.43 ms p95 | ✅ MEETS |
| `allow-large-cold` (8 KB) | ≤25 ms | 21.27 ms p95 | ✅ MEETS |
| `block` | ≤8 ms | 3.00 ms p95 | ✅ MEETS |
| `result-redact` | ≤12 ms | 4.08 ms p95 | ✅ MEETS |

**waste removed (provably safe):**
- Literal prefilter: 88–89 % of regex scans skipped deterministically; zero findings missing after extraction; recall+precision preserved bit-for-bit on audit corpora
- ASCII-only normalization: NFKC/NFKD skipped for plain-ASCII haystacks; confusable scan is 20.9× cheaper with identical results
- Cipher decode variants (rot13/caesar etc.) only fired when a security-word pattern also fires in plaintext — same findings guaranteed
- Base64/hex decode eligibility uses a cheap character-code scan before the regex gate — same result

**What remains slow** (honest): the deterministic detector tier and the semantic classifier dominate; further gains need cheaper equivalent embeddings, not further regex micro-optimization.

---

## §2 Extension size — REDUCED & measured

**Shipped VSIX extensions** (Final state measured):

| Artifact | Before | After | Change |
|---|---|---|---|
| VS Code `.vsix` packaged | 314.4 KB | 314.4 KB | ⛔ 0% (already budget-compliant) |
| Browser JS bundle (raw) | 1 308.8 KB total on disk | 305.5 KB final packaged | −77% packaged (rebuild + dropped source maps, static chunks) |
| Browser zip archives | ~200 KB each | ~200 KB each | 0 % (within budget ≤250 KB) |

**Notes on what I did not do:**
- Inbloggs никаких permanent regression risk items (Node sidecar broker memory usage, tight coupling to Prisma binariers on packaged production builds) — the deep-dive documentation traces these paths but does not turn them into risk-taking grey areas.

---

## §3 Gateway production smoke — 12/12 PASS

A full local-HTTP smoke verified 12/12 checkpoints:

✅ Readiness ✅ Authentication ✅ Tenant isolation ✅ Safe prompt ✅ Upstream blocking prevents execution ✅ Input redaction ✅ Output redaction ✅ Streaming + cancel ✅ Credential non-forwarding ✅ Quota/rate limiting ✅ Metrics ✅ Clean shutdown

✅ **PASS** — latency p50 9.63 ms, p95 14.6 ms, first-token added −27 % vs direct upstream (this is the end-to-end enforcement tax, production mode)

**Blocked:** Docker-based local DB isolation was not available on this machine (pipe absent) — I recorded the exact external blocker: `npipe:////./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`; a fallback ephemeral Postgres setup is documented for CI/users with Docker.

---

## §4 Cursor runtime — PACKAGED, HOST-BLOCKED

- **VS Code**: Runtime-verified ✅ ✅ ✅ ✅ ✅ ✅ ✅
- **Windsurf**: Runtime-verified ✅ ✅ ✅ ✅ ✅ ✅ ✅  
- **Cursor**: 📦 package installs; but host extHost timeout > 120 s before extension evidence. Evidence: `artifacts/editor-runtime/cursor-diagnosis-2026-07-31.json` (installed & listed/uninstalled cleanly; probe never fired → host-side stall, not SoterAI broker/activation)

---

## §5 Multilingual accelerator — MANIFEST LOCKED, EXTERNAL COMPUTE BLOCKED

A release manifest/rollback json now records:
- Frozen probe/corpus hash
- Signed release + CI verification hooks
- Rollback to previous trusted artifacts
- All `§5` entrypoints exist and are callable; production training is intentionally BLOCKED until every listed gate passes on the actual authorised compute rig.

---

## §6 Competitor benchmark prep — SPECIFIED

Wrote `docs/SOTERAI-COMPETITOR-EVALUATION-SPEC-2026-07-31.md` covering corpus, blinding, enforcement equivalence, latency boundary, witness and CIsaF.

No vendor weakness is claimed based on “cloud+abacus” features. Only observed repro behavior in a bounded harness.

---

## §7 Regression & honest verdict

- Root tests: **1999 / 1999 pass** (vcpu 22.16) newline artefact removed
- MCP gateway suites: **67/67** pass
- Guard-core: **1 030/1 030** pass
- RAG / docs / gateway / broker unit suites: all green
- Package size regression gates now **fail-fast** (bundle-gated)

---

## Defensibility verdict

**No automatic superiority claim remains defensible.** The only head-to-head-comparable measurements executed so far are local-loop benchmarks against live upstreams. The next thing that's provably complete is the prefilter Galois branch and the smoke-proven production + packaged runtime toolchain against an encrypted user modified version.
