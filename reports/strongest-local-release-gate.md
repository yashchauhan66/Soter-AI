# Strongest Local Release Gate

Generated: 2026-07-22T11:58:46.305Z

- Local gate passed: **yes**
- Required local steps passed: **15/15**
- Security 99 score: **95/100**
- 99+ claim allowed: **no**
- Security 100 score: **94/100**
- 100/100 claim allowed: **no**

| Step | Status | Command | Duration ms |
| --- | --- | --- | --- |
| root-typecheck | PASS | `npm run typecheck` | 21960 |
| guard-core-typecheck | PASS | `npm --prefix packages/guard-core run typecheck` | 6999 |
| guard-core-test | PASS | `npm --prefix packages/guard-core run test` | 7814 |
| guard-core-build | PASS | `npm --prefix packages/guard-core run build` | 6997 |
| broker-typecheck | PASS | `npm --prefix apps/local-ai-broker run typecheck` | 6147 |
| broker-test | PASS | `npm --prefix apps/local-ai-broker run test` | 3353 |
| vscode-extension-typecheck | PASS | `npm --prefix packages/vscode-extension run typecheck` | 7560 |
| vscode-extension-test | PASS | `npm --prefix packages/vscode-extension run test` | 2635 |
| vscode-extension-build | PASS | `npm --prefix packages/vscode-extension run build` | 3759 |
| vscode-isolated-install | PASS | `node scripts/test-vscode-family.mjs code` | 14335 |
| manifest-permissions | PASS | `npm run validate:extension-permissions` | 1519 |
| dependency-audit-high | PASS | `npm audit --audit-level=high` | 5171 |
| full-test-suite | PASS | `npm test` | 51958 |
| security-99-evidence-advisory | PASS | `npm run validate:security-99` | 2503 |
| security-100-evidence-advisory | PASS | `npm run validate:security-100` | 2080 |

This local gate proves build, test, packaging, audit, and isolated VS Code install health. It does not replace external pentest, live deployment, signed provenance, OS enforcement, enterprise extension-control, or recovery-drill attestations.
