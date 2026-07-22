# Incident Response Plan

**Date:** 2026-07-09
**Status:** SOC2-ready / preparation

## Incident Classification

| Severity | Description | Response Time | Examples |
|---|---|---|---|
| P1 - Critical | Data breach, service down | 1 hour | Cross-tenant breach, data exfiltration |
| P2 - High | Security bypass, service degraded | 4 hours | Auth bypass, rate limit bypass |
| P3 - Medium | Suspicious activity | 24 hours | Failed auth attempts, unusual queries |
| P4 - Low | Minor issue | 72 hours | Single-user error, cosmetic bug |

## Response Process

### 1. Detection & Triage

| Step | Action | Owner |
|---|---|---|
| 1.1 | Detect incident (monitoring, alerts, reports) | On-call engineer |
| 1.2 | Classify severity | On-call engineer |
| 1.3 | Notify incident commander (P1/P2) | On-call engineer |
| 1.4 | Create incident ticket | Incident commander |

### 2. Containment

| Step | Action | Owner |
|---|---|---|
| 2.1 | Isolate affected systems | Engineering |
| 2.2 | Revoke compromised credentials | Security |
| 2.3 | Block malicious IPs/accounts | Security |
| 2.4 | Preserve evidence | Forensics |

### 3. Eradication

| Step | Action | Owner |
|---|---|---|
| 3.1 | Identify root cause | Engineering |
| 3.2 | Remove threat | Engineering |
| 3.3 | Patch vulnerabilities | Engineering |
| 3.4 | Verify cleanup | Security |

### 4. Recovery

| Step | Action | Owner |
|---|---|---|
| 4.1 | Restore from clean backups | Engineering |
| 4.2 | Reset affected credentials | Security |
| 4.3 | Monitor for recurrence | Security |
| 4.4 | Verify service health | Engineering |

### 5. Communication

| Step | Action | Owner |
|---|---|---|
| 5.1 | Notify affected users (P1/P2) | Legal/Comms |
| 5.2 | Notify regulators (if required) | Legal |
| 5.3 | Publish post-mortem | Engineering |
| 5.4 | Update documentation | Security |

## Contact Matrix

| Role | Contact | When |
|---|---|---|
| Incident Commander | support@soterai.in | P1/P2 incidents |
| Security Lead | support@soterai.in | All security incidents |
| Legal | support@soterai.in | Data breach, regulatory |
| Comms | support@soterai.in | User notification |

## Post-Incident

- [ ] Root cause analysis completed
- [ ] Remediation actions tracked
- [ ] Documentation updated
- [ ] Lessons learned shared
- [ ] Monitoring improved
