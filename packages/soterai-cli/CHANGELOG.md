# Changelog

All notable changes to `@soterai/cli` are documented here.

## [0.1.0] — 2026-08-01

First public release.

### Added
- Full command layer: `scan file|text`, `redact file`, `broker start|status`,
  `safe-mode on|off|status`, `memory export`, `mcp scan`, `git scan`,
  `version`, `help`.
- Global flags: `--url`, `--token`, `--json`.
- Stable exit codes: 0 success, 1 blocked/unreachable, 2 usage error,
  3 approval-required.
- Dependency-injected command layer (`CliDeps`) for deterministic testing.
- Library entrypoint (`dist/index.js`) exporting `run`, `defaultDeps`,
  `parseArgs`, and the `CliDeps` type.
- `soterai` bin shim (`dist/cli.js`) with a proper shebang.
- Depends on `@soterai/ide-common@^0.1.0` (broker client, token resolution)
  and `soter-pii@^1.1.0` (offline PII redaction primitive).
