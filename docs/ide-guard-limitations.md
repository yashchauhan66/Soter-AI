# SoterAI IDE Guard — Limitations (read this)

SoterAI IDE Guard is honest about what a VS Code extension can and cannot do. We
use precise language on purpose.

## What SoterAI **cannot** guarantee

- **It cannot guarantee blocking every other extension from reading normal
  workspace files.** A VS Code extension runs in the same user/process/workspace
  trust context as every other extension. Any extension (including an AI
  assistant) can read a file you have open or that exists in the workspace,
  unless that file has been removed/virtualized/protected outside normal
  workspace access.
- It cannot intercept another extension's internal file reads.
- It cannot see, at runtime, exactly what an AI tool sent to a remote model.
- Extension "AI/malware" risk scoring is **heuristic**, from local metadata — it
  is not definitive malware detection.
- It cannot force an MCP host or another AI tool to honor SoterAI's policy.

## What SoterAI **can** do (best-effort, honest)

- **Prevent accidental exposure**: gate and inspect AI context before you share
  it; build secret-free "safe context" and prompts.
- **Block protected, SoterAI-managed secrets** from SoterAI-built context.
- **Move real secrets into the Protected Vault** (encrypted, outside the
  workspace) so workspace files hold only placeholders — this is the strongest
  practical protection today.
- **Detect and alert on leakage** via canaries and the output-leak monitor.
- **Provide auditability**: the "What AI Saw" ledger records decisions, hashes,
  and redacted evidence — never raw secrets.
- **Surface risk**: AI extensions, MCP tool permissions, risky terminal commands.

## The strongest protection available today

1. Move real secrets into the [Protected Secret Vault](protected-secret-vault.md)
   so they are not present in workspace files.
2. Share **only** SoterAI-built [safe context](ai-context-firewall.md).
3. Plant [canaries](canary-secret-system.md) and scan AI output for leakage.
4. Review [AI extensions](llm-extension-risk-scanner.md) and
   [MCP permissions](mcp-tool-permission-monitor.md).

## For stronger, OS-level enforcement

Stronger process/tool/filesystem mediation requires the
[Local Guard Agent](local-guard-agent-enforcement-plan.md). Even then, "100%
block every extension" is only achievable with OS-level controls (sandboxing,
per-process ACLs, EDR) — we will not claim it otherwise.
