# CyberRakshak Guard / Ai-Agent-Security-Guard — Whole Project Summary Report

> This report is a consolidated overview of the project based on the repository’s top-level documentation and the most relevant final-audit / feature reports currently available in `docs/`.

## 1) Project overview

CyberRakshak Guard (repo name: **Ai-Agent-Security-Guard**, package name shown in docs: **Soter**) is a developer-first **defense-in-depth safety layer** for:

- AI chatbots and agent systems
- RAG pipelines
- LLM applications that need runtime protection before data reaches the model or leaves the system

Primary goals:

- Detect and block **prompt injection**, **jailbreaks**, and **unsafe instructions**
- Prevent **data leakage** including **PII** and **secret** exposure
- Enforce **safe output** handling
- Provide structured **audit/evidence** for compliance and incident review
- Support enterprise governance: auth, tenant isolation, policy controls, metering, exports, and integration scaffolds

Alignment positioning (per repo docs):

- “OWASP LLM Top 10 aligned” and defense-in-depth controls
- Not a guarantee of complete protection; does not replace secure engineering, access controls, incident response, or human review

## 2) Architecture and major subsystems

From the repository documentation and Prisma schema, the project consists of these core layers.

### 2.1 Guard engine (input/output/analyze)

Capabilities include:

- Modular detectors with explainable risk findings
- Risk scoring and actions: **ALLOW / ALLOW_WITH_REDACTION / REWRITE / BLOCK / HUMAN_REVIEW**
- Position-safe redaction and safe rewriting
- Security-safe logging that avoids storing raw secrets/PII/system instructions

### 2.2 Authentication, authorization, and tenant isolation

Docs describe:

- Public routes: `/signin`, `/signup`
- Auth-enforced routes: `/dashboard`, `/admin`, and private APIs
- Roles with a central permission map (OWNER / ADMIN / DEVELOPER / SECURITY_ANALYST / BILLING / VIEWER)
- Tenant isolation: private queries enforced by API guards like `requireUser`, `requireOrganizationAccess`, `requireProjectAccess`, and `requirePermission`
- UI is not the boundary; APIs enforce.

### 2.3 Policy engine (per-project)

Per-project `ProjectPolicy` supports:

- Modes: **MONITOR / BALANCED / STRICT**
- Per-detector toggles
- Allowlisted domains / denylisted patterns
- Custom blocked topics
- Custom fallback message
- Citation requirements / safe fallback behaviors (where supported)

### 2.4 Rate limiting and metering

Docs describe Redis-backed rate limiting (Upstash REST compatible) with monthly metering buckets.

### 2.5 Webhooks (HMAC signing + durable delivery)

Docs describe:

- HMAC-SHA256 signed payloads
- A database-backed delivery queue with retries using exponential backoff
- Idempotency key to support safe deduping across retries
- Manual replay and a worker endpoint for processing deliveries

### 2.6 Reporting and evidence exports

Features:

- Server-side PDF report generation for monthly project/guard reports (pdfkit)
- SIEM-ready exports (JSONL), plus CSV/PDF formats (as per schema enums)
- Signed/manifest-based export integrity concepts (per README)

### 2.7 RAG security: scanning, quarantine, grounding guard

Docs describe Phase 4/5 RAG security:

- Document scanning and quarantine for risky content
- Tenant-bound vector ACL concepts
- Chunk redaction and safe storage
- Grounding and citation enforcement

### 2.8 Agent security: firewall + semantic egress

Docs and final-audit content show advanced agent controls and “semantic egress”:

- Agent firewall / intent checks / tool-chain controls
- **Semantic Egress Firewall**: detects meaning-based leakage when protected context might be released to public/external destinations
- Decision outputs include allow/redact/block/approval/review decisions
- Semantic source fingerprinting and persistence, with redacted content stored rather than raw egress

### 2.9 Canary Network (prompt injection / leak observability)

Final feature reports indicate a Canary Network layer with:

