## 0.2.0

Full parity with the n8n node and the Make app — all three now expose the same
12 operations, so switching platforms no longer means losing a guard.

- New action: create/analyze_text runs the public analysis endpoint in either direction, and works without an API key (rate-limited).
- New action: create/streaming_guard inspects chunked or streamed LLM content and returns per-chunk results plus the highest risk score and the index of the first risky chunk — values a linear Zap cannot compute for itself.
- New action: create/universal_guard checks input and output in one step under a protection profile (Balanced / Strict / Maximum) and returns a single combined verdict.
- New action: create/workflow_audit runs a static OWASP-LLM audit of an exported workflow. The audit never executes the workflow, resolves a credential, or contacts anything the workflow references, and the export is not stored.
- New actions: create/start_agent_session, create/agent_action_check, create/agent_data_check, create/agent_output_check bring the Agent Firewall to Zapier — approve tool calls, data access, and agent output against one session's policy.
- Input Guard and Output Guard now return `primaryRiskType`, `categoryConfidence`, and `latencyMs`. Filter on `primaryRiskType` rather than `categories[0]`: that array is in detector-registration order, which is why a SQL payload could previously read as a prompt injection.
- Input Guard gains optional Allowed Topics and System Prompt Context fields for the off-topic guard. Leaving them empty keeps the previous behaviour — an empty topic list means no scope is defined, not that everything is off-topic.
- On every agent action, `allowed` is derived from the decision, so `ASK_APPROVAL` is never read as permission to proceed.

## 0.1.0

Initial release to public.

- New action: create/input_guard checks user input for prompt injection, jailbreaks, PII, and unsafe content before it reaches an AI model.
- New action: create/output_guard checks AI-generated responses for unsafe content, system prompt leakage, and PII before delivery.
- New action: create/pii_redactor redacts personally identifiable information and secrets from text.
- New action: create/rag_scanner scans documents for threats before RAG or vector database ingestion.
