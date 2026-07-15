# Phase 8 Automated Security Scan Results

## Commands

- `npm audit --omit=dev`: PASS, 0 vulnerabilities after remediation.
- `npm audit`: initially failed with high `linkify-it` via `@vscode/vsce` and moderate nested `esbuild`; PASS, 0 vulnerabilities after remediation.
- `npm run validate:extension-permissions`: PASS.
- `npm run test:readiness`: PASS after evidence-language fix.
- Dangerous-pattern search: reviewed `eval`, `new Function`, shell execution, token/secret strings, `innerHTML`, `dangerouslySetInnerHTML`, localhost, and env references across app/lib/packages/apps/docs, excluding generated output.

## Fixes

- Upgraded VS Code extension packaging dependencies to `@vscode/vsce@^3.9.2` and `esbuild@^0.28.1`.
- Removed stale nested lock/node_modules esbuild 0.24.2 entries and reinstalled until `npm ls esbuild @vscode/vsce` showed only fixed versions.

## Pattern Review

- Browser extension `innerHTML` use in popup/side panel is static template rendering with dynamic values escaped through `escapeHtml`.
- Local broker logs startup and request status metadata only in reviewed paths; no provider key/token logging was found in inspected broker paths.
- Generated Lighthouse/docs contain expected `innerHTML`/script text and were excluded from source-risk conclusions.

## Remaining

- Static API self-pentest produced review candidates where auth/validation is delegated through route-specific helpers not detected by the first-pass script. See `reports/phase-8-api-self-pentest-results.json`.
