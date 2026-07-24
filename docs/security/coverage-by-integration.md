# Coverage By Integration

Date: 2026-07-22

| Integration/path | Coverage level | What is covered | What remains outside coverage |
|---|---|---|---|
| SoterAI Local Broker | STRONG_ENFORCEMENT | Scoped credential capability calls, expiry, use count, workspace binding, revocation, response scanning | Any credential use that bypasses the broker |
| SoterAI safe context commands | STRONG_ENFORCEMENT | Context built by SoterAI excludes protected files and redacts/tokenizes known secrets | Manual copy/paste after generation and direct model calls from other tools |
| VS Code file scan/live diagnostics | PARTIAL_VISIBILITY | Local detection of secrets, PII, injection, risky code patterns | Other processes can read/write files before or without scanning |
| VS Code manual terminal review | DETECTION_ONLY | Pasted command risk review with deterministic reason codes | Actual terminal execution path, subprocesses, shell expansion, network |
| VS Code controlled terminal via local broker | STRONG_ENFORCEMENT for allowlisted fixed-argv commands | Preview and execution through authenticated broker endpoints; shell syntax and non-allowlisted commands denied before spawn; stdout/stderr redacted | Any raw terminal, external shell, child-process tree behavior, aliases/functions, and OS-level network egress |
| Guard-core file/change policy API | STRONG_ENFORCEMENT for routed file operations | Normalizes paths, checks realpath escape, hidden files, protected files, mass changes, and security-sensitive paths before execution | Any direct OS file operation that bypasses the policy |
| Guard-core network egress policy API | STRONG_ENFORCEMENT for routed requests | Blocks metadata/private redirects, secret payloads, non-HTTPS risk, and unknown writes according to mode | Arbitrary process egress without a SoterAI proxy/wrapper |
| Guard-core MCP gateway API | STRONG_ENFORCEMENT for gateway-routed tool calls | Validates server inventory, permissions, taint, prompt-injection metadata, and secret-bearing args | MCP hosts/tools not integrated with the gateway |
| Guard-core taint policy API | STRONG_ENFORCEMENT for routed decisions with provenance | Escalates high-risk actions influenced by untrusted or prompt-injected sources | Unknown provenance and unobserved third-party actions |
| Guard-core checkpoint/governance APIs | PARTIAL_VISIBILITY to STRONG_ENFORCEMENT by route | Preview/checkpoint metadata is partial; policy-change validation is strong when routed through managed policy paths | External cloud/database rollback and unmanaged policy edits |
| VS Code clipboard safe paste | STRONG_ENFORCEMENT for SoterAI command path | Redacted clipboard content inserted through SoterAI | Ordinary OS clipboard operations |
| Git diff scan | PARTIAL_VISIBILITY | Scans staged/unstaged diff and names sensitive changed files | Does not block raw `git commit`, `git push`, force push, or branch deletion |
| MCP config scanner | PARTIAL_VISIBILITY | Scans known config files/tool metadata for dangerous capabilities and injection phrasing | Does not enforce runtime calls unless traffic is routed through a gateway |
| Unknown third-party AI extension | UNSUPPORTED | SoterAI can warn and provide safe context | It cannot prove or block what that extension sends |
| Browser extension/web app paths in this repo | PARTIAL_VISIBILITY | Local scanning and backend policies covered by existing tests | Browser/OS/network activity outside instrumented paths |
| Server-side API guard routes | STRONG_ENFORCEMENT for tested routes | Auth, tenancy, redaction, rate limits, URL validation in specific APIs | Does not protect local IDE processes by itself |