- Persistence of canary leak events (`CanaryLeakEvent`) in DB
- Dashboard and APIs to list tokens and leak events
- Disabling canary tokens
- Strict redaction: stored content is **redacted-only**

### 2.10 Compliance + enterprise governance

Prisma schema shows a broad governance and audit model surface:

- Support tickets, incidents, forensics
- Data retention and deletion requests
- SCIM tokens and SAML provider records
- Security events, SIEM integration and delivery tracking
- ML classifier dataset registry and evaluation run models
- Evidence vault / compliance evidence reports and items

## 3) Development phases (as documented)

The main README organizes the project into capability phases.

### Phase 1 — Base guard capabilities (still working)

- Input/output/public playground analysis APIs
- Modular detectors + findings
- Risk scoring with allow/redact/rewrite/review/block
- Redaction and risky instruction rewriting
- Project-scoped API keys, one-time display, peppered hash storage
- Rate limiting and usage quotas
- Guard logs + dashboards + monthly reports

### Phase 2 — SDKs and webhook + public product layer (still working)

- `@soter/core` typed SDK and Next.js helper (`secureChatHandler`)
- Webhook endpoints with HMAC signatures + delivery logs
- Agency dashboard, clients, branding, white-label reporting
- Public badge, embed script, status page
- Plan + usage system

### Phase 3 — Real auth, tenant isolation, durable queues, policy engine

- NextAuth v5 + credentials + bcrypt
- Organizations/members/roles
- Tenant isolation enforced in APIs
- Redis-backed rate limiting + metering
- Durable webhook queue with retry/backoff
- Razorpay billing + signed activation + signature-verified webhook receiver
- Project policy modes + server-side PDF reports + audit exports
- Admin panel gated by isAdmin

### Phase 4 — RAG scanning/quarantine, encrypted webhook secrets, reports

- RAG scanning + quarantine
- Vector access controls (tenant-bound)
- Grounding/citation policies
- Optional semantic/Hinglish classifiers (behind feature flags)
- Email verification/reset/invites (provider-based)
- Encrypted webhook secrets, always-on delivery worker
- Scheduled signed PDF reports and audited admin actions

### Phase 5 — Production adapters, OCR, vectors, SIEM, classifier eval

- Secret storage via KMS/Vault adapters
- OCR/document sandboxing
- Vector provider adapters (Qdrant/pgvector)
- Source attribution scoring + classifier evaluation
- Authorized red-team suites
- Structured security events + SIEM delivery
- SAML/SCIM scaffolding
- Self-hosted deployment assets

### Phase 6 — Enterprise launch readiness

- SCIM v2 and SAML workflows with audit logging
- Data retention and deletion controls
- IP allowlist and enterprise security controls
- Trust/privacy/responsible disclosure pages and enterprise readiness
- Self-hosted deployment via Docker/K8s/Helm scaffolds

### Phase 8–11 — Launch ops + market/growth + internal preview scaffolds

- Phase 8: onboarding and operations, support tickets, incidents, status page, launch assets, production readiness audit
- Phase 9–10: go-to-market and growth execution artifacts
- Phase 11: internal preview scaffolds for supply-chain security, tool-call firewall preview, advanced RAG security simulation, threat-intel lifecycle, multilingual expansion, DPDP readiness workflow, and audit readiness docs

## 4) Final audit highlights (from included final-audit docs)

### 4.1 Final deep production + market audit (2026-06-19)

This final audit doc records:

- **Production readiness score: 78/100**
- Recommendation: **No-go for unrestricted public production launch right now**
- Controlled beta/pilot after build/E2E verification and production environment validation

Key outcomes:

- Strong core security engine and strong local regression suite
- Notable remaining blockers:
  - Missing `.env.production` variables
  - Pending `npm run build` and Playwright E2E due to production build freshness
  - Real provider integration verification not completed (Redis/KMS/email/Razorpay/vector/SIEM/SAML)

Remediation fixed in that audit:

- Canary leak event persistence: `CanaryLeakEvent` model + redacted persistence for canary leak content
- CI/test coverage gap: `npm test` includes added tests
- ESLint stability fixes around pytest cache artifacts

