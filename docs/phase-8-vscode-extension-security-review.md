# Phase 8 VS Code Extension Security Review

Reviewed packages/vscode-extension/**, local broker files, SecretStorage references, webview notes, command tests, and dependency tooling. Fixed vulnerable dev packaging dependencies: @vscode/vsce to ^3.9.2 and esbuild to ^0.28.1. npm ls esbuild @vscode/vsce shows fixed versions. tests/security-hardening.test.ts passed with approved audit access.

Readiness report now explicitly marks EVIDENCE REQUIRED for manual VS Code webview/notification command paths. External pentest scope includes SecretStorage, workspace scanning, symlink escape, webview CSP/XSS, command injection, terminal command review, privacy mode, Workspace Trust, local broker auth, and MCP scanner.
