# ISO/IEC 42001 (AI Management System) Readiness — SoterAI

**Status:** Self-assessment — **readiness**, NOT certification.
**Date:** 2026-07-17

> SoterAI is **not** ISO/IEC 42001 certified. This document is an honest internal
> readiness assessment. ISO/IEC 42001:2023 is the first certifiable AI-management-
> system (AIMS) standard; in 2025–26 it has moved from "nice to have" to an RFP
> line item for AI vendors selling into regulated enterprises. Certification
> requires an accredited external auditor and cannot be self-declared. Public
> pages must say **"ISO 42001 readiness"** — never "certified" — until a
> certificate exists.

## Why this matters

ISO 42001 is the AI-specific analogue of ISO 27001. Where SOC 2 / ISO 27001
attest to *information security*, ISO 42001 attests that an organization runs a
governed, risk-managed lifecycle for the **AI systems themselves** — the exact
question an enterprise buyer of an AI security product now asks. See the sibling
gap analysis [`soc2-iso-readiness-gap-analysis.md`](./soc2-iso-readiness-gap-analysis.md)
for the security-controls track.

## What already exists in the product (evidence, not aspiration)

SoterAI already ships a framework-mapped control catalog that references ISO
42001 clauses directly:

- **`lib/compliance/assurance.ts`** — `AI_CONTROL_CATALOG` maps six AI controls
  (runtime I/O protection, data governance, human oversight, data management,
  monitoring/incident, performance evaluation) to ISO 42001 clauses alongside
  EU AI Act Articles and NIST AI RMF functions.
- **Evidence vault** (`lib/evidence-vault`) — hash-verified, typed evidence
  records (POLICY, GUARD_DECISION, etc.) that back each control with runtime
  proof rather than assertions.
- **Runtime guard decisions** — every input/output decision is logged and
  retained (see `docs/security/data-retention-policy.md`), which is the raw
  operating-effectiveness evidence an AIMS audit samples.

This means the *technical* substrate for an AIMS (documented controls + tamper-
evident evidence) is materially further along than a typical pre-audit vendor.

## ISO 42001 clause-by-clause readiness

| Clause | Requirement | Current state | Gap to close |
|---|---|---|---|
| 4. Context | Scope of the AIMS, interested parties | **Partial** | No written AIMS scope statement |
| 5. Leadership | AI policy, roles, accountability | **Partial** | AI policy not formally signed off by leadership |
| 6. Planning | AI risk assessment + risk treatment, AI objectives | **Partial** | Risk assessment exists informally; needs formal AI-risk register + treatment plan |
| 7. Support | Resources, competence, awareness, documented info | **Partial** | Competence/awareness records not formalized |
| 8. Operation | AI risk assessment in operation, AI system impact assessment | **Strong (technical)** | Control catalog + evidence vault cover this; needs documented AI System Impact Assessment (Annex B) |
| 9. Performance evaluation | Monitoring, internal audit, management review | **Partial** | Monitoring exists (guard metrics); no internal-audit cadence or management-review minutes |
| 10. Improvement | Nonconformity, corrective action, continual improvement | **Partial** | No formal corrective-action log |

## Annex A controls (ISO 42001) — coverage sketch

| Annex A theme | Have | Gap |
|---|---|---|
| Policies for AI | Detection policy, retention policy, data-handling policy | Consolidated AI policy document |
| Internal organization / roles | RBAC (`lib/auth/rbac.ts`), approval gates | Documented AI-governance roles (RACI) |
| Resources for AI systems | Model registry (`lib/ml/registry.ts`), dataset provenance | Documented data/compute/tooling resource inventory |
| Impact of AI systems | Guard decision logging, blast-radius module | Formal per-feature AI System Impact Assessment |
| AI system lifecycle | Training pipeline, rollout modes (SHADOW/PARTIAL/FULL), eval | Documented lifecycle SOP + release gates |
| Data for AI systems | Redaction-before-persistence, hard-negative dataset curation | Signed data-governance policy |
| Information for interested parties | `/trust`, `/privacy`, honest benchmark report | Model cards per shipped model |
| Use of AI systems | Usage governance module, per-provider policy | Documented acceptable-use policy for the AIMS |

## Required before a real ISO 42001 certification

1. **AIMS scope + Statement of Applicability** covering Annex A controls.
2. **Formal AI risk assessment + treatment plan** (extend the informal one).
3. **AI System Impact Assessments** for each shipped model/feature (Annex B guidance) — the honest benchmark report ([`published-benchmark-report.md`](./published-benchmark-report.md)) is a strong input here.
4. **Model cards** for each deployed model (base model, training data provenance, measured recall/FPR, known limitations, intended use).
5. **Internal audit + management review** cadence with minutes.
6. **Stage 1 (documentation) and Stage 2 (implementation) audits** by an accredited certification body.

## Honest positioning language (approved)

- ✅ "ISO 42001 readiness" / "working toward ISO 42001" / "AI controls mapped to ISO 42001, EU AI Act, and NIST AI RMF".
- ❌ "ISO 42001 certified" / "ISO 42001 compliant" (until a certificate exists).

**EVIDENCE REQUIRED to change this file's status:** a signed ISO/IEC 42001
certificate from an accredited certification body.

## Related

- [`soc2-iso-readiness-gap-analysis.md`](./soc2-iso-readiness-gap-analysis.md) — information-security track (SOC 2 / ISO 27001).
- [`published-benchmark-report.md`](./published-benchmark-report.md) — honest measured detection performance (an AIMS impact-assessment input).
- `lib/compliance/assurance.ts` — the live control catalog mapped to ISO 42001 clauses.
