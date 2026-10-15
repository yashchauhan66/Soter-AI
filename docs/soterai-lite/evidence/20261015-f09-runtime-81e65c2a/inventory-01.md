# F09 inventory 01 - read-only reuse and boundary review

Date: 2026-10-15. Independence: LOW. This note records local source and installed type declarations, not an executed feature PASS. F09 alone is active after the byte-verified F08 source/transition reported by the parent. The frozen implementation-plan row is the scope authority; proposed interfaces below are recommendations for the next design freeze.

No tests, application launches, debug/task sessions, GUI operations, production edits, credential-store calls, process environment dumps or real secret/source files were executed/read for this inventory. Searches were limited to repository source/manifests, synthetic test source where relevant, and installed VS Code declarations. The only write is this exclusive new evidence note.

## Actual reusable code

- packages/vscode-extension/src/security/childEnvironment.ts:5 brokerChildEnvironment(source) creates a fresh object and copies only SystemRoot, WINDIR, TEMP, TMP, TMPDIR, LANG, LC_ALL and TZ, matching Windows-style names case-insensitively. It intentionally excludes PATH, HOME, USERPROFILE, proxy/preload controls and ordinary credentials. This is an existing minimal base environment; no mutation of the parent is required.
- BrokerManager.ts:164-185 actually spreads that helper into a private broker environment and spawns an absolute process.execPath with an argument array, windowsHide:true and piped stdout/stderr. Its explicit broker authentication/provider variables are specific to that child and must not be copied into an app launcher. The broker's existing diagnostic collection is not F08 filtering.
- SafeGit.ts:25-59 demonstrates independent child environment construction, absolute executable discovery, bounded execFile, shell-free arguments and scoped cleanup. Its temporary HOME/config files and Git-only controls are not an application environment to reuse wholesale.
- VaultManager.ts:67 capture validates a local workspace file, canonical path, current root, policy revision, bounded file identity/text, epoch and pristine existing document. fresh at85 rechecks the basis. key at91 validates a canonical 32-byte SecretStorage key and rereads it; vault at100 decrypts the strict bounded vault schema. noPending at125 rejects an interrupted transaction. These are private helpers available for a small in-class runtime lease, not public raw-value APIs.
- StoredEntry includes rawValue and, for new entries, source/root/replacementText. migrate records exact source/root with each entry. restore at249 selects exact source/root and a placeholder still present in the current bound file before its disclosure workflow. Legacy records may lack bindings. status at178 exposes key/type/originalFile/placeholder/createdAt, omitting values, IDs and value hashes; knownPlaceholders at184 is not a source-bound value resolver. There is currently no child-runtime value retrieval interface.
- VaultStorage.ts validates storage outside workspace roots and aliases, strict schemas, size/UTF-8/file identity, exclusive encrypted records and mutation locks. Reuse its custody/read guarantees; do not restore plaintext into the project as a way to obtain child variables.
- VaultMigrationPlan.ts:17-31 uses the real SecureEditorModel for env fields, including quoted values and distinct fields with duplicate names. General-file candidates are also supported. A vault candidate name is therefore not automatically a valid unique child environment binding. Runtime must select explicit bound entries and validate destination env names independently.
- firewall/commands.ts:15 constructs one VaultManager and shares it with the command registrations. vault-commands.ts supplies trust checks, native modal owner actions and constant failure messages. A runtime registration can share this manager rather than construct an unbound second data path.
- StreamingOutputRedactor.ts is the actual F08 synchronous byte collector with separate fatal UTF-8/control states, private request data, terminal cancel/dispose state, guarded completion and 128 KiB raw/output limits. Its matching and replacement validation use the shared F07 matcher. Instantiate it before starting the owned child, push original stdout/stderr Buffer views, and release only its completed result.
- secret-broker/runtime.ts:59-74 keeps singleton matching/output guards false until bound; commands.ts:37-44 binds trust plus inspected machine/default settings dynamically. OutputFilter.filterChunks at17 already uses the real F08 pipeline with both guards. For a live child, avoid unboundedly accumulating all raw chunks merely to invoke filterChunks at the end: either expose a guarded processor factory on the same owner or use a single F08 instance with the identical runtime guard callback. Freeze this wiring before tests.
- project-privacy/ReadTerminal.ts is a fixed saved-file reader Pseudoterminal, explicitly without process/shell execution. Its EventEmitter/open/close/finished-text frontend shape is reusable, but it is not an existing run/task/debug implementation.

