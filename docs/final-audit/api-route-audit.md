# API Route Audit

## Summary

The repo contains a broad API surface under `app/api`. Most private routes call `requireProjectPermission`, `requirePermission`, `getActiveOrganization`, `requireAdmin`, `authenticateApiKeyRequest`, or `authorizeScimRequest`.

## Route Groups

| Group | Status | Notes |
| --- | --- | --- |
| `/api/guard/input`, `/api/guard/output` | SAFE | API-key protected, rate-limited, policy-scoped, public result redacted. |
| `/api/guard/analyze` | SAFE | Public route, rate limited, no persistence of raw user secrets. |
| `/api/guard/grounding` | SAFE | Requires `rag:read`; validates body with Zod. |
| `/api/api-keys` | SAFE | Project permission; raw key returned once. |
| `/api/webhooks*` | SAFE | Project permissions, signing secret hashing/encryption, SSRF-safe delivery path. |
| `/api/billing/webhook` | SAFE | Public by design; verifies Razorpay signature. |
| `/api/billing/*` | PARTIAL | Auth/RBAC present; real Razorpay not externally verified. |
| `/api/rag/*` | SAFE/PARTIAL | Project permissions and scanner; file upload body validation relies on form/file validation helper. |
| `/api/scim/v2/*` | SAFE/PARTIAL | Bearer token scoped to org; external IdP compatibility not verified. |
| `/api/sso/saml/*` | PARTIAL | Validation exists; session completion incomplete. |
| `/api/admin/*` | SAFE | Admin guard present for interactive admin routes; worker process routes use worker token. |
| `/api/enterprise/*` | SAFE/PARTIAL | RBAC present; real enterprise provider testing pending. |
| `/api/agent-firewall/inspect` | PARTIAL | Requires `policy:manage`; inspect only, no runtime agent enforcement. |
| `/api/health`, `/api/ready`, `/api/badge*` | PUBLIC BY DESIGN | Keep payload minimal. |

## Needs Follow-Up

- Add automated route audit tests for every API file.
- Validate SAML RelayState and complete session minting.
- Add rate limiting to more public marketing/contact/pilot flows if traffic increases.
- Add API-level pagination/cursors where list endpoints can grow.

