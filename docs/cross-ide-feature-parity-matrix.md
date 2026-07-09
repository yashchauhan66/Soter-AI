# Cross-IDE feature parity matrix

Status date: 2026-07-06. This is the target design matrix, not a completed-test report.

Legend: **S** supported in the planned native MVP; **P** partial because the host cannot provide full mediation or UI parity; **B** requires the Local AI Broker; **F** needs a future privileged/host agent; **N** not possible through the currently documented public extension API. Combined values describe dependencies, for example **P/B**.

| Feature | VS Code | Cursor/OpenVSX | JetBrains | Visual Studio | Neovim | Sublime | Eclipse | JupyterLab |
|---|---|---|---|---|---|---|---|---|
| Scan Selection | S | S | B | B | B | B | B | B |
| Redact Selection for AI | S | S | B | B | B | B | B | B |
| Scan Current File | S | S | B | B | B | B | B | B |
| Scan Workspace Risk | S | S | B | P/B | B | P/B | P/B | P/B |
| Scan Git Changes | S | S | B | P/B | B | P/B | P/B | P/B |
| Terminal Command Checker | P | P | P/B | P/B | P/B | P/B | P/B | P/F |
| Safe Prompt Builder | S | S | B | B | B | B | B | B |
| AI Context Inspector | S | P | B | P/B | P/B | P/B | P/B | P/B |
| AI Safe Mode | B | B | B | B | B | B | B | B |
| AI Memory Inspector | B | B | B | B | P/B | P/B | P/B | B |
| Local AI Broker start/status | S | S | P/B | P/B | P/B | P/B | P/B | P/B |
| MCP Scanner | S | S | B | B | B | B | B | P/B |
| LLM Extension Risk Scanner | S | P | P/F | P/F | P/F | P/F | P/F | P/F |
| What AI Saw Ledger | B | B | B | B | B | B | B | B |
| Canary Leak Detection | S/B | S/B | B | B | B | B | B | B |
| Protected Secret Vault | S | S | P/B | P/B | P/B | P/B | P/B | P/B |
| AI Output Leak Monitor | P/B | P/B | P/B | P/B | P/B | P/B | P/B | P/B |
| Policy Config | S | S | B | B | B | B | B | B |
| Report Export | S | S | B | B | B | B | B | B |
| Cloud Connect | P/B | P/B | P/B | P/B | P/B | P/B | P/B | P/B |
| Approval Workflow | B | B | B | B | B | B | B | B |

## Interpretation boundaries

- `S` means a public host API is suitable for the intended workflow. It does not mean the current repository has passed that platform's release gate.
- Terminal checking is partial everywhere unless users execute through a SoterAI wrapper or the broker/tool approval path. Native extensions cannot promise observation of every command typed into every terminal.
- Context inspection shows context explicitly gathered or routed through SoterAI. It cannot reveal the private prompt construction of unrelated proprietary AI assistants.
- The LLM extension risk scanner can inspect public manifests, permissions, configuration, package contents available to the host, and known indicators. Cross-extension private runtime state and network traffic need a future OS/host agent and may remain prohibited.
- Protected Secret Vault parity depends on a real secure-storage primitive. Where one is absent, the broker or OS credential store owns the secret; plaintext editor settings are not an accepted fallback.
- JupyterLab may run in a browser connected to a remote server. Broker-dependent features are partial until pairing/routing is explicit and authenticated.
- Cloud Connect sends only approved, minimized/redacted data. Raw source, prompts, secrets, notebook output, and terminal output remain local by default.

## Release-record rule

When an adapter ships, copy this target row into its test report and replace symbols with evidence-linked **PASS**, **PARTIAL**, **FAIL**, or **NOT TESTED** results. Never promote an inferred target capability into a support claim.
