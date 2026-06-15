# Database Issues — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

## Status

- `npx prisma validate` — **valid** (2026-06-16).
- Schema is the single source of truth; local PostgreSQL is the only runtime-verified provider (migrations, seed, health, CRUD, E2E all passed in the prior session — see `docs/testing/PROVIDER_TEST_REPORT.md`).

## Verified-correct (from schema + code review)

- **Tenant scoping**: guard logs, projects, webhooks, RAG, subscriptions carry org/project foreign keys; list queries filter by `project.organizationId` derived from the session, never from client input.
- **No raw-secret columns returned in list views**: `guardLogListSelect` omits `originalText`; dashboard aggregates select no content columns.
- **One-time secrets hashed at rest**: API keys, webhook secrets, SCIM tokens, email-verification & password-reset tokens are stored as hashes, never plaintext.
- **Payment idempotency**: `PaymentEvent.eventId` unique constraint backs webhook dedup (now correctly gated behind signature verification — CRG-RT-010).
- **Usage metering**: `UsageCounter` daily aggregate + Redis monthly buckets.

## Not changed this session

- No schema migrations were made. The stabilization fixes (CRG-RT-009..014) were all code-level and required no schema change.
- **No destructive migrations were run** — per the user-permission rule, destructive DB changes require explicit authorization.

## Pre-production DB items (provider/infra gated, NOT verified locally)

- Connection-pool sizing under load (needs deployed instance).
- Retention/deletion job behavior against production-scale data (logic is unit-tested in `tests/retention.test.ts`; real bulk deletion not executed — destructive, needs permission).
- Cascade-delete safety on org/project removal under real data volume.