## Missing integration and unsuitable alternatives

The repository source search found no actual registerTaskProvider, executeTask, CustomExecution, ProcessExecution, startDebugging, registerDebugConfigurationProvider or debug-adapter registration in the extension. Other Task/Debug occurrences are UI descriptions or safe prompt generation. The manifest currently has no vaultRuntime setting or dedicated runtime task/debug contribution. Its declared VS Code floor is ^1.85.0.

packages/soterai-cli/src/vault.ts:125 buildChildEnv clones the entire parent, deletes one passphrase variable, then overlays decrypted values. run.ts:1166 uses shell:true on Windows with stdio:inherit. That is a different CLI custody/workflow contract, and neither function establishes F09's scrubbed, shell-free, F08-filtered launch.

Installed node_modules/@types/vscode/index.d.ts states:
- ProcessExecutionOptions.env at8879-8884 is additional environment merged with the parent.
- CustomExecution at9090-9100 runs an extension callback returning a Pseudoterminal; execution waits for open, cancellation belongs in close, and completion uses onDidClose. Resolved task definitions may have variable substitutions.
- DebugAdapterExecutableOptions.env at16885-16890 also merges with the parent.
- DebugAdapterInlineImplementation at16957 can carry an owned in-process DebugAdapter; the adapter's onDidSendMessage is the actual DAP output path.
- DebugAdapterTracker callbacks at16997-17021 return void and observe protocol traffic; they do not supply an awaited rewrite/deny result.

Consequently, supplying a small env object to ProcessExecution or DebugAdapterExecutable does not prove inherited credentials were scrubbed. Generic launch.json/tasks.json env or raw startDebugging configuration would serialize/distribute decrypted values beyond the selected child. A tracker alone cannot establish F08 filtering. These are source/type facts, not native-host observations.

## Small proposed interface for the design freeze

1. Add an in-class VaultManager metadata selector plus a narrow private-value lease. Metadata may identify a bound entry by opaque entry ID, public name and placeholder. A method shaped withRuntimeValues(sourceUri, selectedEntryIds, operation) should retain the capture/fresh/key/vault/noPending checks, reject legacy or cross-root/source entries and stale/missing placeholders, and invoke only the trusted owned runtime callback. Do not add a general command returning a raw dictionary. Recheck after review and immediately before spawn; define cancellation/key/vault/policy/epoch drift behavior before fixtures.

2. Freeze a strict versioned allowlisted application descriptor containing only public launch data: root/source identity, pinned absolute executable, approved script/argv/cwd and explicit entry-ID-to-env-name bindings. The initial supported runtime can be a pinned Node executable plus a canonical in-project script. Arguments remain an array and shell:false; no command interpolation, ambient PATH resolution, inherited runtime preload options, workspace env files, task env or debug env payloads. Reject duplicate Windows-case-insensitive destinations and loader/search/control names such as PATH, NODE_OPTIONS and related runtime injection variables; do not let an app binding override the clean base or internal launch controls. Show the exact app/root/arguments and names to the owner without values.

3. Use one owned launch coordinator for Run, CustomExecution Task and the dedicated debug adapter. After exact approval, build a fresh base with brokerChildEnvironment, add only selected values privately, and spawn with piped stdout/stderr, stdin ignored and windowsHide:true. Never mutate process.env. F08 sees every original output byte before a sink. Wait for child close/pipe completion, not only exit, before final flush; on error, signal death, cancellation, flag withdrawal, bounds or parser failure withhold all output and stop only the owned child. Freeze process duration/stop grace and concurrent ownership limits before testing. Task definitions and debug configurations carry only a descriptor ID, and task close/debug terminate delegate to the same owned stop path.

A minimal lifecycle debug adapter is not automatically a source debugger. Freeze the supported DAP operations honestly. Forwarding an external Node inspector/DAP evaluate/variables/output route can expose app memory or bypass this completed-output sink, so those paths cannot be silently advertised as filtered. The acceptance row allows mock task/debug launch checks; they must be labelled mock evidence separately from actual native task/debug observations.

All injected app code can itself print, write or transmit its credential, and arbitrary same-user/native children remain outside the owned coordinator. The reviewed app is the recipient, not a confinement boundary. No task/debug/terminal or vault-runtime PASS is claimed by this inventory.