### 4.2 Canary Network — Implementation report

Final canary implementation doc states:

- Added `CanaryLeakEvent` persistence + redacted-only leak content
- Added/updated canary routes:
  - `/api/canary/check`
  - `/api/canary/tokens`
  - `/api/canary/leaks`
  - `/api/canary/[id]/disable`
- Added dashboard:
  - `/dashboard/canary-network`
- Updated tests to statically verify:
  - Auth guard presence
  - redaction safety and no token hash exposure

### 4.3 Canary Network — Test report

Test report indicates:

- Static safety verification for canary API route handlers
- Specific typing fix for `app/api/canary/[id]/disable/route.ts`
- Notes runtime API/E2E coverage wasn’t executed in that step (static checks only)

### 4.4 Semantic Egress Firewall — Implementation & test notes

Included semantic egress final docs describe:

- Semantic data egress checks via semantic overlap + guard-detected risk signals
- Persistence of protected fingerprints and semantic egress checks storing **redacted output**
- Dashboard support for reviewing decisions/findings
- Test report notes the companion steps and readiness status (with TBD fields in the provided test report)

## 5) Data model snapshot (from Prisma schema)

The Prisma schema includes a broad set of domain entities. Major groups include:

- Guard artifacts: `GuardLog`, policy models, usage counters
- Reporting: `Report`, `ScheduledReport`, `ScheduledReportDelivery`
- Webhooks: `WebhookEndpoint`, `WebhookDelivery`, `PaymentEvent` and billing-related models
- RAG: `RagCollection`, `RagDocument`, `RagChunk`, `RagScanFinding` plus trust models
- Security telemetry: `SecurityEvent`, incidents, and forensic report structures
- Compliance: `ComplianceEvidenceItem`, `ComplianceEvidenceReport` and related enums
- Enterprise identity: `SsoProvider`, `SamlProvider`, `ScimToken`, mapping tables, retention/deletion policy
- Agentic security scaffolding: tool-chain sessions/logs, escrow/approvals/dry-run, semantic egress checks
- Canary: `CanaryToken` and `CanaryLeakEvent`

## 6) What is “ready” vs “not ready” (based on final audit)

### Ready (high confidence)

- Local regression suite is passing for security logic
- Canary persistence + redaction behavior implemented and verified via static tests
- Semantic egress firewall capability exists with persistence and safety redaction behavior

### Not ready for unrestricted public production launch

- Production environment validation not complete due to missing `.env.production`
- Fresh production build and browser E2E not yet completed (in that audit state)
- Real external providers not verified in staging against real credentials

## 7) Recommended next actions (from audit)

From the final deep production audit recommendations:

1. Run:
   - `npm run build`
   - `npm run test:e2e`
2. Create/validate `.env.production`:
   - `npm run validate-env`
3. Deploy migrations to ensure canary migration and schema changes exist:
   - `npm run db:deploy`
4. Verify real provider integrations in staging:
   - Redis/Upstash, KMS/Vault, email, Razorpay, vector DB, SIEM, secret store, SAML/SCIM
5. Update docs to avoid stale/overclaimed implementation status.

## 8) Location of key project reports and docs

- `README.md` — main phased product narrative and local/dev verification steps
- `docs/final-audit/final-deep-production-market-audit-2026-06-19.md` — deep production + market audit
- `docs/final-audit/canary-network-implementation-report.md` — canary implementation summary
- `docs/final-audit/canary-network-test-report.md` — canary test report
- `docs/final-audit/semantic-egress-implementation-report.md` — semantic egress implementation
- `docs/final-audit/semantic-egress-test-report.md` — semantic egress test report

## 9) Notes / limitations of this summary

This summary is limited to the documentation and final-audit files that were available in this session, plus the Prisma schema content that was loaded.

If you want a truly “whole repo” summary (including route-by-route docs, workers, and every major `docs/` section), I can generate an expanded report after indexing all `docs/**/*.md`, top-level `app/**` route handlers, and worker entrypoints.
