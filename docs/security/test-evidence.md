# Security Test Evidence

Date: 2026-07-22

## Baseline before source changes

Current branch at start: `ci-fix/main-benign-fpr...origin/main`.

Dirty files present before changes:

- `extensions/jetbrains/.gradle/8.9/fileHashes/fileHashes.lock`
- `packages/vscode-extension/soterai-ide-guard-0.2.0.vsix`

Commands run before implementation:

| Command | Result |
|---|---|
| `npm --prefix packages/guard-core run typecheck` | PASS |
| `npm --prefix packages/guard-core run test` | PASS, 137 tests |
| `npm --prefix packages/vscode-extension run typecheck` | PASS |
| `npm --prefix packages/vscode-extension run test` | PASS, 76 tests |
| `npm --prefix packages/guard-core run build` | PASS |
| `npm --prefix packages/vscode-extension run build` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 823 passed |
| `npm audit --audit-level=critical` | PASS for critical gate; audit reported 5 high severity vulnerabilities |
| `npm run validate:extension-permissions` | PASS |

High severity audit findings observed:

- `adm-zip <0.6.0` via `onnxruntime-node`.
- `fast-uri 3.0.0 - 3.1.3`.
- `sharp <0.35.0` via `next`.

## New implementation evidence

New tests added in `packages/guard-core/src/__tests__/runtime-policy.test.ts` cover:

- Raw credential exposure denies before execution.
- Enterprise locked mode fails closed when policy health is false.
- Strict mode denies unknown network egress.
- Secret egress and cloud metadata destinations deny.
- Suspicious terminal parse failures ask or deny.
- Observe mode remains observe-only and nonblocking.
- Unsupported high-risk paths deny instead of displaying protected.
- Low-risk local actions retain rollback metadata.

Post-change focused checks run:

| Command | Result |
|---|---|
| `npm --prefix packages/guard-core run typecheck` | Initially failed on export/type issues, then PASS after fixes |
| `npm --prefix packages/guard-core run build` | PASS |
| `npm --prefix packages/guard-core run test` | PASS, 145 tests |
| `npm --prefix packages/vscode-extension run typecheck` | Initially failed before rebuilding guard-core dist, then PASS |
| `npm --prefix packages/vscode-extension run test` | PASS, 76 tests |
| `npm --prefix packages/vscode-extension run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run validate:extension-permissions` | PASS |
| `npm test` | PASS, 823 tests |
| `npm audit --audit-level=critical` | PASS for critical gate; audit still reports 5 high severity vulnerabilities |

## Regression result

No test regression was observed in the executed gates. Remaining risk is coverage risk, not a failing-test risk: arbitrary terminals, child processes, local network egress, other extensions, and non-gatewayed MCP runtime calls remain outside full enforcement.

## Continuation evidence: controlled terminal broker route

New tests added in `packages/guard-core/src/__tests__/controlled-terminal.test.ts` cover:

- Read-only allowlisted commands such as `git status --short`.
- Shell metacharacter denial before fixed-argv execution.
- Destructive and non-allowlisted commands denied.
- `python -c` denied instead of becoming an arbitrary code executor.
- Strict-mode production-context denial.
- Quoted Windows executable paths normalized safely.

New local broker tests in `apps/local-ai-broker/src/__tests__/broker.test.ts` cover:

- `/v1/terminal/preview` analyzes without executing.
- `/v1/terminal/execute` rejects denied commands before calling the injected executor.
- Allowed commands execute through fixed argv.
- stdout/stderr are redacted before returning to the extension.

Post-continuation checks run:

| Command | Result |
|---|---|
| `npm --prefix packages/guard-core run build` | PASS |
| `npm --prefix packages/guard-core run test` | PASS, 151 tests |
| `npm --prefix apps/local-ai-broker run typecheck` | PASS |
| `npm --prefix apps/local-ai-broker run test` | PASS, 23 tests |
| `npm --prefix packages/vscode-extension run typecheck` | PASS |
| `npm --prefix packages/vscode-extension run test` | PASS, 76 tests |
| `npm --prefix packages/vscode-extension run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run validate:extension-permissions` | PASS |
| `npm test` | PASS, 823 tests |
| `npm audit --audit-level=critical` | PASS for critical gate; audit still reports 5 high severity vulnerabilities |

The new route improves coverage only when the user or agent uses SoterAI's broker-controlled command. Raw VS Code terminals, external terminals, arbitrary spawned children, shell aliases/functions, and OS-level network egress remain outside full enforcement.

## All-phases core enforcement pass

New tests added in `packages/guard-core/src/__tests__/phase-controls.test.ts` cover:

- Phase 2 capability discovery and unsupported-path warnings.
- Phase 4 file operation policy for symlink/realpath escape, outside-workspace reads, raw secret content, and security-sensitive workflow edits.
- Phase 7 network egress policy for metadata endpoints, secret payloads, and redirect-to-private-network blocking.
- Phase 8 MCP gateway policy for prompt-injected server metadata, disallowed permissions, and secret-bearing arguments.
- Phase 9 taint escalation for high-risk actions influenced by prompt-injected sources.
- Phase 10 transaction preview and checkpoint metadata without raw secret previews.
- Phase 11 enterprise governance blocking signed-policy downgrade, mandatory-control removal, and non-admin enterprise edits.

Focused checks for this pass:

