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

- **Reduce accidental exposure on managed paths**: apply accepted exclusions
  and recognized-value redaction before you share candidate context. Unknown
  private information can remain and needs user classification/review.
- **Block protected, SoterAI-managed secrets** from SoterAI-built context.
- **Move real secrets into the Protected Vault** (encrypted, outside the
  workspace) so reviewed values in the changed files use placeholders. Original
  buffers, history, other copies and same-user credential access remain gaps.
- **Detect and alert on leakage** via canaries and the output-leak monitor.
- **Provide auditability**: the "What AI Saw" ledger records decisions, hashes,
  and redacted evidence — never raw secrets.
- **Surface risk**: AI extensions, MCP tool permissions, risky terminal commands.

## A workflow for reducing accidental exposure

1. Move real secrets into the [Protected Secret Vault](protected-secret-vault.md)
   so they are not present in workspace files.
2. Share **only** SoterAI-built [safe context](ai-context-firewall.md).
3. Plant [canaries](canary-secret-system.md) and scan AI output for leakage.
4. Review [AI extensions](llm-extension-risk-scanner.md) and
   [MCP permissions](mcp-tool-permission-monitor.md).

## For stronger, OS-level enforcement

Stronger process, filesystem and network mediation requires authority outside
the agent plus exact deployment evidence. The [Local Guard Agent plan](local-guard-agent-enforcement-plan.md)
is a design reference, not implemented mandatory mediation. OS mechanisms alone
do not establish coverage of all agents, aliases, UI paths or lifecycle events.

Selected-architecture **G1–G6 remain UNTESTED; full claim BLOCKED**. Separate-account
deployment remains **DEFERRED**. Setup, a healthy broker, encrypted storage,
editor modal and synthetic capability checks do not clear those gates. No
percentage of user data protected is measured.
