# SoterAI IDE Guard Bypass Matrix

Date: 2026-07-22

This matrix lists paths that remain outside full enforcement after the current all-phases core hardening pass.

| Bypass path | Current coverage | Why it can bypass | Current mitigation | Required next control |
|---|---|---|---|---|
| Other VS Code extension reads `.env` directly | PARTIAL_VISIBILITY | VS Code extensions share host access; SoterAI cannot stop another extension's file read | Risk scanner, protected-file warnings, vault migration, safe context builder | VS Code host isolation is unavailable; use broker/vault and enterprise extension allowlisting |
| Raw integrated terminal command execution | DETECTION_ONLY | Manual review command does not intercept all terminal input or spawned processes | `soterai.checkTerminalCommand` with deterministic `DENY`/`ASK` reason codes | Controlled terminal/shell wrapper that is the only approved AI execution route |
| Shell child process spawned by an approved parent | UNSUPPORTED | No process tree monitor or sandbox in current extension code path | Documentation and command-risk detection | Local broker/sandbox launcher with process-tree enforcement |
| Network upload from arbitrary process | UNSUPPORTED | No local network proxy or OS firewall hook | `NetworkEgressPolicy` enforces only when a caller routes the request through it | Local network egress proxy with DNS, redirect, private IP, payload classification |
| Direct authenticated cloud CLI use | DETECTION_ONLY | Raw credentials and cached sessions are controlled by the CLI/OS, not the extension | Terminal review can flag obvious destructive commands | Credential capability broker for cloud/Kubernetes/Docker operations |
| MCP server with hidden side effects outside SoterAI gateway | UNSUPPORTED for runtime enforcement | Config scanning cannot verify runtime side effects | `MCPGateway` enforces only when the host routes tool calls through it | Require gateway integration or broker-launched MCP servers |
| Clipboard use outside SoterAI commands | UNSUPPORTED | OS clipboard is not globally intercepted | Safe paste and scan clipboard commands | Platform-specific clipboard monitor, if acceptable to privacy policy |
| Git force push from raw terminal | DETECTION_ONLY | Extension scans diffs but does not intercept `git push` | Git-diff scanner and terminal detector | Git broker/wrapper or pre-push hook managed by enterprise policy |
| Dependency lifecycle scripts from raw package manager command | DETECTION_ONLY | Package managers execute outside SoterAI unless routed through controlled path | Dependency guard command review | Package install broker/wrapper with lifecycle-script policy |
| Policy downgrade by editing files outside managed path | PARTIAL_VISIBILITY | Some policy files are normal workspace files unless protected by central signature | `GovernancePolicy` blocks downgrades only for managed policy-change paths | Signed enterprise policy hierarchy and downgrade prevention |

## P0 blockers

1. Arbitrary terminals and child processes are not enforced.
2. Arbitrary local network egress is not enforced.
3. Other extensions/processes can still read plaintext workspace files.
4. MCP runtime traffic is not fully gatewayed.
5. External validation and large adversarial corpora are not yet complete in this repository state.
