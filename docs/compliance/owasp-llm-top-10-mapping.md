# OWASP LLM Top 10 Mapping

CyberRakshak Guard is OWASP LLM Top 10 aligned. Alignment means mapped risk-reduction controls, not complete protection.

| OWASP category | Product coverage |
| --- | --- |
| LLM01 Prompt Injection | Prompt injection detectors, policy engine, document scanning, red-team suite |
| LLM02 Sensitive Information Disclosure | PII/secrets redaction, safe logging, webhook payload minimization |
| LLM03 Supply Chain | Dependency audit, self-hosted deployment docs, vendor-risk checklist |
| LLM04 Data and Model Poisoning | RAG quarantine, classifier evaluation, feedback review |
| LLM05 Improper Output Handling | Unsafe output guard and downstream event filtering |
| LLM06 Excessive Agency | API-level RBAC, authorized-only red team, integration scoping |
| LLM07 System Prompt Leakage | System prompt leak detector and persistence safeguards |
| LLM08 Vector and Embedding Weaknesses | Tenant vector namespaces, ACL filtering, retrieval audit logs |
| LLM09 Misinformation | Grounding guard, citation checks, no-source fallback |
| LLM10 Unbounded Consumption | Rate limiting, quotas, billing controls, admin overrides |
