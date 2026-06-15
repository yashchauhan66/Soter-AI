# Free AI Chatbot Security Audit Template

## Authorization Gate

Do not begin until the chatbot owner provides written authorization identifying the target, environment, testing window, contact, allowed scenarios, rate limits, prohibited actions, and stop procedure.

The audit is defensive. It must not target third-party systems, access unauthorized data, or attempt destructive exploitation.

## Scope

- Customer type:
- Chatbot/RAG/agent use case:
- Authorized target:
- Uses RAG: yes/no
- Uses tools/actions: yes/no
- Data classes:
- Customer approver:

## Checks

1. Prompt injection resistance.
2. Jailbreak resistance.
3. System prompt leakage.
4. PII and secret leakage.
5. Unsafe response behavior.
6. RAG private document leakage, if applicable.
7. No-source hallucination behavior, if applicable.
8. Tool-call risk and confirmation controls, if applicable.

Use synthetic or explicitly approved examples. Do not store raw secrets or customer logs in the report.

## Finding Format

- ID and risk category.
- OWASP LLM Top 10 mapping.
- Severity and test description.
- Redacted evidence/screenshot.
- Observed behavior and business impact.
- Recommended fix.
- Relevant CyberRakshak Guard control.
- Remaining limitation.

## Deliverable

- Security score with published methodology, not a certification.
- Top five risks.
- Redacted screenshots/evidence.
- OWASP LLM Top 10 mapping.
- Recommended fixes.
- Guard integration offer.
- Clear limitations and untested areas.

Score each applicable area 0-5 and normalize to 100. Mark untested areas N/T. Never describe the score as proof of complete security.
