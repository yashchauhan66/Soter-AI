# Project Functionality Report

Audit branch: `final-project-audit`

## Summary

CyberRakshak Guard is a broad Next.js SaaS product with a real core guard engine, project-scoped API keys, dashboard/admin surfaces, RAG security controls, webhooks, reports, enterprise identity scaffolding, and Phase 11 competitive-gap scaffolds.

Status language:

- WORKING: verified by code, tests, build, or live smoke.
- PARTIAL: code exists but workflow is incomplete or not end-to-end verified.
- SCAFFOLD_ONLY: schema/page/service/doc exists but no complete production workflow.
- BROKEN: verified failure found during audit.
- NOT_VERIFIED: not exercised end to end.

## Functionality Inventory

| Group | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Input Guard API | WORKING | `app/api/guard/input/route.ts`, live smoke 200, tests | API-key auth, rate limit, policy, logging, redaction. |
| Output Guard API | WORKING | `app/api/guard/output/route.ts`, live smoke 200, tests | Fixed prose system-prompt leakage gap. |
| Public Analyze API | WORKING | `app/api/guard/analyze/route.ts`, live smoke 200 | Public rate limited route. |
| Grounding Guard API | WORKING | `app/api/guard/grounding/route.ts`, tests | Requires project permission. |
| Detectors | WORKING | `lib/guard/detectors/*`, tests | Prompt injection, jailbreak, PII, India PII, secrets, unsafe output, system prompt leakage. |
| Risk scoring and decision engine | WORKING | `lib/guard/riskScoring.ts`, `decisionEngine.ts`, tests | Blocks/rewrite/redact/review based on risk. |
| Guard logs | WORKING | `GuardLog` model, `app/api/logs/route.ts`, dashboard pages | Redacted storage; list pagination exists via limit. |
| Playground and demo chatbot | WORKING | `/playground`, `/demo-chatbot`, live smoke | Public demo surfaces load. |
| SDK and Next.js helper | WORKING | `packages/sdk`, tests | SDK typecheck passes. |
| API key generation/hash/prefix lookup | WORKING | `lib/apiKeyCrypto.ts`, `lib/apiKey.ts`, tests/live smoke | Raw keys shown once; hashes stored. |
| API key rotation | PARTIAL | PATCH active/inactive exists | No full rotate-create-revoke UX beyond deactivate/generate. |
| Usage metering/rate limiting | WORKING | `lib/rateLimit.ts`, guard routes, tests | Redis/in-memory dev fallback; production Redis hard-fail. |
| Auth/signup/login/logout/password reset/email verify | WORKING | auth routes/components/tests | Build works; live form flows not fully browser-tested. |
| Organizations/projects/members/RBAC | WORKING | `lib/auth/guards.ts`, tests | Multi-org membership and project permission checks exist. |
| Billing/Razorpay | PARTIAL | billing routes/tests | Signature verification exists; real Razorpay checkout not externally verified. |
| Agency/client/white-label reports/badges | PARTIAL | dashboard routes, models, badge smoke | Badge script fixed; agency workflows not full browser-tested. |
| Webhooks/workers | WORKING/PARTIAL | webhook routes/tests/workers | Signing, retries, logs tested; worker deployment health not fully exercised. |
| Reports/PDF/audit exports | WORKING/PARTIAL | routes/models/tests | Job-backed report generation; PDF worker path not browser-tested. |
| RAG upload/scanner/vector ACL/grounding | WORKING/PARTIAL | RAG routes/tests | Scanner/vector isolation tested; full upload UI not fully E2E-tested. |
| SAML SSO | PARTIAL | SAML routes/libs/tests | Assertion validation exists; ACS comments say session minting is not complete. |
| SCIM v2 | WORKING/PARTIAL | SCIM routes/tests | Bearer token auth and tenant scope tested; external IdP interoperability not verified. |
| SIEM exports | PARTIAL | `lib/siem`, routes, worker | SSRF guard exists; external SIEM not verified. |
| Retention/deletion | PARTIAL | enterprise routes/models/tests | Workflow models/jobs exist; real deletion policy needs operational review. |
| Trust/compliance pages/docs | PARTIAL | public pages/docs/tests | Readiness docs exist; not certifications. |
| AI supply chain / AI BOM | SCAFFOLD_ONLY | Phase 11 models/services/tests | Snapshot/risk helpers exist; no full workflow lifecycle. |
| Agent/tool-call firewall | PARTIAL | `lib/agent-firewall`, API, tests | Inspect/approval scaffolds exist; no integrated agent runtime enforcement. |
| Threat intelligence pipeline | SCAFFOLD_ONLY | worker/service/admin page/tests | Validates rule packs; no remote feed ingestion/promotion UI. |
| Benchmark/accuracy dashboard | SCAFFOLD_ONLY | models/admin page/tests | Metrics helper exists; no scheduled benchmark pipeline. |
| Multilingual expansion | PARTIAL | feature-flagged detectors/tests | Rule examples exist; not trained multilingual ML. |
| DPDP/privacy workflow | SCAFFOLD_ONLY | models/pages/docs/tests | Drafting helpers and counts; no full DSR SLA workflow. |
| WordPress/plugin and middleware packages | SCAFFOLD_ONLY | integrations/packages/tests | Scaffolds, not published packages. |
| Abuse/cost controls | PARTIAL | models/helpers/admin page/tests | Decision helpers exist; not fully wired into all paid routes. |
| Growth/launch assets | PARTIAL | docs/pages/tests | Docs and dashboards exist; real CRM/outreach ops not product runtime. |

## Live Smoke Results

- `GET /`, `/pricing`, `/playground`, `/signin`, `/docs`, `/badge.js`, `/api/health`, `/api/ready`: 200.
- `POST /api/guard/analyze`: 200 and blocks prompt-injection/system-prompt request.
- `POST /api/guard/input` with temporary key: 200 and blocks PII+secret payload.
- `POST /api/guard/output` with temporary key: 200 and blocks prose system-prompt leakage after fix.

