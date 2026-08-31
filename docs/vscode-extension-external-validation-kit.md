# SoterAI IDE Guard external validation kit

This document is a handoff for an independent security assessor or enterprise
pilot. It does not claim that either engagement has happened.

## Artifact under review

- Extension: `soterai.soterai-ide-guard`
- Current source version: `0.6.1`
- Package entry point: `packages/vscode-extension/dist/extension.js`
- Local broker: `packages/vscode-extension/dist/local-ai-broker.js`
- MCP server: `packages/vscode-extension/dist/soterai-mcp-server.js`
- SBOM: `artifacts/security/vscode-extension.cdx.json`
- VSIX manifest and file hashes: `artifacts/security/vsix-integrity.json`

The assessor must record the exact commit and VSIX SHA-256. A report against a
different tree or package is not evidence for the published extension.

## Claims to verify

1. Local scans make no network request in default local mode.
2. Raw secrets never enter telemetry, logs, webview state, or agent-tool output.
3. Broker enforcement applies only to requests actually routed through the
   authenticated loopback broker.
4. Third-party extension calls, raw terminal commands, and unrelated MCP clients
   are not universally intercepted.
5. Controlled terminal commands use fixed argv execution and reject unsupported
   commands before execution.
6. Config rewrites require preview and approval, create encrypted backups outside
   the workspace, and support restore.
7. Untrusted workspaces cannot enable restricted cloud or secret-storage paths.
8. Webview messages are allowlisted and cannot provide commands, URLs, or paths.

## Reproducible local checks

From the repository root:

```text
npm --prefix packages/vscode-extension run typecheck
npm --prefix packages/vscode-extension run test
npm --prefix packages/vscode-extension run test:host
npm --prefix packages/vscode-extension run benchmark:security
npm --prefix packages/vscode-extension run bundle
npm --prefix packages/vscode-extension run package
npm --prefix packages/vscode-extension run verify:vsix
```

The extension-local benchmark is self-maintained and intentionally limited. Its
JSON report identifies its corpus hash, every outcome, every misclassification,
and explicitly says it is not independent or a competitor comparison.

## Adversarial assessment scope

- Webview message-schema bypass and command/URL injection
- Workspace traversal, symlink, and junction escapes
- Secret leakage through errors, output channels, telemetry, reports, and MCP
- Broker authentication, replay, malformed streaming, and late-block behavior
- MCP oversized frames, malformed JSON-RPC, and protocol corruption
- Configuration rewrite race, backup tampering, and restore failure
- Managed-setting bypass and untrusted-workspace escalation
- Detector evasions using encoding, homoglyphs, zero-width characters, splitting,
  quoting, JSON/YAML syntax, multilingual text, and long inputs
- False positives on normal source, documentation, configuration, and shell usage

## Enterprise pilot protocol

Run for at least four weeks with consenting developers and non-production test
workspaces. Record only privacy-safe aggregates:

- eligible users, installs, weekly active users, and retention;
- scans by surface and p50/p95 latency;
- findings reviewed, accepted, dismissed, and confirmed false positives;
- broker-routed requests versus detected unmanaged routes;
- config changes approved, cancelled, restored, or failed;
- crashes, extension-host errors, support requests, and mean resolution time.

Before pilot launch, define success thresholds with the customer. Suggested
minimums are: no raw-secret telemetry incident, no unauthorized config write,
zero critical crashes, p95 local scan below 100 ms for 100 KB text, and every
reported bypass assigned an owner and disposition. These are proposed acceptance
criteria, not achieved results.

## Evidence the assessor must deliver

- signed report identifying assessor and independence;
- scope, exclusions, dates, commit, VSIX hash, and environment;
- tools and methodology;
- reproducible findings with severity and affected claim;
- retest status for fixes;
- explicit statement distinguishing detection from prevention;
- permission to publish the report or a redacted executive summary.

Until those deliverables exist, wording must remain **self-tested**, not
**independently audited**, **certified**, or **world strongest**.