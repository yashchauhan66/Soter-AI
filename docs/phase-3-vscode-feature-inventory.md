# Phase 3 VS Code Feature Inventory

## Manifest Summary

| Area | Result |
| --- | --- |
| Version | `0.2.0` |
| Main | `./dist/extension.js` |
| Activation events | Core launch commands, policy file presence, walkthrough, startup finished |
| Commands declared | 123 |
| Command Palette entries | 109 |
| Configuration fields | 19 |
| Views | 3 under `soterai-explorer` |
| Keybindings | 0 |
| Workspace Trust | Limited support; local scanning allowed, cloud/token/remote gated |
| Extension kind | Not explicitly set |

## Public Command Surface

| Command ID | Title | Visible | Status | Expected user value | Test exists | Runtime tested | Marketplace claim allowed | Issue found |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `soterai.quickStart` | SoterAI: Quick Start | Yes | Stable | Onboarding, privacy mode, first action | Yes | Install/CLI only | Yes | No |
| `soterai.scanSelectedText` | SoterAI: Scan Selected Text | Yes | Stable | Scan selected prompt/text locally | Yes | Install/CLI only | Yes | No |
| `soterai.scanCurrentFile` | SoterAI: Scan Current File | Yes | Stable | Scan active file for secrets/PII/injection | Yes | Install/CLI only | Yes | Fixed save gate |
| `soterai.scanGitDiff` | SoterAI: Scan Git Diff | Yes | Stable | Scan staged/unstaged diff | Yes | Install/CLI only | Yes | No |
| `soterai.scanMCPAgentTools` | SoterAI: Scan MCP / Agent Tools | Yes | Stable | Review MCP/agent config risk | Yes | Install/CLI only | Yes | No |
| `soterai.reviewTerminalCommand` | SoterAI: Review Terminal Command | Yes | Stable | Review command without executing it | Yes | Install/CLI only | Yes | No |
| `soterai.openAIActivityLedger` | SoterAI: Open AI Activity Ledger | Yes | Stable | View privacy-preserving scan/share metadata | Yes | Install/CLI only | Yes | No |
| `soterai.choosePolicyPack` | SoterAI: Choose Policy Pack | Yes | Stable | Apply built-in policy profile | Yes | Install/CLI only | Yes | No |
| `soterai.checkExtensionHealth` | SoterAI: Check Extension Health | Yes | Stable | Show version/trust/privacy/config health | Yes | Install/CLI only | Yes | No |
| `soterai.openSettings` | SoterAI: Open Settings | Yes | Stable | Open SoterAI settings | Yes | Install/CLI only | Yes | No |
| `soterai.runDemoScan` | SoterAI: Run Demo Scan | Yes | Stable | Demonstrate local detection without real secret | Yes | Install/CLI only | Yes | No |

All non-core commands are gated by `soterai.advancedCommands` or hidden with `when: false`. Advanced visibility is now controlled by either `soterai.showAllCommands` or `soterai.experimentalFeatures.enabled`.

## Feature Coverage

| Feature | Code/test status | Runtime status | Marketplace claim |
| --- | --- | --- | --- |
| Quick Start | Implemented and tested | CLI install only; visual flow needs human confirmation | Allowed as guided onboarding |
| Selected text scan | Implemented and tested | CLI install only | Allowed |
| Current file scan | Implemented and tested; live-save gate fixed | CLI install only | Allowed |
| Git diff scan | Implemented using fixed-argv `git diff` | CLI install only | Allowed |
| MCP / agent scanner | Implemented and tested | CLI install only | Allowed |
| Terminal command review | Implemented and tested; never executes commands | CLI install only | Allowed |
| AI Activity Ledger | Implemented and privacy tested | CLI install only | Allowed |
| Policy packs | Implemented and tested | CLI install only | Allowed |
| Privacy mode | Local default and telemetry/cloud gates tested | CLI install only | Allowed |
| Extension health | Implemented and tested for no secret leakage | CLI install only | Allowed |

