# Phase 4 QA Checklist

## Database and isolation

- [ ] Apply `20260614140000_phase4` to a copy of production-like PostgreSQL data.
- [ ] Confirm RAG collections, documents, chunks, findings, feedback, schedules, deliveries, and reports cannot be queried across organizations/projects.
- [ ] Confirm only `SAFE` documents can be approved and only `APPROVED` documents can become `INDEXED`.
- [ ] Confirm disabled projects reject API-key guard requests.

## Email and auth

- [ ] Verify Resend, SES, SMTP, and mock delivery modes in their target environment.
- [ ] Verify email tokens expire after 24 hours, reset tokens after 1 hour, and both are one-time use.
- [ ] Verify password-reset requests do not reveal whether an account exists.
- [ ] Verify invite, usage warning/exceeded, payment failure, monthly report, webhook failure, and high-risk templates contain no raw prompts.

## RAG and grounding

- [ ] Upload safe TXT/Markdown/PDF content and approve it before indexing.
- [ ] Upload prompt injection, hidden HTML/Markdown instructions, exfiltration language, PII, India PII, and secrets; confirm quarantine and redacted-only storage.
- [ ] Confirm duplicate document hashes create explicit versions.
- [ ] Confirm vector retrieval applies tenant, project, role, document status, document allowlist, and source filters.
- [ ] Confirm citation-required, source count, required URL, unsupported claim, high-risk review, and no-source fallback behavior.

## Classifiers and feedback

- [ ] Verify all three feature flags off still leaves Phase 1 pattern detectors active.
- [ ] Verify semantic and Hindi/Hinglish signals when enabled.
- [ ] Submit incorrect block, missed risk, and correct feedback from log details.

## Secrets, workers, reports, admin

- [ ] Confirm webhook ciphertext survives app restart and raw secrets appear only once after create/rotate.
- [ ] Run `npm run worker:webhooks`; verify heartbeat, retry backoff, graceful shutdown, and dead-letter transition.
- [ ] Verify the cron route remains usable as fallback.
- [ ] Verify scheduled report delivery logs, PDF attachment, report ID, trend table, OWASP section, disclaimer, and HMAC signature.
- [ ] Verify admin plan override, quota bump, replay/retry, disable/enable, and required audit reason.

## Regression and release

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test` and confirm all Phase 1-4 tests pass.
- [ ] Run `npm run build`.
- [ ] Smoke-test input/output guard APIs, webhooks, agency reports, public badge, auth/RBAC, billing, policy, exports, and admin pages.
