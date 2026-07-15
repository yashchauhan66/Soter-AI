# Phase 3 VS Code and Cursor Runtime Complete

## 1. Summary

Phase 3 produced a clean VSIX, verified the current extension with real commands, fixed runtime/marketplace issues, installed the VSIX into isolated VS Code and Cursor profiles, and inspected package contents. Full visual UI evidence remains required because the CLI cannot click commands, inspect webviews, or validate theme rendering.

## 2. Baseline Results

Initial extension typecheck/lint/tests passed. Build failed in the sandbox due esbuild workspace path access and passed after approved non-sandbox execution.

## 3. Feature Inventory

See `docs/phase-3-vscode-feature-inventory.md`.

## 4. Bugs Found

1. Save-triggered file scanning did not respect `soterai.liveScan.enabled`.
2. Requested marketplace gate `soterai.experimentalFeatures.enabled` was missing; only legacy `soterai.showAllCommands` existed.

## 5. Bugs Fixed

1. Save hook now checks `soterai.liveScan.enabled`.
2. Added `soterai.experimentalFeatures.enabled` and wired it to `soterai.advancedCommands` with legacy setting compatibility.
3. Added regression tests for both behaviors.

## 6. Commands Cleaned

Core commands remain visible by default. Advanced/labs/internal commands are gated behind `soterai.advancedCommands` or hidden. The context key is now driven by `soterai.showAllCommands` or `soterai.experimentalFeatures.enabled`.

## 7. Features Verified

Automated tests verify command parity, Workspace Trust gates, SecretStorage token hygiene, webview CSP/message allowlist, local privacy mode, telemetry privacy, ledger privacy, live scanning, clipboard guard, policy packs, local broker, safe mode, memory inspector, MCP firewall, and launch commands.

## 8. Security Hardening

See `docs/phase-3-vscode-security-hardening-report.md`.

## 9. Automated Test Results

See `docs/phase-3-vscode-test-results.md`.

## 10. Real VS Code Runtime Results

VS Code 1.128.0 CLI was available. Isolated VSIX install and extension-list verification passed for `soterai.soterai-ide-guard@0.2.0`. Visual UI runtime remains evidence required.

## 11. Cursor/OpenVSX Compatibility

Cursor 3.10.17 CLI was available. Isolated VSIX install and extension-list verification passed. VSCodium CLI was not installed. OpenVSX package readiness is YES; live publishing/account action is external.

## 12. VSIX Package Inspection

See `docs/phase-3-vsix-package-inspection.md`. The VSIX is 227,520 bytes and contains 16 clean files.

## 13. Marketplace Assets

See `docs/phase-3-vscode-marketplace-assets-final.md`.

## 14. Remaining Evidence Required

- Manual VS Code command/webview/status bar/notification testing.
- Manual Cursor command/webview/status bar/notification testing.
- Developer Tools and Output panel secret-leak inspection after UI command execution.
- Theme screenshots: dark, light, high contrast.
- Activation time and memory/CPU measurement from a real UI host.
- OpenVSX account publish and optional VSCodium runtime check.

## 15. Publish Decision

| Target | Decision | Remaining blocker |
| --- | --- | --- |
| VS Code Marketplace | YES, package-ready | Human visual runtime screenshots/evidence recommended before upload |
| OpenVSX | YES, package-ready | OpenVSX account/publish action and optional VSCodium check |
| Cursor-compatible | YES for VSIX install compatibility | Human visual runtime command/webview evidence |

## 16. Ready for Phase 4?

YES for engineering/package handoff. Keep the manual UI evidence items as Phase 4 release checklist gates.