| Command | Result |
|---|---|
| `npm --prefix packages/guard-core run typecheck` | Initially failed on integration type mismatches, then PASS after fixes |
| `npm --prefix packages/guard-core run test` | Initially failed 2 assertions, then PASS, 162 tests |
| `npm --prefix packages/guard-core run build` | PASS |
| `npm --prefix apps/local-ai-broker run typecheck` | PASS |
| `npm --prefix apps/local-ai-broker run test` | PASS, 18 tests |
| `npm --prefix packages/vscode-extension run typecheck` | PASS |
| `npm --prefix packages/vscode-extension run test` | PASS, 76 tests |
| `npm --prefix packages/vscode-extension run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run validate:extension-permissions` | PASS |
| `npm test` | PASS, 823 tests |
| `npm audit --audit-level=critical` | PASS for critical gate; audit still reports 5 high severity vulnerabilities |

Machine-readable evidence:

- `artifacts/security/all-phases-core-evidence.json`
- `artifacts/security/sbom.spdx-lite.json`

Additional broker preflight tests now cover:

- `POST /v1/preflight/runtime-capabilities`
- `POST /v1/preflight/file-operation`
- `POST /v1/preflight/network-egress`
- `POST /v1/preflight/mcp-tool`
- `POST /v1/preflight/policy-change`
- `POST /v1/preflight/process-launch`
- `POST /v1/preflight/extension-isolation`

## Hardening continuation: dependency and raw-terminal UX

Additional changes:

- Added dependency overrides and refreshed the installed tree to resolve the previously observed high-severity `adm-zip`, `sharp`, and `fast-uri` audit findings.
- Added a one-time raw VS Code terminal warning that routes users to `soterai.runControlledTerminalCommand` or the runtime capability summary.
- Added a runtime coverage status bar item that shows brokered versus partial runtime coverage.

Focused checks for this continuation:

| Command | Result |
|---|---|
| `npm audit --audit-level=high` | PASS, 0 vulnerabilities |
| `npm --prefix packages/vscode-extension run typecheck` | PASS |
| `npm --prefix packages/vscode-extension run test` | PASS, 77 tests |
| `npm --prefix apps/local-ai-broker run test` | PASS, 23 tests |
| `npm --prefix packages/vscode-extension run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run validate:extension-permissions` | PASS |
| `npm --prefix packages/guard-core run test` | PASS, 162 tests |
| `npm test` | PASS, 823 tests |

The raw-terminal warning improves user-visible coverage and directs users into broker-controlled execution, but it still does not intercept arbitrary typed terminal input after the terminal opens.

## Final gap-hardening continuation

Additional controls added:

- `ProcessSandboxPolicy` denies shell/env-secret/unrestricted launches and returns constrained sandbox profiles for OS-enforced process execution.
- `ExtensionIsolationPolicy` scores third-party IDE extensions and recommends isolate/block actions for non-allowlisted risky AI/agent extensions.
- Broker endpoints `/v1/preflight/process-launch` and `/v1/preflight/extension-isolation` expose those decisions over the authenticated local boundary.
- VS Code command `SoterAI: Show Extension Isolation Summary` surfaces extension isolation findings.

Focused checks for this continuation:

| Command | Result |
|---|---|
| `npm --prefix packages/guard-core run typecheck` | PASS |
| `npm --prefix packages/guard-core run test` | PASS, 165 tests |
| `npm --prefix packages/guard-core run build` | PASS |
| `npm --prefix apps/local-ai-broker run typecheck` | PASS |
| `npm --prefix apps/local-ai-broker run test` | PASS, 25 tests |
| `npm --prefix packages/vscode-extension run typecheck` | PASS |
| `npm --prefix packages/vscode-extension run test` | PASS, 78 tests |
| `npm --prefix packages/vscode-extension run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run validate:extension-permissions` | PASS |
| `npm audit --audit-level=high` | PASS, 0 vulnerabilities |
| `npm test` | PASS, 823 tests |

## 100/100 evidence gate

The repository now includes a separate evidence gate for any `100/100` claim:

- `lib/enterprise/security100EvidenceGate.ts`
- `scripts/validate-security-100-evidence.ts`
- `tests/security-100-evidence-gate.test.ts`
- `docs/security/security-100-evidence-gate.md`

This gate intentionally requires external/deployment evidence and must not be bypassed by self-attestation.

Focused checks for this continuation:

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm exec -- tsx --test tests/security-100-evidence-gate.test.ts` | PASS, 3 tests |
| `npm run validate:security-99` | PASS as advisory report; current evidence-gated score is 95/100 and `99+` claim is not allowed |
| `npm run validate:security-100` | PASS as advisory report; current evidence-gated score is 94/100 and `100/100` claim is not allowed |
| `npm test` | PASS, 829 tests after adding strongest-local release gate regression coverage |
| `npm audit --audit-level=high` | PASS, 0 vulnerabilities |
| `npm run validate:extension-permissions` | PASS |
| `node scripts/test-vscode-family.mjs code` | PASS, isolated VS Code VSIX install and extension-list verification |
| `npm run validate:strongest-local` | PASS, 15/15 required local steps |

Generated evidence:

- `reports/security-100-evidence-gates.json`
- `reports/security-100-evidence-gates.md`
- `reports/security-99-evidence-gates.json`
- `reports/security-99-evidence-gates.md`
- `reports/strongest-local-release-gate.json`
- `reports/strongest-local-release-gate.md`

Current release blockers for a literal `100/100` claim:

- Missing `reports/security-99-evidence-gates.json`.
- Missing OS enforcement attestation.
- Missing enterprise extension-control attestation.
- Missing signed reproducible release provenance.
- Missing recovery drill report.
