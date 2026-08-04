# Strongest Local Release Gate

Generated: 2026-08-03T15:11:35.481Z

- Local gate passed: **no**
- Required local steps passed: **11/12**
- Security 99 score: **95/100**
- 99+ claim allowed: **no**
- Security 100 score: **94/100**
- 100/100 claim allowed: **no**

| Step | Status | Command | Duration ms |
| --- | --- | --- | --- |
| root-typecheck | PASS | `npm run typecheck` | 23225 |
| guard-core-typecheck | PASS | `npm --prefix packages/guard-core run typecheck` | 6070 |
| guard-core-test | PASS | `npm --prefix packages/guard-core run test` | 11458 |
| guard-core-build | PASS | `npm --prefix packages/guard-core run build` | 7322 |
| broker-typecheck | PASS | `npm --prefix apps/local-ai-broker run typecheck` | 7471 |
| broker-test | PASS | `npm --prefix apps/local-ai-broker run test` | 4779 |
| vscode-extension-typecheck | PASS | `npm --prefix packages/vscode-extension run typecheck` | 8780 |
| vscode-extension-test | PASS | `npm --prefix packages/vscode-extension run test` | 3621 |
| vscode-extension-build | PASS | `npm --prefix packages/vscode-extension run build` | 4715 |
| vscode-isolated-install | PASS | `node scripts/test-vscode-family.mjs code` | 27848 |
| manifest-permissions | PASS | `npm run validate:extension-permissions` | 1797 |
| dependency-audit-high | FAIL | `npm audit --audit-level=high` | 6013 |

This local gate proves build, test, packaging, audit, and isolated VS Code install health. It does not replace external pentest, live deployment, signed provenance, OS enforcement, enterprise extension-control, or recovery-drill attestations.
