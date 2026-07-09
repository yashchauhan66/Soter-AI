# Logging & Monitoring Policy

**Date:** 2026-07-09
**Status:** SOC2-ready / preparation

## Logging Principles

1. **No secrets in logs** — all sensitive data is redacted or hashed
2. **Audit everything** — all mutations are logged
3. **Privacy-safe** — queries are SHA-256 hashed, not stored raw
4. **Retention-aware** — logs expire per retention policy
5. **Tamper-evident** — append-only, content-addressed

## Log Types

### Application Logs

| Type | Content | Retention | Storage |
|---|---|---|---|
| Request logs | Method, path, status, latency | 30 days | stdout/stderr |
| Error logs | Stack trace, context | 90 days | stdout/stderr |
| Security events | Event type, actor, target | 1 year | PostgreSQL |

### Audit Logs

| Type | Content | Retention | Storage |
|---|---|---|---|
| Organization audit | Action, actor, target, timestamp | 1 year | PostgreSQL |
| Retrieval audit | Query hash, chunk IDs, authorization | 1 year | PostgreSQL |
| Answer audit | Answer hash, source count, coverage | 1 year | PostgreSQL |
| Plan change log | From plan, to plan, reason | Indefinite | PostgreSQL |

### Security Events

| Event Type | Description | Severity |
|---|---|---|
| `rag.document_quarantined` | Document failed security scan | HIGH |
| `rag.unauthorized_retrieval` | Cross-tenant access attempt | CRITICAL |
| `billing.webhook_invalid_signature` | Webhook signature mismatch | HIGH |
| `auth.login_failure` | Failed login attempt | MEDIUM |
| `auth.rate_limited` | Rate limit exceeded | LOW |

## Monitoring

### Health Checks

| Endpoint | Frequency | Threshold |
|---|---|---|
| `/api/health` | Every 5 min | < 2s response |
| Database connection | Every 1 min | < 500ms |
| Vector store | Every 5 min | < 1s response |
| Redis | Every 1 min | < 100ms |

### Alerting

| Condition | Severity | Action |
|---|---|---|
| Error rate > 5% | HIGH | Page on-call |
| Latency p95 > 5s | MEDIUM | Notify team |
| Disk usage > 80% | MEDIUM | Notify team |
| Failed login spike | HIGH | Investigate |
| Cross-tenant attempt | CRITICAL | Immediate response |

### Dashboards

| Dashboard | Content |
|---|---|
| Guard Engine | Request volume, risk scores, action distribution |
| API Performance | Latency, throughput, error rates |
| Security | Quarantine rate, unauthorized attempts |
| Billing | Subscription status, payment failures |

## Log Redaction

| Data Type | Redaction Method |
|---|---|
| Passwords | Never logged |
| API keys | First 12 chars only |
| PII | SHA-256 hash |
| Query text | SHA-256 hash |
| Document content | SHA-256 hash |
| Payment details | Never logged |

## Compliance

- [ ] All PII is redacted or hashed
- [ ] No secrets in logs
- [ ] Audit logs are append-only
- [ ] Retention policies are enforced
- [ ] Alerts are configured and tested
