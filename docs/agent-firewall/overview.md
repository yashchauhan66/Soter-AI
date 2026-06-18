# cybersecurityguard Agent Firewall Overview

cybersecurityguard Agent Firewall protects AI agents before they touch browsers, files, email, calendars, terminals, APIs, MCP tools, local documents, clipboards, external websites, RAG data, or private user data.

Prompt scanning alone is not enough for computer-use agents. The protected flow is:

1. Run `guard.input()` before the LLM plans.
2. Run `agentFirewall.checkAgentAction()` before every tool call.
3. Run `agentFirewall.checkDataLeak()` before data leaves the user environment.
4. Execute the tool only when the decision allows execution.
5. Run `agentFirewall.checkAgentOutput()` on tool results and final output.
6. Save an audit log with redacted-only content.

Decisions:

- `ALLOW`: safe to execute normally.
- `READ_ONLY`: safe read/search action.
- `REDACT`: execute only with `safeContent`.
- `ASK_APPROVAL`: pause and ask a human.
- `SANDBOX_ONLY`: execute only in an isolated environment.
- `BLOCK`: do not execute.

cybersecurityguard fails closed for risky actions when checks are unavailable or rate-limited.
