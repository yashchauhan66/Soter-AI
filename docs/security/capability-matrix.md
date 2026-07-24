# SoterAI IDE Guard Capability Matrix

Date: 2026-07-23

This matrix records what the repository currently supports in the VS Code extension, shared guard core, local broker, and documented server-side APIs. A coverage label is not a security promise beyond the exact path named here.

Levels use the eight-value vocabulary from `CAPABILITY_REGISTRY` (Section 3 of the remediation mandate). Do not invent labels such as `PARTIAL_VISIBILITY`.

| Capability | Coverage level | Enforcement point | Evidence | Important limitation |
|---|---|---|---|---|
| SoterAI Local Broker credential capability calls | STRONG_ENFORCEMENT | `packages/vscode-extension/src/secret-broker/*`, `src/__tests__/enforced-capability.test.ts` | Extension tests pass; broker injects credentials locally and scopes host, method, path, expiry, use count, workspace, revocation | Applies only to brokered calls; raw CLI/browser/other extension credentials remain outside this boundary |
| SoterAI-built safe AI context | STRONG_ENFORCEMENT | `packages/guard-core/src/SafeContextBuilder.ts`, `packages/vscode-extension/src/firewall/context-commands.ts` | Guard-core tests pass; protected files are excluded, sensitive files summarized/approval-gated, normal-file secrets redacted | Cannot control what a user or another extension sends after copying text |
| Secret redaction and no-raw-evidence cache/ledger behavior | STRONG_ENFORCEMENT | `DecisionEngine`, `Redactor`, `EvidenceMinimizer`, `HashCache`, `Ledger` | Guard-core redaction, cache, ledger tests pass | Detector completeness is not universal; unsupported binary/image paths are partial or not tested |
| VS Code live file diagnostics | VISIBILITY_ONLY | `packages/vscode-extension/src/diagnostics/LiveScanner.ts` + `DecisionEngine` pipeline **1.1.0** | Behavioral: `live-scan-parity.test.ts` proves `context=file` runs Secret, PII, PromptInjection, Jailbreak detectors and reports pipeline metadata | Runs after content exists; does not prevent other extensions/processes from reading files; regex-only (no packaged ONNX); does not block send-to-AI |
| Clipboard scan/safe paste through SoterAI commands | STRONG_ENFORCEMENT | `packages/vscode-extension/src/clipboard/ClipboardGuard.ts` and command handlers | Extension tests pass for redacted safe paste and no raw clipboard logging | Ordinary OS copy/paste is not intercepted |
| Manual terminal command review | DETECTION_ONLY | `packages/vscode-extension/src/commands.ts`, `RuntimePolicyEngine` | New runtime-policy tests pass; terminal review now reports `DENY`/`ASK` with reason codes and `DETECTION_ONLY` coverage | Does not intercept arbitrary integrated-terminal execution, subprocesses, aliases, shells, or child processes |
| Broker-controlled terminal execution | STRONG_ENFORCEMENT for allowlisted fixed-argv commands | `packages/guard-core/src/ControlledTerminal.ts`, `apps/local-ai-broker/src/BrokerServer.ts`, `packages/vscode-extension/src/broker/commands.ts` | Controlled-terminal core tests and local broker endpoint tests pass; denied commands are rejected before the executor is called | Only covers the new SoterAI broker route and a small read-only allowlist; raw terminals, shells, aliases, subprocess trees, and OS network egress remain outside the boundary |
| MCP config/tool risk scanning | DETECTION_ONLY | `packages/guard-core/src/MCPPolicyAnalyzer.ts`, `packages/vscode-extension/src/mcp-firewall/MCPFirewall.ts` | Guard-core MCP tests pass | Scans config and recommendations; optional preflight via `soterai.preflightMCPTool` (see mcp-gateway) |

| Extension risk scanning | DETECTION_ONLY | `packages/guard-core/src/ExtensionRiskScanner.ts` | Guard-core extension-risk tests pass | Cannot prevent a malicious extension that already has VS Code/OS access from reading files or using network |
| Project policy parsing for protected/sensitive files | STRONG_ENFORCEMENT for SoterAI-built context, VISIBILITY_ONLY otherwise | `ProjectPolicy.ts`, `PolicyStore.ts` | Guard-core project-policy tests pass | Does not enforce against OS-level readers, raw terminals, or other extensions |
| Runtime policy decision vocabulary | STRONG_ENFORCEMENT for callers that use it | `packages/guard-core/src/RuntimePolicyEngine.ts` | New runtime-policy tests pass | New shared engine is wired into manual terminal review; other paths should be migrated incrementally |
| Runtime capability discovery | VISIBILITY_ONLY | `packages/guard-core/src/RuntimeDiscovery.ts` | Phase-controls tests pass for effective-risk summary and unsupported warnings | Discovery depends on facts supplied by the host; it does not itself enforce actions |
| File/change firewall policy | UNKNOWN_NOT_TESTED (engine only — **not wired**) | `packages/guard-core/src/FileOperationFirewall.ts` | Phase-controls tests pass for symlink escape, outside-workspace, secret-bearing file operation, and security-sensitive workflow edits | **No non-test caller in the packaged extension** (verified 2026-07-22). Enforcement is proven only in guard-core unit tests; does not intercept OS file I/O until a runtime path routes through it |
| Network egress policy | UNKNOWN_NOT_TESTED (engine only — **not wired**) | `packages/guard-core/src/NetworkEgressPolicy.ts` | Phase-controls tests pass for cloud metadata, secret payload, and redirect-to-private-network denial | **No non-test caller in the packaged extension.** Does not enforce arbitrary process or raw terminal egress |
| MCP gateway policy (broker preflight) | DETECTION_ONLY (wired preflight; not universal intercept) | `packages/guard-core/src/MCPGateway.ts`, broker `POST /v1/preflight/mcp-tool`, extension `soterai.preflightMCPTool` | Phase-controls + broker preflight tests; extension command routes through broker when running | Other MCP clients that never call preflight are unenforced; do not claim FULL/STRONG without mandatory host integration |
| Broker integration setup (one-click rewrite) | Usability only; STRONG only after traffic is brokered | `packages/vscode-extension/src/broker/IntegrationAdapter.ts`, `soterai.setupBrokerIntegration` / `restoreBrokerIntegration` | `integration-adapter.test.ts` (never silent write; apply+restore) | Never writes without modal approval + backup; raw terminals remain outside enforcement |