## Source snapshots

Paths are relative to the workspace except the installed local declaration file. SHA-256 snapshots were captured after the reads; they identify this inventory basis, not a release artifact.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| docs/soterai-lite/IMPLEMENTATION-PLAN.md | 39112 | 2ba3a2e93019861c6c509457d0fcf3f55e509d39bdecd9f8a9323f1eabab2c67 |
| packages/vscode-extension/src/security/childEnvironment.ts | 577 | 39dfde2af1d33413958e64f4c7018101107afe5b44840b27768cb5f0298ecb67 |
| packages/vscode-extension/src/firewall/VaultManager.ts | 26778 | 01bceb03557c4759237eed8b8817073a63ce62d7d8687894e493066d84317125 |
| packages/vscode-extension/src/firewall/VaultStorage.ts | 9955 | ca7a8e581ae03c32cc8564fbe7182409c0aaab7ee44c92f26da3a1b3b0f872d1 |
| packages/vscode-extension/src/firewall/VaultMigrationPlan.ts | 3501 | dbe3b45646d3751c927680ca31001897faa3885aca23c9ef84695f114ed94505 |
| packages/vscode-extension/src/firewall/commands.ts | 1532 | 7e0d7c3cf2e78c2a5dcb22e2ad8fad678a5a1e1cbd85ac70fd20af77238f13bb |
| packages/vscode-extension/src/firewall/vault-commands.ts | 4940 | 1349234d89c7c79d80071674289a9d082cdc7b220eb521e254bec4b9755e85c4 |
| packages/vscode-extension/src/security/WorkspacePathGuard.ts | 2511 | 84793782ca8a8840040a25f964fc4e3e6fc4697549a24bf3d9bf4180e5bd86f8 |
| packages/vscode-extension/src/security/FileSystemPathPolicy.ts | 4229 | e41fddccdb360a02c0253f3198d113d8545d07071f86795e545f65d94efc2748 |
| packages/vscode-extension/src/security/SafeGit.ts | 3938 | 7605156c5b48522d9da8819f0d0c6950e533cc34779c0072aff8538546d9e219 |
| packages/vscode-extension/src/broker/BrokerManager.ts | 21106 | 9c51c2ee05be39da0e3ae3ece99c5eae2fda10d5024cae3e03809b0894f274a6 |
| packages/vscode-extension/src/secret-broker/runtime.ts | 3781 | b7bf74a43c117e4c30ecc8de8e2f68e56ac7816a2d63eca09876187ceda1a74d |
| packages/vscode-extension/src/secret-broker/commands.ts | 40617 | e695e31ece7d5d3eee65776f88950b8b2dc11651cb1833a4bd02586bcec2d34f |
| packages/vscode-extension/src/secret-broker/OutputFilter.ts | 5423 | f3dd1f90a0878614dd0c2a61fbf1653712c49dc9cf8055e59436c716de9404bf |
| packages/core/src/StreamingOutputRedactor.ts | 7985 | 428903846312dc93d3f30b0c3f976678d7a59b6f2458f1ecb5deffa9daf69dc8 |
| packages/vscode-extension/src/project-privacy/ReadTerminal.ts | 3476 | ece1e4ec5396190af8ed6a89003bb26ddd6cae928a9078f223bd6c02486df413 |
| packages/soterai-cli/src/run.ts | 55595 | 0b7e1c7deec2a25e514770843b70e26a791bb5a4bbb9e6635cad61abb192ed36 |
| packages/soterai-cli/src/vault.ts | 9928 | 88b99b8c0b1a1ede03bf4f730e72ae81dd37ba7d0cf37f6b1c86e8588b150dbf |
| packages/vscode-extension/package.json | 105713 | f0f3bb9a0c2b029cbee91aa270d2cb35c43320eec7467414709e7fd7007ed64f |
| node_modules/@types/vscode/index.d.ts | 742205 | b38554611e1421314f60a3854dda5f00ad70819a44bdde4ed94e2776d49277cc |

## Read bookkeeping

Some initial guessed filenames were absent; rg located the actual ReadTerminal/SecureEditorModel paths. One metadata listing failed at PowerShell parse time because a foreach statement was piped directly; the corrected array-capture listing above succeeded. These were read-only lookup/formatting errors, with no application/test execution or source mutation.