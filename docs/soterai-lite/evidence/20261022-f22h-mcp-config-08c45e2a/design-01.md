# F22h: bounded project MCP configuration review

Existing ordered card F22h only; this is its work-card contract, not a replacement implementation plan. Parent F22 remains incomplete until this subcard passes. Parent revision: 0ef608959e35ec72d2d490322cbfeef8884c6069. F22g source/transition byte proofs remain authoritative; no completed feature is restarted.

## Scope and authority

- Strict default-true machine/restricted `soterai.lite.configScanner.mcp`, alongside existing trusted single local Windows workspace, hygiene/vault/lease/epoch/discovery/custody guards. Repository data cannot enable an owner-disabled machine setting.
- Five native owner commands: reviewWorkspaceMcpSecrets, reviewMcpSecrets, reviewMcpSecretVault, restoreMcpSecretVault, mcpSecretScannerStatus. Public command arguments never approve/select content. No startup file read or key creation.
- Reuse HygieneController, keyed exposure metadata and canonical VaultManager. Candidate names are fixed MCP_SECRET/MCP_PRIVATE_KEY; source names/paths/values never enter result/notification/export metadata. Full encrypted checkpoint disclosure only, saved denies retained; generic per-entry restore refuses. No value-bearing example file.

## Finite file/format admission

Project-contained saved copies only, case-insensitive: `.mcp.json`, `mcp.json`, `mcp_config.json`, `cline_mcp_settings.json`, `claude_desktop_config.json`; project `.gemini/settings.json`, `.claude/settings.json` and `.claude/settings.local.json`; `mcp.toml`, `.mcp.toml`, and project `.codex/config.toml`. Nested project copies are admitted. No user/global profiles or arbitrary config.toml/settings.json discovery. Actual vendor routing is not inferred from a filename.

JSONC uses the installed pinned jsonc-parser3.3.1 ESM build route already verified in F22g. Extract the existing bounded JSONC planner into a shared fixed-mode core while preserving Editor behavior. MCP mode admits server labels under exact root servers/mcpServers maps, exact root inputs[*].password booleans, and identifies password/credential input defaults. Literal env/header credentials, whole credential URLs/commands, adjacent and inline arguments, multiline strings and canonical comment spans are reviewed. Whole finite `${NAME}` and existing `${env:NAME}`/`${input:id}`/`${command:id}` references remain unresolved data; mixed/default/unknown expressions withhold.

TOML is a finite parse-only implementation for project MCP/Codex copies; no TOML package is installed and none is downloaded. Support bare/quoted dotted keys, ordinary tables, basic/literal strings including bounded multiline material, arrays, inline tables, booleans and finite numbers. Reject malformed/duplicate decoded keys, collisions, table redefinition, unsupported array-of-table/date constructs, interpolation combinations and unsupported syntax before a plan can escape. Exact env_vars, env_http_headers and bearer_token_env_var identifier references remain names, never resolved. Credential strings/arguments/URLs/comments use the same private candidate policy; residual decoded copies and names with recognized values withhold. This is not full TOML/vendor schema validation.

## Bounds, rollback and verification

64KiB UTF8 text, at most32768 lexical work items/16384 nodes/64 nesting/128 candidates; 128 selected discovery files and existing1MiB total analysis budget. Validate depth/work before recursive parsing, validate final masked grammar, preserve exact original spans/CRLF and idempotence. Unsupported input returns generic withheld status with no partial findings, writes, key or record changes.

No settings application, env/input/command resolution, client/server/task/shell/debug execution, URL request, dependency load, include resolution or automatic edit. Migration may interrupt clients until the owner configures a supported secret-loading workflow. Raw originals/processes/prior copies/other buffers/arbitrary transforms and unknown prose remain limited.

Tests first: pure JSONC/TOML/private-span and public controls; family/controller/ledger/flags/commands; generation/Unicode/duplicates/bounds/residuals; cancellation/drift/withdrawal/checkpoint recovery. Retain the missing-implementation baseline. Then compiler/focused/full/backend/fresh unique VSIX/content/actual current MCP native plus all affected prior workflows, owned natural exit/EOF/no signals and exact loaded hashes. Synthetic fixtures are nested copies, never active root vendor configs. Same-lineage scripted evidence is LOW; no catalog score, human or independent claim. Scoped source/transition commits and exhaustive byte proofs precede F23. At original L6 write HUMAN-ACTIONS and STOP.
