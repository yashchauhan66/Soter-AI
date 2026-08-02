# SoterAI — SOC2 Type-I Readiness Checklist

**Goal:** Close the "Enterprise Readiness" pillar (currently 2/20) — the single biggest lever to move composite 67 → ~77 and reach world rank #2. Date: 2026-08-02.

**Type-I = point-in-time proof that controls are *designed* correctly. You do NOT need a long observation window (that's Type-II).** SoterAI already has most of the technical controls coded; what's missing is **documentation, ownership and evidence packaging**.

---

## What SoterAI already has (mapped to SOC2 Trust Criteria)

| Trust criterion | Control | Existing evidence in repo |
|---|---|---|
| CC6.1 (logical access) | API-key authn, per-tenant authz | `lib/apiKeyMiddleware.ts`, `lib/auth/guards.ts`, cross-tenant fix F-01 |
| CC6.1 | SAML + SCIM SSO | pricing/enterprise page lists SAMLS + SCIM |
| CC6.7 (transmission) | Signed webhooks | `app/pricing` + webhook signing |
| CC7.1 (detection) | Audit events + metrics | `recordRequestMetric`, audit-event store |
| CC7.2 (monitoring) | Rate limiting, quotas | `app/api/guard/input/route.ts:38-72` (RPM + monthly quota) |
| CC7.3 (incident) | Dead-letter + retry + drain | broker job reliability suite |
| CC8.1 (change mgmt) | Full regression gate | 966/966 tests, capability registry CI |
| A1.2 (availability) | Health/readiness routes | `/api/health`, `/api/ready` |
| C1.1 (confidentiality) | PII redaction engine | `packages/soter-pii` (145 tests) |
| — honesty control | Public capability registry | `artifacts/security/capabilities.json` (`honest:true`) — a *differentiating* control few vendors have |

---

## Gap list — what must exist on paper before an auditor signs Type-I

| # | Gap | Why auditor asks | Effort | Owner |
|---|---|---|---|---|
| 1 | **Information Security Policy** doc | Root policy tying all controls | 1 day | You |
| 2 | **Access-control matrix** (roles × data) | Prove least-privilege is defined | 0.5 day | You |
| 3 | **Asset inventory** (repo, DBs, keys, endpoints) | Scope definition | 0.5 day | You |
| 4 | **Risk assessment** (top-10 + owner + mitigation) | CC3.x mandatory | 1 day | You |
| 5 | **Incident-response runbook** + one tabletop log | CC7.4 | 0.5 day | You |
| 6 | **Vendor/subprocessor list** | Already have `app/subprocessors` page → formalize | 0.25 day | You |
| 7 | **Change-management evidence trail** (PR + CI screenshot per change) | CC8.1 | ongoing | Auto (CI) |
| 8 | **Background-check / confidentiality NDA** for anyone with prod access | CC1.4/CC2.x | n/a if solo | You |
| 9 | **Data-retention & deletion policy** | Already have `app/data-retention` page | done ✅ | — |
| 10 | **Availability/uptime report** (`app/status`) | A1.1 | partial ✅ | — |
| 11 | **Compliance-as-code report** generated from `capabilities.json` (auto PDF/MD) | Turns your honesty registry into SOC2 control evidence — *unique* | 1 day | script |

**Realistic timeline:** items 1–11 ≈ **5–7 focused days** of documentation. Type-I audit itself via a CPA firm once docs exist. Cost in India: ~₹1.5–4L for Type-I.

---

## One move that turns compliance into a weapon

Generate the auditor's evidence **directly from `capabilities.json` + ledger** (compliance-as-code). You are the only tracked vendor whose control state is machine-readable. Ship `scripts/compliance/report.mjs` → outputs a signed Markdown/PDF listing every control, its enforcement level, known bypasses and test evidence. That single artifact answers most SOC2 control questions and simultaneously feeds your "signed decision receipts" gap (G3/G7).

---

## Bottom line for ranking

- SOC2 Type-I alone: Enterprise 2 → 12 → composite **67 → 77 → rank #2** (passes CP/Lakera + ties Cisco).
- Type-II (3–6 month observation): Enterprise 12 → 16+.
- + 1 witnessed production pilot: Prod-proven scale 1 → 6.

**Order:** (1) write the 11 docs (~1 week), (2) ship compliance-as-code report, (3) sign 1 pilot for uptime/scale evidence, (4) engage Type-I auditor.
