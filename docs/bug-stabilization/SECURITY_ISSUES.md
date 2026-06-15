# Security Issues — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

Method: 4 parallel code-audit subagents (auth/RBAC/secrets, API routes, billing/webhooks/RAG, guard/logs/UI), every finding then verified by reading the cited code. Only verified issues are listed.

## Fixed this session

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| CRG-RT-009 | Custom denylist BLOCK downgraded to ALLOW/REDACT by `unsafeOutputMode` override on the OUTPUT path (`lib/guard/policy.ts`). Explicit user denylist could be bypassed. | HIGH | FIXED + tested |
| CRG-RT-010 | Razorpay webhook persisted/deduped the event before checking the signature, enabling dedup poisoning and acking invalid signatures (`app/api/billing/webhook/route.ts`). | HIGH | FIXED + tested |
| CRG-RT-011 | `GET /api/logs` enforced membership but not `logs:read`; BILLING role (no `logs:read` in the matrix) could read guard logs. | MEDIUM | FIXED + tested |

## Verified-correct controls (no change needed)

- Email-verification & password-reset tokens: SHA-256 + domain prefix, hashed at rest, expiring, one-time, prior tokens invalidated on resend (`lib/auth/tokens.ts`).
- Passwords: bcrypt cost 12, dummy-hash timing defense, never logged.
- Open redirect / callback URL: `safeCallbackUrl` rejects non-leading-slash, `//`, `\`, control chars; SAML RelayState routed through it (`lib/auth/callback.ts`).
- Secret store fail-closed in production; no raw secret/token logging in any provider (`lib/secrets/*`).
- SAML session exchange: 2-min TTL, hashed, one-time, IP+UA bound, optimistic-lock delete.
- SCIM token auth: peppered SHA-256, constant-time compare, expiry + revocation checked.
- `AUTH_SECRET` validated at production startup (`auth.config.ts`).
- Webhook delivery payloads carry redacted/safe text only; SSRF guarded via `assertPublicOutboundUrl` (`lib/webhooks/delivery.ts`).
- Tenant isolation on API-key, project, webhook, export, SCIM, SAML routes via `requirePermission` / `requireProjectPermission`.
- `toPublicGuardResult` strips `originalText` from all guard responses.

## Hardening suggestions — NOT changed (out of "do not weaken / do not add features" scope; documented for the operator)

1. **SAML replay store is in-process** (`lib/enterprise/samlReplayStore.ts`). Fine for single-instance; before any multi-instance/serverless production deploy it must be Redis-backed. The file comment already notes this. Recommend a production startup guard. (No code change now — enterprise SAML is a provider-blocked feature pending IdP setup; changing replay storage without a real IdP test risks unverifiable behavior.)
2. **SAML signature canonicalisation is simplified** (`lib/enterprise/saml.ts`). Recommend `xml-crypto`/`samlify` for full XML-DSIG Exclusive C14N before real-IdP production use. Provider-blocked; logged for the SAML hardening milestone.
3. **Platform admins get synthesised `OWNER` role over foreign orgs** (`lib/auth/guards.ts:85`). Functionally intended for support, but a distinct `isPlatformAdmin` flag + audit event would improve traceability.
4. **`quota_override` reachable by ADMIN** (`app/api/enterprise/security/route.ts`); `disable_organization` is OWNER-only. Consider tightening `quota_override`/`force_api_key_rotation` to OWNER.
5. **Invite token hashed with bare SHA-256, no pepper** (`app/api/members/invite/route.ts`). Recommend the same domain-prefix/pepper pattern used by auth/SCIM tokens.
6. **Billing `mock` activation gated only by `NODE_ENV`** (`app/api/billing/activate/route.ts`). Requires `billing:update`; consider a dedicated `RAZORPAY_SANDBOX_ALLOWED` flag so staging can't free-activate plans by accident.
7. **`logSafety` retains prompt-injection/jailbreak payloads verbatim** (PII/secrets/system-leak ARE redacted). This is deliberate forensic retention; flagged only so the operator can decide on a retention/redaction policy for attack payloads.

None of these are exploitable in the current single-instance, provider-gated configuration; they are pre-production hardening items tied to features that need real provider credentials to verify.
