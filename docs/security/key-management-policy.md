# Key Management Policy

**Date:** 2026-07-09
**Status:** SOC2-ready / preparation

## Key Types

| Key Type | Purpose | Storage | Rotation |
|---|---|---|---|
| API keys | API authentication | PostgreSQL (SHA-256 hashed) | On demand |
| SAML signing | SAML assertion signing | IdP managed | Per IdP policy |
| Vault encryption | Secrets vault | SecretStorage/chrome.storage | On compromise |
| HMAC webhook | Webhook verification | Environment variable | Quarterly |
| Payment verification | Razorpay signature | Environment variable | Per Razorpay policy |
| TLS certificates | HTTPS encryption | CDN/host managed | Auto-renewal |

## Key Lifecycle

### Creation

| Key Type | Process |
|---|---|
| API keys | Generated via dashboard, SHA-256 hashed before storage |
| Vault keys | Generated on first use, stored in SecretStorage |
| HMAC secrets | Generated via `crypto.randomBytes(32)`, stored in env |

### Distribution

| Key Type | Process |
|---|---|
| API keys | Displayed once on creation, never stored in plaintext |
| Vault keys | Never leave the client (browser/IDE) |
| HMAC secrets | Set via environment variable, never logged |

### Rotation

| Key Type | Frequency | Process |
|---|---|---|
| API keys | On demand | Generate new, revoke old |
| HMAC secrets | Quarterly | Update env, redeploy |
| Vault keys | On compromise | Re-encrypt all secrets |

### Revocation

| Key Type | Process |
|---|---|
| API keys | Delete via dashboard, immediate effect |
| SAML tokens | Invalidate via IdP |
| SCIM tokens | Revoke via API, immediate effect |

## Key Storage Rules

1. **Never store plaintext keys** — always hash or encrypt
2. **Never log keys** — use redacted previews only
3. **Never transmit keys in URLs** — use headers only
4. **Never embed keys in client-side code** — use server-side proxy
5. **Rotate on compromise** — assume breach, rotate all related keys

## Key Recovery

| Scenario | Process |
|---|---|
| Lost API key | Generate new, revoke old |
| Compromised vault key | Re-encrypt all secrets with new key |
| IdP certificate change | Update SAML provider config |
