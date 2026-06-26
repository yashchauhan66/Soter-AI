# SoterAI — Security Summary

> For marketplace security disclosures, app review submissions, and trust pages.

---

## Architecture

- **API-only integration**: All platform nodes/plugins are thin HTTP clients. No security detection logic runs locally in the integration packages.
- **Server-side analysis**: All prompt injection, jailbreak, PII, and output safety analysis runs on SoterAI's policy engine.
- **Stateless connectors**: Integration nodes store no user data, no conversation history, and no secrets beyond the API key in the platform's credential store.

## Transport security

- All API communication uses HTTPS (TLS 1.2+)
- API keys are transmitted in the `x-api-key` header, never in URLs or query parameters
- No sensitive data appears in URLs or access logs

## Credential security

- API keys are stored in each platform's encrypted credential store (n8n credential vault, Zapier auth store, etc.)
- API keys are never logged, never included in error messages, and never exposed in workflow outputs
- Keys support rotation — generate a new key and revoke the old one at any time

## Input validation

- All inputs are validated client-side before making API calls (text length, metadata shape, parameter values)
- Server-side validation enforces limits independently
- Invalid inputs return clear error messages without leaking internal state

## Error handling

- Error messages never contain API keys, raw user text, or internal stack traces
- Network failures, timeouts, and rate limits are handled with retries and clear error types
- The `continueOnFail` pattern (n8n) and equivalent per-platform error handling ensure workflow resilience

## Supply chain

- Integration packages have minimal dependencies (n8n-workflow for n8n, stdlib-only for Python packages)
- No third-party HTTP clients, no analytics SDKs, no telemetry libraries
- Packages are built with TypeScript strict mode and type checking

## OWASP LLM Top 10 coverage

SoterAI provides protection against the following OWASP LLM Top 10 risks:

| Risk | SoterAI Coverage |
|------|-----------------|
| LLM01: Prompt Injection | Input Guard detects direct and indirect injection |
| LLM02: Insecure Output Handling | Output Guard checks AI responses |
| LLM06: Sensitive Information Disclosure | PII Redactor + Output Guard |
| LLM05: Supply Chain Vulnerabilities | RAG Scanner for knowledge base poisoning |
| LLM08: Excessive Agency | Input Guard flags scope-escalation attempts |

## Responsible disclosure

Security vulnerabilities can be reported to security@soterai.dev. We follow coordinated disclosure practices.

## Contact

Security team: security@soterai.dev
