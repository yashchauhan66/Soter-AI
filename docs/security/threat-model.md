# Threat Model

**Date:** 2026-07-09
**Framework:** STRIDE + AI-specific threats

## Assets

| Asset | Classification | Impact |
|---|---|---|
| User passwords | RESTRICTED | Account compromise |
| API keys | CONFIDENTIAL | Unauthorized API access |
| SAML tokens | CONFIDENTIAL | Session hijacking |
| Prompt content | INTERNAL | Data leakage |
| Scan findings | INTERNAL | Security bypass |
| Billing data | CONFIDENTIAL | Financial fraud |
| Audit logs | INTERNAL | Compliance violation |
| Organization data | CONFIDENTIAL | Cross-tenant breach |

## Threat Agents

| Agent | Motivation | Capability |
|---|---|---|
| External attacker | Data theft, disruption | Network access, tooling |
| Malicious insider | Data theft, sabotage | Authenticated access |
| Compromised AI tool | Data exfiltration | Prompt manipulation |
| Malicious document | Poisoning, injection | Upload capability |
| Competitor | Intellectual property | Social engineering |

## Threats

### Spoofing

| Threat | Mitigation |
|---|---|
| API key theft | SHA-256 hashing, rate limiting, key rotation |
| Session hijacking | Secure cookies, IP binding |
| SAML assertion forgery | RSA signature verification |
| DNS spoofing | DNSSEC, HSTS |

### Tampering

| Threat | Mitigation |
|---|---|
| Prompt injection | 13+ detector pipeline, risk scoring |
| Document poisoning | Multi-layer scanning, quarantine |
| Policy tampering | HMAC-SHA256 signature verification |
| Audit log tampering | Append-only, content-addressed |

### Repudiation

| Threat | Mitigation |
|---|---|
| Action denial | Audit logs with trace IDs |
| Data access denial | Retrieval audit logs |
| Permission changes | Organization audit log |

### Information Disclosure

| Threat | Mitigation |
|---|---|
| Secret leakage | Redacted previews, no raw text |
| PII exposure | SHA-256 hashes, redaction |
| Cross-tenant data access | Namespace isolation, ACL enforcement |
| Error message leakage | Generic error messages |

### Denial of Service

| Threat | Mitigation |
|---|---|
| Rate limit bypass | Per-endpoint, per-IP, per-key limits |
| Large payload attack | Size limits (8KB text, 10MB files) |
| ReDoS | Filter length caps (500 chars) |
| Resource exhaustion | Timeouts, circuit breakers |

### Elevation of Privilege

| Threat | Mitigation |
|---|---|
| RBAC bypass | Guard functions, permission checks |
| Admin impersonation | Platform admin flag, separate from org roles |
| SSRF | URL validation, allowlists |

### AI-Specific Threats

| Threat | Mitigation |
|---|---|
| Prompt injection | Jailbreak detector, recursive injection detector |
| System prompt leak | System prompt leak detector, BLOCK action |
| Data exfiltration | Exfiltration detector, semantic egress |
| RAG poisoning | Document scanner, quarantine workflow |
| Embedding poisoning | Embedding poisoning detector |
| Tool abuse | Tool chain detection, approval workflow |
| Canary theft | Canary network, leak detection |
# 2026-07-22 All-Phases Core Delta

New deterministic controls now address additional actor paths when routed through SoterAI:

- Fallible AI: `RuntimeDiscovery`, `FileOperationFirewall`, `ControlledTerminal`, and `CheckpointRollback` reduce accidental destructive action in supported routes.
- Prompt-injected AI: `TaintEngine`, `NetworkEgressPolicy`, and `MCPGateway` escalate or deny high-risk actions influenced by untrusted sources.
- Malicious insider: `GovernancePolicy` blocks signed enterprise policy downgrade, mandatory-control removal, and non-admin enterprise changes in managed policy paths.
- Compromised MCP server: `MCPGateway` denies prompt-injected metadata, secret-bearing args, unknown servers, and disallowed permissions before invocation when the MCP host integrates.
- External attacker: `NetworkEgressPolicy` blocks cloud metadata, localhost/private destinations, dangerous redirects, and secret payloads for routed requests.

The threat model still treats raw terminals, arbitrary OS processes, other VS Code extensions, and non-gatewayed MCP hosts as outside full enforcement.
