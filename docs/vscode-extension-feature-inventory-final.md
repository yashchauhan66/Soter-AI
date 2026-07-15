# VS Code Extension Feature Inventory Final

| Feature | User Value | Implemented | Test Exists | Runtime Tested | Status | Marketplace Claim Allowed |
| --- | --- | --- | --- | --- | --- | --- |
| AI Prompt Firewall / Scan Selected Text | Scan selected prompt/text before AI use with verdict and safe copy path | Yes | Yes, static command + guard-core regressions | CLI install only; interactive flow pending | Stable | Yes, use "helps detect" wording |
| File Security Scan | Scan active file and diagnostics for risky content | Yes | Yes | CLI install only | Stable | Yes |
| Git Diff Security Scan | Scan staged/unstaged diff using fixed `git` argv | Yes | Yes, command parity + child-process guardrail | CLI install only | Stable | Yes |
| AI Context Firewall | Build/share safer AI context with policy file support | Yes | Yes | CLI install only | Stable | Yes |
| What AI Saw Ledger | Store local metadata only; no raw content by default | Yes | Yes | CLI install only | Stable | Yes |
| MCP / Agent Tool Monitor | Scan MCP configs and agent tool permissions | Yes | Yes | CLI install only | Stable | Yes |
| Terminal Command Firewall | Review dangerous commands without executing them | Yes | Yes via core/root tests and alias tests | CLI install only | Stable | Yes |
| RAG / Docs Injection Scanner | Detect malicious instructions in docs/prompts/comments through local scanner | Yes | Yes via root RAG/prompt tests | CLI install only | Stable | Yes |
| Canary Leak Detection | Generate fake canaries and detect exposure | Yes | Yes | CLI install only | Stable | Yes |
| Safe Fix Suggestions | Redaction and remediation guidance in scan outputs | Partial | Yes for redaction safety | CLI install only | Beta | Limited |
| Local-First Privacy Mode | Local mode default; no telemetry flush in local/untrusted workspaces | Yes | Yes | CLI install only | Stable | Yes |
| Workspace Trust Safety | Cloud/token/remote features gated in untrusted workspaces | Yes | Yes | CLI install only | Stable | Yes |
| Enterprise Policy Packs | Apply built-in policy packs | Yes | Yes for commands | CLI install only | Stable | Yes |
| Quick Start / Health / Settings / Demo | Native first-run and support commands | Yes | Yes | CLI install only | Stable | Yes |

Runtime tested means interactive command execution inside the VS Code UI. This session verified VSIX install/list through VS Code CLI but did not complete manual UI runtime flows.
