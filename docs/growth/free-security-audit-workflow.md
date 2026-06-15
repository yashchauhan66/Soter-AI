# Free Security Audit Workflow

## Authorization Gate

Do not test until the owner provides written permission defining the target, environment, dates, allowed checks, rate limit, data restrictions, emergency contact, and stop procedure. The audit is defensive, non-destructive, and limited to owned or explicitly authorized systems.

## Intake

- Company and technical owner.
- Chatbot URL or demo environment.
- Ownership and authorization evidence.
- Chatbot type, model provider, RAG usage, tools/actions, and data classes.
- Allowed test window and traffic limit.
- Explicit exclusions and stop conditions.

## Procedure

1. Confirm scope and permission.
2. Capture a safe baseline response.
3. Run synthetic prompt-injection checks.
4. Run safe system-prompt leakage checks without seeking private data.
5. Use fictional PII and dummy secrets for leakage/redaction checks.
6. Check unsafe-response handling with defensive examples.
7. If RAG is in scope, test approved synthetic documents for indirect injection, source isolation, and no-source behavior.
8. Stop immediately on instability, unexpected private data, or owner request.
9. Redact evidence and generate the report.
10. Review the top five issues and offer a 14-day Guard integration.

## Prohibited Activity

- Testing third-party or production systems without permission.
- Destructive payloads, denial of service, credential attacks, or persistence.
- Attempting to retrieve real private data or system prompts.
- Uploading malware or unapproved documents.
- Treating the audit as certification or proof of complete security.

## Deliverable

- Methodology-based security score with untested areas marked `N/T`.
- Top risks and OWASP LLM Top 10 mapping.
- Redacted screenshots or request IDs.
- Observed behavior, business impact, and recommended fix.
- Relevant CyberRakshak Guard control and remaining limitation.
- Proposed integration scope, owner, and next decision date.

## Conversion Handoff

Ask: "Would you like us to protect this owned workflow for 14 days and measure blocked risks, redactions, reports, and operational fit?"
