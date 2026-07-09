# Data Flow Diagram

**Date:** 2026-07-09

## Overview

This document describes how data flows through the SoterAI platform, highlighting security controls at each stage.

## Data Flows

### 1. Guard API Request Flow

```
Client → API Gateway → Rate Limiter → Auth → Guard Engine → Response
                            │            │         │
                            ▼            ▼         ▼
                       Rate limit    API key    13+ detectors
                       check         verify     risk scoring
                                                    │
                                                    ▼
                                               Findings + Advisory
```

**Security controls:**
- Rate limiting (per-key, per-IP)
- API key SHA-256 verification
- Input validation (Zod)
- No raw text persisted (hashes only)

### 2. Document Ingestion Flow

```
Upload → Content-Length Check → File Validation → Text Extraction → Scanning → Storage
              │                      │                  │              │
              ▼                      ▼                  ▼              ▼
         10MB limit           Magic-byte          PDF/OCR/Text    13+ detectors
                              detection           extraction      8 doc rules
                                                                    │
                                                                    ▼
                                                              Quarantine/Safe
```

**Security controls:**
- Extension whitelist
- Magic-byte verification
- PDF structural inspection
- OCR sandbox with timeout
- Secret redaction before storage
- Auto-quarantine on risk

### 3. RAG Retrieval Flow

```
Query → Auth → Vector Search → Authorization Filter → Grounding Guard → Response
              │         │              │                      │
              ▼         ▼              ▼                      ▼
         RBAC check  Namespace    12-layer ACL          Leakage detection
                     isolation    evaluation            Citation verification
```

**Security controls:**
- Namespace isolation (org + project)
- Deny-first authorization
- Permission versioning
- Query hash in audit logs

### 4. Webhook Delivery Flow

```
Event → Webhook Store → HMAC Signing → Delivery → Retry → Audit
                         │                           │
                         ▼                           ▼
                    HMAC-SHA256                  3 attempts
                    signature                   with backoff
```

**Security controls:**
- HMAC-SHA256 signature
- Event deduplication
- Retry with exponential backoff
- Delivery logs

### 5. SAML SSO Flow

```
User → App → IdP → SAML Response → ACS → Validation → Session
                       │                   │
                       ▼                   ▼
                   Signed assertion    Signature verify
                                       Audience check
                                       Timing window
                                       Replay check
```

**Security controls:**
- RSA-SHA256 signature verification
- Audience restriction
- NotBefore/NotOnOrAfter timing
- Replay protection
- IP + User-Agent binding

### 6. Billing Flow

```
Checkout → Razorpay → Payment → Activate → Subscription
              │                     │
              ▼                     ▼
         Order creation       HMAC verification
                              Server-side activation
```

**Security controls:**
- Server-side payment verification
- HMAC-SHA256 signature
- Mock mode blocked in production
- No secret in logs

## Data Residency

| Data Type | Location | Retention |
|---|---|---|
| User accounts | PostgreSQL | Until deletion |
| API keys | PostgreSQL (hashed) | Until revocation |
| Audit logs | PostgreSQL | Per retention policy |
| Vector embeddings | Qdrant/pgvector | Until document deletion |
| Files | S3/local storage | Per retention policy |
| Sessions | Redis/memory | 24 hours |
| Rate limits | Redis/memory | Per window |
