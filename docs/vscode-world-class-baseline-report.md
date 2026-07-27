# VS Code World-Class Security Control Plane — Baseline Report

Date: 2026-07-16
Branch: `vscode-world-class-security-control-plane` (from `phase-1-release-hygiene-fix-pr-lite`)
Package: `packages/vscode-extension` — `soterai-ide-guard@0.2.0`

## Baseline commands and results (all run, real output)

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm install` (packages/vscode-extension) | PASS — up to date, 0 vulnerabilities reported |
| Typecheck | `npm run typecheck` (tsc --noEmit) | PASS — 0 errors |
| Lint | `npm run lint` (aliases typecheck; no eslint config in package) | PASS (typecheck only — noted as gap) |
| Tests | `npm test` (node --test via tsx) | PASS — 63/63 tests, 22 suites, 0 fail, ~1.7s |
| Build | `npm run build` (esbuild production) | PASS — dist/extension.js 245.7kb, dist/local-ai-broker.js 100.9kb |
| VSIX | `npx vsce package --allow-missing-repository --skip-license --no-dependencies` | PASS — soterai-ide-guard-0.2.0.vsix, 16 files, 231.73 KB |
| VSIX leak check | `unzip -l *.vsix \| grep -iE "\.env\|secret\|token\|coverage\|private\|\.map"` | CLEAN — no test files, source maps, env files, or secrets in package |
| Root audit | `npm audit --omit=dev` (repo root) | PASS — 0 vulnerabilities |
| Root typecheck | `npm run typecheck` (repo root) | running in background at time of writing; result recorded in execution log |

## VSIX contents (16 files)

manifest, package.json, readme, changelog, LICENSE.md/.txt, icon.svg/.png,
dist/extension.js, dist/local-ai-broker.js, 5 walkthrough markdown files.
No `.env`, no tests, no coverage, no source maps, no raw source.

## Existing architecture (inspected, 50 TS files in src/)

- `secret-broker/` — SecretClassifier, SecretReferenceManager, SensitiveContextRedactor,
  CapabilityBroker, LLMContext, OutputFilter, SecretStorageValueStore, SensitiveContextPolicy, runtime
- `firewall/` — ContextGatherer, PolicyStore, LedgerStore, VaultManager, CanaryManager,
  scanners, context/ledger/policy/vault/canary/output command modules
- `mcp-firewall/MCPFirewall.ts`, `memory-guard/`, `workspace-guard/`, `dep-guard/`,
  `sentinel/AISentinel`, `permissions/`, `policy-packs/`, `enterprise/EnterpriseDashboard`,
  `broker/BrokerManager` (loopback local AI broker), `diagnostics/LiveScanner`,
  `clipboard/ClipboardGuard`, `views/RiskTreeProvider`, `webview/DashboardPanel`
- Tests: `src/__tests__/extension.test.ts`, `src/__tests__/secret-broker.test.ts` (63 assertions)

## Manifest hygiene (already present)

- ~130 commands; advanced ones gated behind `soterai.advancedCommands` context key
  (settings `soterai.showAllCommands` / `soterai.experimentalFeatures.enabled`, default off)
- Workspace Trust: `untrustedWorkspaces.supported: "limited"` with description
- Privacy defaults: `soterai.privacyMode: "local"`, `soterai.telemetry.redactedEvents: "off"`,
  `soterai.audit.storeRawPrompts: false`, `soterai.sensitiveContext.allowRawReveal: false`
- Walkthrough (`soterai.gettingStarted`), activity-bar views, first-run onboarding

## Hard gate status

Typecheck/build/tests all pass — gate satisfied; feature work may proceed.

## Known baseline gaps (to address in later phases)

1. `npm run lint` is only a typecheck alias — no real ESLint pass for the extension package.
2. Only 2 test files cover 50 source modules; per-module coverage for MCP firewall, terminal
   review, docs injection, context firewall boundaries needs expansion (Phase 13).
3. Runtime (real VS Code) evidence not yet produced this cycle — Phase 14.
4. Deep per-phase gap analysis (specs vs implementation) recorded in the feature inventory doc.