| Taint and source influence engine | UNKNOWN_NOT_TESTED (engine only — **not wired**) | `packages/guard-core/src/TaintEngine.ts` | Phase-controls tests pass for injected README influence on high-risk actions | **No non-test caller in the packaged extension.** Depends on upstream provenance a runtime does not yet supply |
| Transaction preview/checkpoint metadata | UNKNOWN_NOT_TESTED (engine only — **not wired**) | `packages/guard-core/src/CheckpointRollback.ts` | Phase-controls tests pass for dependency plus sensitive-change denial and redacted checkpoint previews | **No non-test caller in the packaged extension.** Does not roll back external systems or arbitrary file changes until wired into execution flows |
| Enterprise policy-change validation | UNKNOWN_NOT_TESTED (engine only — **not wired**) | `packages/guard-core/src/GovernancePolicy.ts` | Phase-controls tests pass for signed enterprise policy downgrade blocking | **No non-test caller in the packaged extension.** Cannot stop policy edits made outside managed/signed paths |
| Process sandbox policy | UNKNOWN_NOT_TESTED (engine only — **not wired**) | `packages/guard-core/src/ProcessSandboxPolicy.ts` | Phase-controls tests pass | **No non-test caller in the packaged extension.** Cannot sandbox arbitrary child processes |
| Local broker preflight gateway | STRONG_ENFORCEMENT for authenticated preflight decisions | `apps/local-ai-broker/src/BrokerServer.ts` `/v1/preflight/*` | Broker tests pass for runtime capability, file operation, network egress, MCP tool, and policy-change preflights | Preflight endpoints do not execute actions; callers must respect the returned decision or route execution through SoterAI |
| Local AI Broker SSE streaming proxy | STRONG_ENFORCEMENT for routed `stream:true` traffic | `BrokerServer.proxyStreaming` + `extractStreamDelta` | Phase 6 broker tests: safe SSE forward; canary/tool-call secret scan-before-forward; blocked request never starts stream | Partial already-flushed safe tokens cannot be recalled; non-broker traffic unenforced |
| Dependency Guard (heuristics + optional OSV) | DETECTION_ONLY | `packages/vscode-extension/src/dep-guard/DepGuard.ts` | Heuristic unit tests + mocked OSV client tests; setting `soterai.dependencyGuard.osvMode` | Cannot block OS installs; OSV needs concrete versions; not full SCA |

| Network egress firewall for arbitrary local processes | UNSUPPORTED | None | No local network proxy or OS firewall component found in this phase | Current code can validate server/webhook URLs in tested API paths, but cannot stop terminal/process network egress |
| Child-process control for arbitrary AI agents | UNSUPPORTED | None | No process tree sandbox/broker enforcement found in this phase | Requires controlled terminal, sandbox launcher, or OS-level broker |

## UI badge mapping

Extension UI uses a six-level display vocabulary (`ENFORCED` / `VERIFIED` / `REDACTED` / `MONITORED` / `UNKNOWN` / `EXPOSED`). Mapping is implemented in `packages/vscode-extension/src/protection/ProtectionLevel.ts` via `toUiLevel()`:

| Registry level | UI badge |
|---|---|
| FULL_ENFORCEMENT, STRONG_ENFORCEMENT | ENFORCED |
| PARTIAL_ENFORCEMENT | REDACTED |
| ADVISORY_ONLY, DETECTION_ONLY, VISIBILITY_ONLY | MONITORED |
| UNSUPPORTED, UNKNOWN_NOT_TESTED | UNKNOWN |

Control Panel live-scan and MCP toggles resolve badges through `capabilityUiBadge()` so they cannot claim ENFORCED when the registry says VISIBILITY_ONLY / DETECTION_ONLY.

## Effective permission summary for this workspace

The current repository is a large monorepo with a VS Code extension, browser extension, server APIs, local broker, integration packages, and generated artifacts. The current VS Code extension can scan content, build safer context, broker specific credentials, and show coverage, but it cannot become a universal boundary for other VS Code extensions, raw terminals, child processes, or OS network egress without a companion broker/sandbox/proxy path.
