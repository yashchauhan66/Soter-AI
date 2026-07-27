# VS Code Secret Broker Runtime Test Report

Date: 2026-07-16

## Test Workspace

Created `tmp/soterai-secret-broker-runtime-test` with fake `.env`, `.env.example`, `config.ts`, `database.ts`, `README.md`, `mcp.json`, and `terminal-commands.txt`.

## Automated Results

- Extension typecheck: passed.
- Extension lint: passed.
- Extension unit tests: passed, 60 tests.
- Production bundle: passed outside sandbox after esbuild read restrictions.
- VSIX package: passed outside sandbox; generated `packages/vscode-extension/soterai-ide-guard-0.2.0.vsix`.
- Secret broker tests verified no raw fake secrets in refs, serialized metadata, redacted LLM context, broker responses, or output-filtered text.

## Interactive VS Code Checklist Status

- Install VSIX: packaged and ready; interactive install not executed in this headless run.
- Run Scan Selected Text: existing command remains registered.
- Run Use Sensitive Context Safely: command registered and covered by static command parity.
- Preview What AI Saw: command registered; webview escapes all interpolated values and uses existing CSP helper.
- Broker DB test: demo broker command registered; local mode returns sanitized no-network diagnostic.
- Ask LLM to reveal secret: output filter blocks requests for API keys/tokens/secrets/passwords/private keys/database URLs.
- Reveal once: gated by policy, disabled by default, typed `REVEAL` required when enabled.
- Enterprise policy disables reveal: policy parser test confirms enterprise lock forces reveal denial.
- Ledger: broker command writes existing sanitized ledger event types only.
- Clear broker session: command registered; revokes workspace-scoped refs.
- Local privacy mode no network: broker DB operation returns `network execution disabled in local privacy mode`.
- Output panel/dev console: no `console.log` added; existing extension tests assert no `console.log` in extension source.

## Remaining Runtime Gap

A fully interactive VS Code host click-through was not executed in this environment. The package is built and the test workspace is present for manual host validation.
