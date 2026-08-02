# SoterAI — Production Pilot Kit + Type-I Auditor Pack
Date: 2026-08-02 · Purpose: close the two remaining Enterprise-pillar gaps (0 production deployments, 0 certifications) to reach composite ~77 → world rank #2.

---

## A) Witnessed Production Pilot Kit (closes "0 deployments")

**Goal:** 1 real customer deployment, 30 days, witnessed metrics — converts self-reported to production-proven.

### Pilot scope (tight, low-risk)
- Surface: hosted gateway (OpenAI/Anthropic) + MCP stdio guard for the pilot customer's own AI app.
- Volume: ≤1M checks in 30 days. Onboarding <1 day (base_url swap per `anthropic-compatible-broker-setup` / gateway docs).
- Success SLA: enforcement uptime ≥99.5% · warm overhead ≤5ms p95 · 0 unresolved P0.

### What the witness (customer) signs
| Metric | Target | Source |
|---|---|---|
| Requests guarded | count | gateway audit log |
| Enforced BLOCK/REDACT decisions | count + 3 redacted samples | decision receipts |
| Warm p50/p95 enforcement overhead | ≤5ms | `recordRequestMetric` |
| Uptime | ≥99.5% | `/status` + uptime probe |
| Incidents | list + postmortem | runbook §5 |
| Pilot sign-off | quote + logo permission | customer |

### 30-day runbook
- W1: onboard (base_url swap + key), shadow/observe-only mode first 48h.
- W2: enforce ALLOW/REDACT/BLOCK live; baseline latency captured.
- W3: adversarial red-team day (use `benchmarks/soterai-public-benchmark` corpus on the tenant).
- W4: collect metrics, witness sign-off, produce pilot one-pager.

### Deliverable
`artifacts/pilot/<customer>-pilot-report-YYYY-MM.json` = the "production-proven scale" evidence the ranking model needs (+ Enterprise trust signal).

---

## B) Type-I Auditor Pack (closes "0 certifications")

**What an auditor needs in the folder:**
1. `docs/soc2/01-INFORMATION-SECURITY-POLICY.md`
2. `docs/soc2/02-to-11-CONTROLS-PACK.md` (access matrix, asset inventory, risk register, IR runbook, vendors, change mgmt, personnel, retention, availability, compliance-as-code)
3. `artifacts/security/soc2-control-report.md` (auto-generated control evidence, hash-stamped)
4. `artifacts/security/multilingual-eval-2026-08-02.json` + `scripts/eval/*` (repro evidence)
5. `benchmarks/soterai-public-benchmark/` (Docker + witness protocol)
6. CI proof of full regression gate (966/966) and policy "tests never weakened"

**Why this is strong:** controls are machine-readable (`capabilities.json honest:true`, 22 controls incl. 2 disclosed UNSUPPORTED). Most vendors cannot show an auditor a self-admitted bypass list — SoterAI can. That directly supports CC-series design-effectiveness.

**Engagement plan**
- Scope: Security (CC) + Confidentiality (C1) TSC for Type-I.
- Choose a CPA firm (India/West-CPA listing) — est ₹1.5–4L, 2–4 weeks from docs-ready → signed Type-I report.
- Prerequisites before engaging: 30-day pilot running (A1.1 availability evidence) = this pack Part A.

---

## C) Order of execution (checklist)
- [x] Compliance-as-code script (`scripts/compliance/report.mjs`) — DONE
- [x] 11 SOC2 docs (`docs/soc2/`) — DONE
- [x] Witness benchmark kit (Docker) — DONE
- [ ] Sign pilot customer → run 30-day kit (Part A)
- [ ] Generate pilot report artifact
- [ ] Engage Type-I auditor with Part B pack
- [ ] On Type-I: update ranking model → Enterprise 2→12, composite 67→77, rank #2
