# Project Deep Analysis — CyberRakshak Guard

Date: 2026-06-16
Branch: `final-project-audit`

## 1. What this product is

CyberRakshak Guard (AI Agent Security Guard) is an OWASP LLM Top 10 aligned AI
security gateway for chatbots, RAG apps, and AI agents. It is **defensive only**.
The core value is a guard engine that inspects model input/output for prompt
injection, jailbreaks, system-prompt leakage, PII (incl. India-specific), and
secrets, then ALLOW / REDACT / REWRITE / HUMAN_REVIEW / BLOCK according to a
per-project policy. Around that core sit: auth + multi-tenant orgs, API keys,
dashboard, logs, webhooks (signed, durable), reports (PDF), RAG security
(scanner, vector ACL), billing (Razorpay), and enterprise features (SAML, SCIM,
SIEM, retention/deletion).

## 2. Architecture

- **Framework**: Next.js 15.5.19 (App Router), React 18, TypeScript 5.7 strict.
- **DB**: PostgreSQL via Prisma 5.22. `prisma/schema.prisma` is the single schema.
- **Auth**: NextAuth v5 beta (credentials + SSO), bcrypt password hashing.
- **Rate limit / metering**: Upstash or node-redis, with an in-memory fallback
  that throws in production (`lib/redis.ts`).
- **Secrets**: pluggable secret store (local dev / AWS KMS / GCP KMS / Vault);
  local provider throws in production (fail-closed).
- **Workers**: webhook, SIEM, background, threat-intel (`workers/*`).
- **Packages**: JS SDK (`packages/sdk`), Python SDK (`packages/cyberrakshak-python`),
  WordPress plugin packaging script. Examples: node-express, fastapi, langchain, nextjs.

## 3. Module maturity

| Maturity | Modules |
| --- | --- |
| Implemented + tested | Guard engine + detectors, policy engine, redaction, API-key auth, RBAC/permission matrix, tenant isolation guards, logs (filters/pagination/keyset), webhook signing + durable delivery, audit export, billing signature/receipt logic, RAG scanner + vector ACL (local), SAML/SCIM logic (local), retention/deletion logic, signup/email-verification policy. |
| Implemented, provider-blocked | Real email send, KMS/Vault, Razorpay live payment lifecycle, real vector DB, SIEM collector, SAML/SCIM IdP interop. Logic is unit-tested; real external verification needs user credentials (see PROVIDER report). |
| Infra-sensitive | E2E suite (OneDrive/Turbopack manifest instability — mitigated by production-build E2E). |

## 4. Most fragile parts

1. **Policy decision ordering** (`lib/guard/policy.ts`) — multiple override
   layers (custom denylist, mode, unsafe-output) applied sequentially; ordering
   bugs can silently downgrade a block. (Found CRG-RT-009.)
2. **Billing webhook** (`app/api/billing/webhook/route.ts`) — dedup vs
   signature-check ordering. (Found CRG-RT-010.)
3. **RBAC call-site discipline** — the permission matrix is correct, but routes
   must each call `requirePermission`; one route relied on membership only.
   (Found CRG-RT-011.)
4. **Redis non-atomic incr+expire** — TTL can leak on partial failure
   (CRG-RT-013).
5. **Provider fail-closed paths** — correct by design, but mean many features
   cannot be runtime-verified locally.

## 5. Verification baseline (2026-06-16, this session)

`npx prisma validate` valid · `npm run typecheck` clean · `npm test` 204/204 ·
`npm run lint` clean · `npm audit` 0 vulnerabilities · `npm run build` succeeds.
This confirms the prior session's fixes (CRG-RT-001..008) still hold before new
work begins.
