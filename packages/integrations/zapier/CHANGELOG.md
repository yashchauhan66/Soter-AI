## 0.1.0

Initial release to public.

- New action: create/input_guard checks user input for prompt injection, jailbreaks, PII, and unsafe content before it reaches an AI model.
- New action: create/output_guard checks AI-generated responses for unsafe content, system prompt leakage, and PII before delivery.
- New action: create/pii_redactor redacts personally identifiable information and secrets from text.
- New action: create/rag_scanner scans documents for threats before RAG or vector database ingestion.
