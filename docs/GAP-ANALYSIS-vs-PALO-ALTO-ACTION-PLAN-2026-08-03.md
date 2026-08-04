# SoterAI vs Palo Alto — Deep Codebase Gap Analysis + Action Plan

**Date:** 2026-08-03 | **Method:** Direct codebase scan (lib/, scripts/, docs/, app/) cross-referenced against the 5 "immediate next steps" from `docs/SOTERAI-vs-PALO-ALTO-DEEP-COMPARISON-2026-08-03.md`.

**⚠️ KEY FINDING FIRST: 70% of the "gaps" are NOT code gaps — they are *witnessed evidence* gaps.** Aapka code already kaafi had tak implemented hai. What's missing vs Palo Alto is almost entirely: **(a) estate-wide discovery surface, (b) third-party witnessed/attested runs, (c) multi-instance production fleet proof.** Those are runbook/witness/test items more than feature items.

---

## 📊 HONEST GAP MATRIX

| # | Palo Alto Gap Item | Code Status | Verdict |
|---|-------------------|-------------|---------|
| **1** | Shadow-MCP/agent discovery + endpoint/fleet inventory | ⚠️ **PARTIAL** — `lib/shadow-ai/` (960 lines: provider risk scoring, shadow AI summary, MCP/plugin/SDK/tool detection), but no **estate-wide fingerprint-based fleet view** (that's Palo Alto's unmatched surface due to network position). | **PARTIAL — build fingerprint panel** |
| **2** | SSO/SCIM + central control plane + tenant governance | ✅ **FULLY IMPLEMENTED** — `lib/enterprise/saml.ts` (metadata parse, AuthnRequest, replay checks, JIT provisioning), `lib/enterprise/scim.ts` (SCIM 2.0 User/Group schemas, PATCH ops, tokens, tenant-scoped), `lib/enterprise/samlSessionExchange.ts`, `lib/enterprise/samlProvisioning.ts` (group→role SCIM mapping). Okta/Azure-AD/generic SAML all supported per `lib/identity-fabric/types.ts`. | ✅ **DONE — only needs witnessed live-IdP proof video + setup guide** |
| **3** | Third-party witnessed same-corpus benchmark | ⚠️ **PARTIAL** — Groundwork exists: `scripts/runExternalBenchmark.ts` (JailbreakBench/HarmBench ingestion ready), `scripts/eval/eval-heldout-blind.ts`, `scripts/guard-benchmark/_audit-*-2026-08-02.ts`, `scripts/perf/ml-load-harness.ts` (sustained load). What's missing: **witness/attestation layer** (log hashing, external co-signer, hardware/network capture) and running full 3rd-party JSONL corpora. | 🔴 **BUILD: witnessed-run harness + attestation JSON** |
| **4** | Multi-instance failover / DR / queue-outage simulation | ⚠️ **PARTIAL** — Reliability primitives exist (retry/DLQ/stale-lease/drain, Redis multi-instance warnings, backup/restore docs, RTO/RPO targets, K8s/Compose/health-checks, error budget). Per your own Phase-8 doc: "a production restore drill, RPO evidence, queue-outage sim are **still required**". The infra exists; the **executed, logged, timestamped drill evidence** doesn't. | 🔴 **BUILD: chaos/failover test scripts + run them + commit the reports** |
| **5** | Model security ecosystem (registry/CI/MLOps loaders) | ⚠️ **STRONG CORE** — `lib/model-scan/` (GGUF/ONNX/SafeTensors/Pickle, HuggingFace hub integration, signed manifest verification, provenance integrity, deployment gating) is genuinely strong. Missing: PyPI/nvcr.io fetch channels + CI/CD pipeline templates (GitHub Actions, GitLab CI, Jenkins,) + more loader coverage. | 🟡 **BUILD: CI templates + 2 more registries** |

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER (fastest path to closing)

Ordered by (impact ÷ effort). You already have 70%; these close the remaining 30%.

### **SPRINT A — Evidence & Witness Layer** (Gap 3, cheapest, highest credibility)
You don't need new features — you need your existing benchmark run under witness conditions and logged.

1. `scripts/benchmark/witnessed-run.ts` — wraps `runExternalBenchmark.ts` with:
   - Before/after environment hash (CPU, OS, Node version, dataset SHA-256)
   - Witness JSON: `{ timestamp, dataset_checksum, env_fingerprint, run_output_checksum, signable_hash }`
   - Hardware/network capture (OS, CPU model, GB RAM, egress IP for context — anonymize the IP)
   - Output: `artifacts/security/witnessed-run-<date>.json` + human-readable `.md`
