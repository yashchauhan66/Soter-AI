# API Route Auth Audit Checklist

Use this checklist whenever an API route is added or changed. Middleware only protects selected page prefixes; API routes must declare and enforce their own boundary in the route handler.

## 1. Classify the Route

- Public anonymous route: allowed only for marketing forms, auth token consumption, public badge/status, billing webhooks, or the public guard analyzer.
- Session route: must call `requireUser`, `getActiveOrganization`, `requireOrganizationAccess`, `requireProjectAccess`, `requirePermission`, or `requireProjectPermission`.
- API key route: must call `authenticateApiKeyRequest` and must scope all work to the verified project.
- Admin route: must call `requireAdmin`.
- Worker route: must require a dedicated bearer token from env and fail closed when the token is missing.
- Third-party webhook route: must verify the provider signature over the raw body before mutating state.
- SCIM route: must verify the SCIM bearer token and tenant scope before reading or writing user/group mappings.

## 2. Public Route Requirements

- Add Redis-backed rate limiting through `enforcePublicRateLimit`.
- Do not use in-memory limits for production-facing endpoints.
- Validate body size with `readJson`.
- Validate payload shape with Zod before any expensive work.
- Store only sanitized text for free-form fields.
- Return generic messages for email/account flows to avoid account enumeration.
- Do not return development links unless the email provider reports `mocked: true`; mock email is disabled in production.

## 3. Tenant and Permission Checks

- Every private query must be constrained by `organizationId`, `projectId`, or a relation already checked by a guard helper.
- UI hiding is not authorization.
- Do not trust `organizationId`, `projectId`, `userId`, or `role` from the request body until a guard helper verifies access.
- Use permission checks for mutations, not only read access.
- Legacy helper `getCurrentProjectById` is acceptable only when it delegates to `requireProjectAccess`; prefer explicit permission helpers in new routes.

## 4. Secrets and Tokens

- Raw API keys, webhook secrets, SCIM tokens, reset tokens, and invite tokens must be displayed once and stored only as hashes or encrypted envelopes.
- Production must fail closed when required secret material is missing.
- Worker tokens, webhook signatures, payment signatures, API key hashes, and SCIM token hashes must use constant-time comparison where practical.
- Never log request headers that may contain `authorization`, `cookie`, `token`, `secret`, `password`, or `apiKey`.

## 5. External Calls

- Outbound integration URLs must be HTTPS and pass private-network checks.
- Webhook response bodies must be truncated and sanitized before storage.
- Billing mutations must require verified Razorpay signatures in production.
- Mock/sandbox flows must be rejected in production.

## 6. Data Safety

- Guard logs must not persist raw PII, secrets, or system prompt leakage.
- Audit exports must sign rows and avoid raw prompt text.
- RAG queries and vector results must enforce namespace, project, status, and ACL filters.
- Support, contact, pilot, and feedback text must pass `sanitizeLogText` before storage.

## 7. Verification Before Merge

- Add or update a test that proves the route enforces its boundary.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npx prisma validate` if schema or Prisma queries changed.
- Run `npm run build` before production release.

