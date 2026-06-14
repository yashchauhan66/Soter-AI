# OWASP LLM Top 10 coverage

CyberRakshak Guard is OWASP LLM Top 10 aligned, not certified and not a promise of complete security.

| Risk | Defensive controls |
| --- | --- |
| LLM01 Prompt Injection | Rule, multilingual, document, indirect-injection, and quarantine controls |
| LLM02 Sensitive Information Disclosure | PII/secrets redaction, private-source checks, redacted logs |
| LLM03 Supply Chain | Dependency lockfile, container build, provider health boundaries |
| LLM04 Data and Model Poisoning | RAG scanning, approval workflow, poisoning scenarios |
| LLM05 Improper Output Handling | Output guard, safe rewrite/block actions |
| LLM06 Excessive Agency | Tool misuse scenarios, authorization guidance, human review |
| LLM07 System Prompt Leakage | Input/output leak detectors and no raw prompt logging |
| LLM08 Vector and Embedding Weaknesses | Tenant namespaces, ACL/sensitivity post-filter, retrieval audits |
| LLM09 Misinformation | Source coverage, citation checks, no-source fallback |
| LLM10 Unbounded Consumption | Rate limits, cost-abuse scenarios, bounded OCR/retrieval |