2. Extend `scripts/generate-independent-validation-report.ts` — add `witnessed: true` flag and witness metadata block.
3. Add a `docs/security/witness-protocol.md` — who can witness, the 3-step verify command, public key for hash verification.

### **SPRINT B — Fleet Failover + Chaos Evidence** (Gap 4)
All the pieces exist; script the chaos and log it.

4. `scripts/chaos/provider-outage-sim.ts` — 4 scenarios:
   - `kill-redis` → verify rate-limits fail-closed (not silently in-memory) ✓ already warned in `lib/redis.ts`
   - `kill-worker` → pending jobs drain + resume
   - `db-restart` → graceful reconnect (Prisma middleware)
   - `upstream-timeout` → circuit opens, graceful degradation, alert fires
5. `scripts/chaos/multi-instance-smoke.ts` — docker-compose up 2 app instances + 1 Redis + 1 worker, run 100 requests through load-balancer while killing instance 1 mid-flight; verify zero dropped requests.
6. Commit outputs: `artifacts/security/chaos-<scenario>-<date>.json` with pass/fail per scenario.
7. Update `docs/security/backup-restore-plan.md` with actual drill evidence (executed dates + RTO/RPO actuals vs targets).

### **SPRINT C — Shadow Fleet Inventory Panel** (Gap 1, the only true product gap)
This is the one real feature build. `lib/shadow-ai/` already detects — what's missing is the **estate-wide fingerprint view** (what Palo Alto sees via network).

8. `lib/fleet-inventory/index.ts` — aggregates:
   - Which providers hit across which apps (from shadow-ai scan results)
   - MCP servers discovered (already detected — surface it as fleet list)
   - IDE/browser extension endpoints active
   - per-device last-seen, risk tier, policy state
9. Surface it: single dashboard page `app/admin/fleet/page.tsx`: table of every endpoint × provider × policy status × last-seen.
10. API: `app/api/v1/fleet/route.ts` — GET fleet inventory (org-scoped).

### **SPRINT D — Model Ecosystem Broadening** (Gap 5, medium effort)
11. Add PyPI Model Registry fetching alongside HuggingFace (existing `lib/model-scan/hub.ts` pattern).
12. CI/CD templates: `.github/workflows/model-scan.yml`, GitLab CI snippet, Jenkinsfile — each calls `soterai scan` CLI on model artifacts in a pipeline.
13. 1 more loader: Keras H5 (header sniff + ZIP/Pickle meta-scan — reuses existing zip/pickle modules).

---

## ✅ WHAT YOU CAN CLAIM TODAY (honestly, right now)

Because your SSO/SCIM IS done, add this to your competitive positioning immediately — it kills "gap 2" from being a Palo Alto advantage:

> "SoterAI ships enterprise SSO (SAML 2.0, Okta/Azure AD, JIT provisioning) and SCIM 2.0 user/group sync with group→role mapping — in the free self-host tier. Palo Alto offers this at six figures. Ours is open."

Add the setup guide (`docs/enterprise/okta-saml-setup-guide.md` already exists per `lib/enterprise/proofKit.ts`) and record a 2-min IdP setup walkthrough. **That single video converts gap 2 from a "Palo Alto win" into a "SoterAI parity + free" claim.**

---

## 🚫 WHAT YOU *CANNOT* FULLY CLOSE (honesty)

**Estate-wide passive network discovery.** Palo Alto's discovery advantage comes from being deployed at the network perimeter — they *see* traffic without instrumentation. You can't replicate that with an app-layer product, and shouldn't pretend to. Your positioning instead:

> "We're app-layer security. You install us *in the code* and we see what's happening at the guardrail. Palo Alto watches from the wire. Different products, different surfaces. For app-layer runtime defense, we're deeper — and you can read every rule."

That's honest AND it's why your 100%-recall benchmark actually means something more specific than theirs.

---

## 📅 EXECUTION TIMELINE

| Sprint | Effort | When |
|--------|--------|------|
| A (witness benchmark) | 1–2 days | This week — pure script+doc work, no new feature |
| B (chaos/failover evidence) | 2–3 days | Next week — write 2 scripts, run them, commit reports |
| C (fleet inventory panel) | 3–5 days | Week 3 — the only real feature build |
| D (model ecosystem) | 2–3 days | Week 4 |

After all 4: row 11 and 12 in your Palo Alto comparison move from "❌ Palo Alto" to "⚖️ parity+free / different surface" — that's the credibility flip.
