# WhatsApp Chatbot Security Setup

Use CyberRakshak Guard only for owned or authorized WhatsApp chatbot deployments.

1. Route inbound WhatsApp messages through `/api/guard/input` before sending them to the LLM or RAG layer.
2. Route model responses through `/api/guard/output` before replying to users.
3. Enable India PII redaction for phone numbers, Aadhaar-like values, PAN-like values, UPI IDs, and customer identifiers.
4. Configure webhooks for blocked prompts, secrets, PII redactions, and usage limits.
5. Use project-level API keys per client or brand.
6. Give agencies white-label reports with only redacted evidence.

Do not test against customer systems without written authorization.

