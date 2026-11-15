# Approved app dependency snapshots

The revised vault app runtime binds owner setup and each run to the complete supported source snapshot. Version 2 descriptors retain an entry digest and a digest of every included module, its path, its bytes and its import mapping. Earlier version 1 approvals remain in storage but cannot launch; configure those apps again to review the current dependency closure.

Setup reads the entry and its transitive imports with canonical path, single-link file, size and identity checks. It rechecks the captured files before returning the snapshot. The runtime checks the full digest before vault approval, after approval and before sending selected values. Source, policy or dependency changes revoke the existing live guard.

The actual child receives an immutable source snapshot privately over IPC alongside its selected variables. Its CommonJS loader uses that captured module table with no disk or package-resolution fallback. Changing an entry or imported file after capture cannot substitute code in the running snapshot. No app source or selected value is written into an artifact file, argv, descriptor or status response.

## Supported application contract

- Entry: CommonJS `.cjs` or `.js`. `.js` is interpreted as CommonJS regardless of a surrounding `package.json`.
- Dependencies: direct literal `require('./helper.cjs')`, `require('../data.json')`, and equivalent paths with explicit `.cjs`, `.js` or `.json` extensions. Every path must remain inside the selected workspace. Circular CommonJS imports are supported.
- Bounds: 64 modules, 1 MiB per module, 4 MiB of source in total, 128 import specifiers per module and 1,024 UTF-8 bytes per relative module path. Syntax analysis also has a node-count bound.
- Builtins: explicit `node:` imports for `assert`, `assert/strict`, `buffer`, `crypto`, `events`, `path`, `path/posix`, `path/win32`, `querystring`, `string_decoder`, `url`, `util` and `util/types`.
- Lifecycle: optional `exports.start(signal)` and `exports.stop()`, managed stdout/stderr, selected environment variables and literal public arguments.

ES modules and bare package imports must first be bundled into a supported CommonJS artifact and reviewed. The result must itself satisfy the contract; bundling does not automatically make dynamic loaders or filesystem/network operations supported. Dynamic `import()`, computed/aliased `require`, module resolver mutation, native addons, filesystem/network/process/worker modules and alternate code loaders are refused. No project loader, package script or build command runs during setup.

The [example](../../examples/vault-app-artifact/app.cjs) includes one CommonJS helper and a JSON dependency. Run setup through **SoterAI: Configure Vault App**, select an already migrated environment source and choose only required variables. Reconfigure after a dependency change.

## Scope and validation

This change establishes immutable execution of the supported dependency snapshot. It is not an OS sandbox or a complete JavaScript security membrane. Owner-approved JavaScript still runs in a host Node process with access to its selected values; the static checks and builtin allowlist do not prove confinement against deliberately hostile code, global network APIs or reflection. Read-only filesystem enforcement, network egress restrictions and isolation of other extensions/processes require the separately configured constrained runner. This vault-app change does not silently claim those controls.

Headless tests exercise actual Node children executing captured code after entry/dependency replacement, circular imports, JSON dependencies, complete-digest invalidation, unsupported loader refusal, hardlink refusal, bounded module counts, native-command setup races and legacy approval retention. The previous GUI native F09/F25 fixture apps use filesystem-written test receipts and do not meet this new contract; their historical receipts do not validate the new loader. A new GUI native run remains outstanding.
