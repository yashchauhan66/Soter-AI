# Release Readiness Report

Date: 2026-07-22

## Current decision

Do not claim universal or complete zero-trust protection. The repository now has stronger phase coverage, but release claims must remain scoped to supported enforcement paths.

`100/100` claims are additionally gated by `npm run validate:security-100:strict`.

## Passing evidence in this pass

- Guard-core typecheck passed.
- Guard-core tests passed with 162 tests after the all-phases core additions.
- Extension tests passed with 78 tests after adding the raw-terminal coverage warning and extension-isolation summary.
- Broker tests passed with 25 tests after process-launch and extension-isolation preflight endpoint additions.
- Guard-core tests passed with 165 tests after process sandbox and extension isolation policy additions.
- `npm audit --audit-level=high` passed with 0 vulnerabilities after dependency override hardening.
- `npm run validate:security-99` generated an advisory score of 95/100 and correctly denied `99+` claim eligibility.
- `npm run validate:security-100` generated an advisory score of 94/100 and correctly denied `100/100` claim eligibility.
- `npm test` passed with 829 tests after adding the strongest-local release gate regression coverage.
- `node scripts/test-vscode-family.mjs code` passed isolated VS Code VSIX install and extension-list verification.
- `npm run validate:strongest-local` passed 15/15 required local steps, including typecheck, focused package tests/builds, VS Code install verification, audit, full suite, and evidence-gate generation.
- Earlier full-suite evidence in `docs/security/test-evidence.md` shows extension, broker, monorepo typecheck, monorepo tests, permission validation, and critical audit gate passing.

## Release blockers for broad enterprise claim

- Raw terminals remain outside full enforcement unless users route execution through the controlled broker path.
- Arbitrary process network egress remains outside full enforcement unless a caller uses the process sandbox profile with an OS-enforced boundary.
- Other extensions and OS processes can read plaintext files unless enterprise extension allowlisting or OS/container isolation is enabled.
- MCP runtime calls are only enforced when routed through `MCPGateway`.
- External penetration testing is not complete.
- 100/100 evidence artifacts for OS enforcement, enterprise extension control, signed provenance, and recovery drill are not yet present.

## Approved claim shape

SoterAI deterministically prevents defined unsafe behaviors within supported brokered and SoterAI-routed paths, reports coverage levels for partial or unsupported routes, and records redacted evidence for reproducibility.
