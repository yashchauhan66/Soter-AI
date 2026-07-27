# Pick a policy pack for your team

Policy packs tune SoterAI Guard's strictness to how your team works — one click, no config files to hand-write.

- **Startup Default** — balanced protection for fast-moving teams.
- **Strict Enterprise** — maximum sensitivity, minimal risk tolerance.
- **AI Coding Assistant Safe Mode** — tuned for Copilot / Cursor / Claude workflows (enforced on brokered traffic when the local broker is running; un-brokered paths remain monitored).
- **No Secrets to AI** — policy prefers block/redact for secret categories on SoterAI-routed scans and safe-context builds. Does **not** OS-block other extensions, raw terminals, or processes that read files directly — migrate secrets to the vault/broker for real enforcement.
- **MCP Lockdown** — least-privilege **config** rules and deny-lists for MCP / agent tools. Config scanning is detection-only unless tool calls are routed through a SoterAI MCP gateway (not wired in the packaged extension today).

Press the button to choose a pack. Your choice is saved to workspace or user settings.
