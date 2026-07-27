# Security Architecture

**Date:** 2026-07-09
**Status:** SOC2-ready / preparation (not certified)

## Overview

SoterAI is an AI security platform that protects organizations from prompt injection, data exfiltration, and other AI-related threats. The architecture follows defense-in-depth principles with multiple security layers.

## Trust Boundaries

| Boundary | Description |
|---|---|
| Internet → Platform | HTTPS only, TLS 1.2+, HSTS |
| Platform → Database | PostgreSQL with connection pooling |
| Platform → Vector Store | Qdrant/pgvector with namespace isolation |
| Platform → Redis | Rate limiting, session caching |
| Platform → Razorpay | HTTPS, HMAC signature verification |
| Platform → Email | SMTP/TLS for transactional email |
| User → Browser Extension | Local-only, no remote code |
| Browser Extension → Backend | HTTPS, API key auth |

## Data Classification

| Classification | Examples | Handling |
|---|---|---|
| PUBLIC | Marketing pages, docs, pricing | CDN, no auth |
| INTERNAL | Dashboard UI, API responses | Session auth, RBAC |
| CONFIDENTIAL | API keys, secrets, PII | Encrypted at rest, access-logged |
| RESTRICTED | Payment data, SAML tokens | Never stored, HMAC-verified |

## Security Controls

### Authentication

| Control | Implementation |
|---|---|
| Password hashing | bcrypt with salt |
| Session management | NextAuth.js with secure cookies |
| API key auth | SHA-256 hashed, prefixed with `sk_` |
| SAML SSO | RSA-SHA256/384/512 signature verification |
| SCIM tokens | SHA-256 + pepper hashing |
| MFA | Via IdP (SAML assertion attributes) |

### Authorization

| Control | Implementation |
|---|---|
| RBAC | 6 roles, 37 permissions |
| Tenant isolation | Application-level via Prisma query scoping |
| Project scoping | API keys bound to projects |
| Admin bypass | Platform admin bypasses all permission checks |

### Data Protection

| Control | Implementation |
|---|---|
| Encryption at rest | PostgreSQL TDE (if configured), vault AES-256-GCM |
| Encryption in transit | TLS 1.2+ for all connections |
| Secret storage | VS Code SecretStorage, browser chrome.storage |
| PII handling | SHA-256 hashes, redacted previews, no raw text |
| Data retention | Configurable per-organization policies |

### Network Security

| Control | Implementation |
|---|---|
| HTTPS only | All API endpoints require TLS |
| HSTS | Strict-Transport-Security header |
| CSP | Content-Security-Policy for webviews |
| CORS | Configured per-environment |
| Rate limiting | Per-endpoint, per-IP, per-key |
| IP allowlist | Optional CIDR-based restrictions |

### Monitoring & Logging

| Control | Implementation |
|---|---|
| Audit logs | Organization-scoped, cursor-based pagination |
| Security events | Quarantine, retrieval, trust events with trace IDs |
| Error tracking | Redacted, no secrets in logs |
| Telemetry | Off by default, redacted when enabled |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Users / Clients                        │
│  (Web Dashboard, Browser Extension, VS Code, n8n, SDK)     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                     Load Balancer                           │
│                    (nginx / CloudFront)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Next.js Application                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  API Routes  │ │  Dashboard  │ │  Auth/SSO   │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │                   │
│  ┌──────▼───────────────▼───────────────▼──────┐           │
│  │              Guard Engine                    │           │
│  │  (13+ detectors, risk scoring, advisory)     │           │
│  └──────────────────────┬──────────────────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │PostgreSQL│ │  Qdrant  │ │  Redis   │ │ S3/Blob  │       │
│  │(primary) │ │(vectors) │ │(cache)   │ │(files)   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Security Review Checklist

- [ ] All API endpoints require authentication
- [ ] All mutations require authorization
- [ ] All user input is validated (Zod schemas)
- [ ] All secrets are hashed/encrypted at rest
- [ ] All audit events are logged
- [ ] Rate limits are enforced
- [ ] CSP headers are set
- [ ] No secrets in logs or error messages
# 2026-07-22 All-Phases Core Update

The guard-core package now exposes shared deterministic controls for the remaining master-prompt phases:

- `RuntimeDiscovery` for capability discovery and effective-risk summaries.
- `FileOperationFirewall` for routed file/change decisions.
- `NetworkEgressPolicy` for routed outbound request decisions.
- `MCPGateway` for pre-invocation MCP tool policy.
- `TaintEngine` for source-provenance and prompt-injection influence.
- `CheckpointRollback` for transaction preview and redacted checkpoint metadata.
- `GovernancePolicy` for managed enterprise policy-change validation.

These modules are enforcement building blocks, not universal platform hooks. A route is strongly enforced only when the extension, broker, agent host, MCP host, or future companion component calls the relevant module before execution.
