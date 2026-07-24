# Terminal Firewall

Date: 2026-07-22

## Current state

SoterAI provides two terminal-related paths:

- `soterai.checkTerminalCommand` scans a pasted command locally, applies detector categories, and passes the result through `RuntimePolicyEngine`. It is advisory because it does not execute or intercept the command.
- `soterai.runControlledTerminalCommand` routes execution through the authenticated local broker endpoints `/v1/terminal/preview` and `/v1/terminal/execute`. The broker parses to fixed argv, rejects shell syntax, applies a read-only allowlist, and executes with `execFile` using `shell: false`.

Coverage level for manual review: `DETECTION_ONLY`.

Coverage level for broker-controlled execution: `STRONG_ENFORCEMENT` for the commands in the fixed allowlist only.

## Implemented behavior

- Destructive categories such as recursive delete, disk wipe, fork bomb, Kubernetes destructive operations, and Docker aggressive cleanup produce `DENY`.
- Remote execution categories such as `curl | sh`, encoded execution, and reverse shell produce `DENY`.
- Suspicious parser failures with no detector match produce `ASK` in standard mode and `DENY` in strict/enterprise-like modes.
- Enterprise policy mode maps to `enterprise_locked`.
- The user-facing high-risk message no longer echoes the full pasted command.
- The message includes coverage and machine-readable reason codes.
- Controlled broker execution currently allows read-only operations such as `git status`, safe `git diff`/`git log`/`git show`, `git branch --show-current`, version checks for `npm`/`node`/`python`, `pwd`, and simple `ls`.
- Controlled broker execution denies shell metacharacters, pipes, redirects, command substitution, unknown commands, destructive commands, and Python code execution before spawning a process.
- Controlled broker execution redacts stdout/stderr before returning output to the extension.

## Not implemented

The extension does not yet:

- Intercept arbitrary integrated terminal input.
- Control child processes outside the broker-controlled route.
- Prevent aliases/functions from changing behavior.
- Prevent background/orphan processes.
- Enforce network egress for raw shell processes.
- Enforce cloud, database, Docker, or Kubernetes CLI actions unless routed through a future controlled broker/wrapper rule.

## Required next design

The next hardening step toward a true terminal firewall is a controlled terminal or shell wrapper that:

- Parses PowerShell, cmd.exe, POSIX shell, Bash/Zsh, and WSL forms.
- Executes through a broker with fixed argv where possible.
- Tracks child processes and blocks unapproved spawned children.
- Enforces resource limits and timeouts.
- Records effect metadata without secrets.
- Makes the controlled route the only supported AI-agent execution path for strong claims.
