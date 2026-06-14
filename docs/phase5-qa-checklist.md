# Phase 5 QA checklist

## Setup and migration

- [ ] Copy `.env.example` to `.env` and replace every placeholder.
- [ ] Configure PostgreSQL with the `vector` extension when using pgvector.
- [ ] Run `npm ci`, `npx prisma validate`, and `npm run db:deploy`.
- [ ] Confirm `npx prisma migrate status` reports all five migrations applied.
- [ ] Never use `SECRET_STORE_PROVIDER=local` or `VECTOR_PROVIDER=memory` in production.

## Authentication and tenant boundaries

- [ ] Verify dashboard, RAG, SIEM, SSO, SCIM, red-team, and event APIs require authentication.
- [ ] Verify organization and project identifiers from another tenant return 403 or 404.
- [ ] Verify admin pages and mutation APIs reject non-admin users.
- [ ] Confirm public badge pages expose only public names and aggregate activity.

## KMS and secret storage

- [ ] Verify missing AWS, GCP, and Vault configuration fails closed.
- [ ] Test AWS KMS, GCP KMS, or Vault encrypt/decrypt/rotate using non-production test keys.
- [ ] Configure `VAULT_TRANSIT_CONTEXT` only for derived Transit keys.
- [ ] Rotate a webhook secret and confirm success/failure audit records contain no secret.
- [ ] Verify decrypted webhook and SIEM tokens never appear in logs or API responses.

## OCR and document sandbox

- [ ] Scan TXT, Markdown, text PDF, PNG/JPEG OCR, and a mocked scanned-PDF provider.
- [ ] Reject missing `Content-Length`, mismatched signatures, unsupported types, empty files, and oversized uploads.
- [ ] Confirm OCR timeouts terminate cooperative providers/workers.
- [ ] Quarantine JavaScript, launch, embedded-file, encrypted, hidden-text, malformed compressed-stream, and over-limit PDFs.
- [ ] Confirm OCR secrets and India-specific PII are redacted before chunk persistence.

## Vector and RAG retrieval

- [ ] Approve a document, index it, and verify chunks reach Qdrant or pgvector.
- [ ] Query through `POST /api/rag/query`; verify organization, project, collection, role, document, source, status, and sensitivity filters.
- [ ] Use `PUT /api/rag/chunks/acl` to change roles and confirm the vector copy is updated.
- [ ] Confirm empty ACLs deny access and only APPROVED/INDEXED documents are retrievable.
- [ ] Confirm every retrieval creates a hash-only audit record; audit failure must fail the request.

## Grounding and attribution

- [ ] Call `POST /api/guard/grounding` with stored chunk IDs.
- [ ] Confirm caller-supplied source text, URLs, and authorization flags are ignored.
- [ ] Validate source coverage, citations, unsupported claims, private-source leakage, minimum source count, and no-source fallback.
- [ ] Verify answer audits store hashes and counts, not raw answers or source text.

## Classifier evaluation and Hinglish

- [ ] Run `npm run eval:classifiers` and inspect precision, recall, F1, calibration, false positives, and false negatives.
- [ ] Persist a run only against the intended database with `PERSIST_CLASSIFIER_EVAL=true`.
- [ ] Confirm all required Hindi/Hinglish examples are BLOCK or HUMAN_REVIEW according to policy.
- [ ] Treat the bundled corpus as regression coverage, not proof of real-world accuracy.

## Authorized red-team suite

- [ ] Require explicit confirmation and an owned project.
- [ ] Run direct/indirect injection, RAG poisoning, PII leakage, prompt leakage, private-document, tool misuse, cost abuse, and grounding cases.
- [ ] Verify every result has OWASP LLM Top 10 mapping and a defensive recommendation.
- [ ] Confirm no external target scanning or destructive action is performed.

## Events, SIEM, and observability

- [ ] Trigger `guard.blocked`, `rag.document_quarantined`, `webhook.failed`, `policy.changed`, and `admin.action`.
- [ ] Verify the event stream is tenant scoped and metadata is redacted.
- [ ] Test generic, Splunk, Elastic, and Datadog formatting and retry behavior.
- [ ] Reject HTTP, loopback, link-local, private-network, credential-bearing, and private-DNS SIEM/webhook destinations.
- [ ] Verify OTLP failure never leaks prompt content or breaks the guarded request.

## Enterprise scaffold

- [ ] Save disabled SAML settings, then enable only with HTTPS metadata or complete manual certificate settings.
- [ ] Generate a SCIM token, confirm it is returned once, verify only its hash/preview is stored, and revoke it with DELETE.
- [ ] Confirm Phase 6 SAML assertion validation and SCIM `/Users` and `/Groups` routes are covered by the Phase 6 QA checklist.

## Docker and system health

- [ ] Set `POSTGRES_PASSWORD` and validate `docker compose -f docker-compose.prod.yml config`.
- [ ] Build and start app, PostgreSQL, Qdrant, webhook worker, and SIEM worker.
- [ ] Run migrations before serving traffic.
- [ ] Review `/admin/kms`, `/admin/classifier-evals`, `/admin/redteam`, `/admin/siem`, and `/admin/system-health`.

## Regression and release gate

- [ ] Run `npm run typecheck`, `npm test`, `npm --prefix packages/sdk run typecheck`, `npm run build`, `npx prisma validate`, and `npm audit --audit-level=high`.
- [ ] Manually verify Phase 1 guard APIs and public redaction behavior.
- [ ] Verify Phase 2 SDK, Next.js helper, webhooks, badge, agency, plans, and onboarding.
- [ ] Verify Phase 3 auth, organizations, RBAC, tenant isolation, billing, policy, reports, exports, and admin.
- [ ] Verify Phase 4 auth email flows, RAG quarantine, grounding, classifiers, feedback, workers, and scheduled reports.

## Known limitations

- External AWS/GCP/Vault, OCR, Qdrant, pgvector, SIEM, SAML, and SCIM interoperability requires environment-specific testing.
- The local benchmark is intentionally small and cannot establish production classifier accuracy.
- PDF inspection handles visible and Flate-compressed structures but is not a malware-analysis substitute.
- SAML assertion validation and complete SCIM resource endpoints are not implemented.
- CyberRakshak Guard is OWASP LLM Top 10 aligned; this is not certification or a promise of complete protection.
