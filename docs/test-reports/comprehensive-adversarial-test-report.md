# SOTERAI — Comprehensive Adversarial Test Battery Report

**Date:** 2026-06-29  
**Command:** `npx tsx tests/comprehensive-adversarial-test-battery.ts`  
**Total Tests:** 101  
**Passed:** 101  
**Failed:** 0  
**Pass Rate:** 100%

---

## Executive summary

The comprehensive adversarial battery now passes against the current service APIs and runtime behavior. The earlier failures were caused by stale test wiring and outdated interface assumptions rather than confirmed product regressions:

- the dry-run test imported `simulateAgentAction` from the wrong module;
- identity fabric tests used an older capability grammar and old passport/delegation signatures;
- causal SIEM fixtures lacked canonical trust-event fields;
- the red-team runner is asynchronous and needed to be awaited;
- the evidence report fixture needed persisted evidence item IDs;
- one action-ledger scenario expected low-risk behavior where the current ledger intentionally fails closed for unknown browser actions.

The battery now exits non-zero if any scenario fails.

---

## Service-by-service results

| Service                 | Tests | Result    |
| ----------------------- | ----: | --------- |
| Guard Analysis          |   8/8 | ✅ Passed |
| Guard Analysis (Output) |   2/2 | ✅ Passed |
| Guard Analysis (Input)  |   1/1 | ✅ Passed |
| Agent Firewall          | 10/10 | ✅ Passed |
| Agent Passport          | 10/10 | ✅ Passed |
| Agent Intent            |   8/8 | ✅ Passed |
| Escrow                  |   7/7 | ✅ Passed |
| Dry-Run                 |   6/6 | ✅ Passed |
| Semantic Egress         |   4/4 | ✅ Passed |
| Action Ledger           |   6/6 | ✅ Passed |
| Evidence Vault          |   3/3 | ✅ Passed |
| Tool Chain              |   4/4 | ✅ Passed |
| Blast Radius            |   3/3 | ✅ Passed |
| Legal Boundary          |   6/6 | ✅ Passed |
| Identity Fabric         |   8/8 | ✅ Passed |
| Compliance Assurance    |   2/2 | ✅ Passed |
| Causal SIEM             |   2/2 | ✅ Passed |
| Behavior Baseline       |   2/2 | ✅ Passed |
| MCP Risk Scanner        |   2/2 | ✅ Passed |
| Cost Firewall           |   4/4 | ✅ Passed |
| Shadow AI               |   1/1 | ✅ Passed |
| Usage Governance        |   1/1 | ✅ Passed |
| Red Team                |   1/1 | ✅ Passed |

---

## Verification snapshot

The broader project verification also passed after the remaining fixes:

- `npm run typecheck` ✅
- `npm test` ✅ — 606/606 passing
- `npx prisma validate` ✅
- `npx tsx tests/comprehensive-adversarial-test-battery.ts` ✅ — 101/101 passing
- `npm run build` ✅ — passed with network access enabled for `next/font` Google Fonts

Build warnings remain for pre-existing unused variables and a React purity warning in `app/dashboard/usage-governance/monitoring/page.tsx`, but they do not fail the production build.
