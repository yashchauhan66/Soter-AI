# SoterAI IDE Guard — Full Enforcement Report

> Engineering evidence ledger. This report never upgrades monitoring or detection into enforcement. Update it after each completed component and resume future sessions here.

## 1. Baseline state — 2026-07-27

- Branch: `main`
- Baseline commit: `894522ed8a490d7654aa40d6657222a8c5d72721`
- The worktree was not clean. Preserved unrelated changes: `TODO.md`, JetBrains Gradle state, the checked-in `packages/vscode-extension/soterai-ide-guard-0.2.1.vsix`, `SOTERAI-EXTENSION-TESTING-AND-MARKET-ANALYSIS.md`, `SOTERAI-TEST-SECRETS.env`, and `docs/seo/SOTERAI_TOP3_SEO_REPORT.md`.
- Extension: `packages/vscode-extension`, version `0.2.1`, VS Code engine `^1.85.0`.
- Broker: `apps/local-ai-broker`.
- Shared packages: `packages/guard-core`, `packages/ide-common`, `packages/ide-protocol`.

### Verified initial hypothesis

The Control Panel had five toggles. Source comments correctly disclosed that Safe Mode only enforces broker-routed traffic, Protected Workspace only filters SoterAI-built context, Live Scan is visibility-only, Sentinel observes, and MCP scanning cannot intercept other clients. However, `ControlPanelViewProvider.overallLevel()` returned `ENFORCED` if any active toggle was enforced. The first selected gap is therefore truthful unified status, not a cosmetic redesign.

## 2. Architecture and traced paths

```text
extension.ts
  ├─ ExtensionState / PolicyStore / listeners
  ├─ BrokerManager ─ authenticated 127.0.0.1 HTTP ─> bundled BrokerServer
  │   ├─ DecisionEngine request/response/SSE scanning
  │   ├─ approvals, memory, redacted events
  │   └─ controlled terminal and MCP preflight
  ├─ WorkspaceGuard ─> ContextGatherer ─> SafeContextBuilder/context commands
  ├─ LiveScanner ─> VS Code diagnostics (visibility-only)
  ├─ AISentinel ─> local redacted file/config/extension events
  ├─ MCPFirewall ─> config inventory, deny-list, optional preflight
  └─ ControlPanelViewProvider + status bar
```

| Control | Runtime effect | Truthful scope |
|---|---|---|
| AI Safe Mode | Broker `/v1/safe-mode/*`, request/response/SSE scans | Enforced only on traffic using configured broker routes |
| Protected Workspace | Checker excludes listed files from SoterAI-built bundles | Other extension/tool reads are not intercepted |
| Live Scan on Save | Diagnostics after file content exists | Visibility-only |
| AI Sentinel | Sensitive-file/config/extension watchers and redacted local events | Activity observation, not network interception |
| MCP Firewall strict | Config inventory/classification, deny-list, optional broker preflight | No universal MCP gateway |
| Controlled Terminal | Broker fixed-argv analysis and supported execution | Raw terminals and subprocess trees bypass |
| Emergency Lockdown | Revokes secret broker capabilities/references | Existing scope is not all broker/MCP/terminal workflows |

## 3. Unified protection state machine

Implemented in `packages/vscode-extension/src/protection/ProtectionState.ts`; tests in `src/__tests__/protection-state.test.ts`.

States: `DISABLED`, `INITIALISING`, `MONITORING_ONLY`, `PARTIALLY_ENFORCED`, `FULLY_ENFORCED`, `DEGRADED`, `BROKER_OFFLINE`, `POLICY_UNAVAILABLE`, `BYPASS_DETECTED`, `LOCKDOWN`, `ERROR`.

The pure derivation requires a healthy broker, trusted workspace, loaded policy, required control flags, and verified routing of every detected AI integration before it emits `FULLY_ENFORCED`. Every descriptor has title, explanation, active/inactive controls, coverage, recommended action, severity, and allowed transitions.

## 4. Enforcement coverage matrix — current source evidence

| Surface | Detected | Warned | Redacted | Approval Required | Blocked | Audited | Bypass Detectable | Runtime Verified |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Supported AI request | yes | yes | yes | yes | yes | yes | partial | broker tests; packaged runtime pending |
| AI response | yes | yes | partial | no | yes | yes | partial | broker tests; packaged runtime pending |
| Workspace file context | yes | yes | yes | yes | yes | yes | yes | SoterAI-built path |
| Clipboard | yes | yes | yes | optional | yes | partial | yes | guarded command path |
| Terminal command | yes | yes | no | yes | yes | yes | yes | controlled route |
| Terminal output | yes | yes | redacted | no | no | yes | yes | controlled route |
| MCP configuration | yes | yes | no | no | no | yes | yes | scanner tests |
| MCP tool call | partial | yes | partial | partial | partial | yes | yes | caller-respected preflight only |
| File write | partial | yes | no | no | no | partial | yes | engine exists; arbitrary writes not intercepted |
| Git change | yes | yes | no | no | no | partial | yes | diff scan path |
| Dependency addition | yes | yes | no | no | no | partial | yes | advisory only |
| AI-generated code | yes | yes | no | no | no | partial | partial | post-generation scan |

## 5. Bypass and editor matrix

| Surface | Classification | Limitation |
|---|---|---|
| Explicit OpenAI/Anthropic-compatible loopback routing | Strong for routed traffic | Direct routes bypass |
| Copilot/Cursor/Windsurf/Continue/other AI extension | Unverified or bypass | VS Code extension API cannot universally intercept another extension's network traffic |
| Raw VS Code terminal | Monitoring-only | Arbitrary shell input is outside extension enforcement |
| External MCP client | Monitoring-only / detectable drift | No shipped universal MCP host gateway |
| VS Code | Targeted; packaged runtime pending | Real profile smoke test still required |
| Cursor, Windsurf, VSCodium | Unverified | No real-editor verification yet |

## 6. Security, UX, and reliability findings

1. **Selected status defect:** independent UI aggregation could say `Enforced` when only one control enforced. The central state machine removes this condition.
2. Broker binds loopback, authenticates with SecretStorage token, bounds body size, timeouts, rate-limits, and safe-logs; automatic heartbeat/restart/version-state handling is incomplete.
3. Protected Workspace is connected end-to-end for SoterAI-built context, but not for arbitrary extension reads.
4. Sentinel is privacy-minimized for its observed events but cannot observe arbitrary AI network traffic.
5. MCP strict mode is config scanning plus optional caller-respected preflight, not universal interception.
6. Emergency Lockdown revokes secret-broker capabilities/references, not every protected workflow.
7. Multiple primary workflow buttons still have similar visual weight; the eventual Full Protection action must be the single primary action.

## 7. Files changed in this checkpoint

- `packages/vscode-extension/src/protection/ProtectionState.ts`
- `packages/vscode-extension/src/__tests__/protection-state.test.ts`
- `docs/SOTERAI-IDE-GUARD-FULL-ENFORCEMENT-REPORT.md`

## 8. Tests and commands

- New focused tests: `packages/vscode-extension/src/__tests__/protection-state.test.ts`.
- Available extension commands: `npm run typecheck`, `npm test`, `npm run bundle`, `npm run package` from `packages/vscode-extension`.
- Broker package tests and packaged VSIX runtime tests remain pending at this checkpoint.

## 9. Runtime/performance evidence

No new performance or packaged real-editor runtime measurement has been completed. Existing implementation bounds broker request bodies, timeouts, event retention, and context item size; those are safeguards, not performance proof.

## 10. Completed-component ledger

| Component | Evidence level | Status |
|---|---|---|
| Repository baseline and architecture discovery | Source inspected | complete for initial pass |
| Unified protection state machine | Unit-tested pending command execution | implemented |
| Broker lifecycle | Implemented, not fully verified in this task | next P0 |
| One-click Full Protection | Not present as one idempotent workflow | open |
| Protected Workspace filter | Source-wired for SoterAI context | partial, bypass documented |
| Sentinel | Implemented local watcher | partial |
| MCP strict governance | Scanner + optional preflight | partial |
| Controlled Terminal | Broker-controlled route | partial |
| Emergency Lockdown | Secret-broker scoped | partial |

## 11. Honest verdict at this checkpoint

The extension is **not fully protected** and must not be described as universal, bypass-proof, enterprise-ready, or production-proven. Explicitly brokered requests, SoterAI-built safe context, guarded clipboard, controlled terminal, and secret capability routes have meaningful enforcement paths. Direct AI extension traffic, raw terminals, arbitrary MCP clients, process/network egress, and enterprise management remain unenforced or unproven. Next gate: wire the state source into the Control Panel and status bar, then execute tests.