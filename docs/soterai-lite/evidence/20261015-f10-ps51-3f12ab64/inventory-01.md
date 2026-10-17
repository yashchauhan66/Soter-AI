# F10 inventory 01 - managed PowerShell 5.1 reuse and limits

Date: 2026-10-15. Independence: LOW. Read-only source/type/file-metadata inventory; NOT an executed F10 shell, parser, profile, test, host or acceptance PASS. The parent reports F09 source 7bfdc91279ab9f59811ba6918e388846c5ea2411 (193/193 byte checks) and transition 24da9ce9907cd6082b7ce3a3e79136cd4c551508 (6/6); this author did not rerun those verifiers. F10 alone is active.

Only this new evidence note is written. No production/test files, normal PowerShell $PROFILE, VS Code settings/profile, environment file, credential store or user secret was opened/modified. No child shell, script, app, host, compiler or test was launched. PowerShell commands used by the tool were limited to source searches/reads, metadata and SHA-256 calculations.

## Frozen row and current gap

IMPLEMENTATION-PLAN.md:78 requires an opt-in real PS5.1 profile, scrubbed environment, declared checked-command grammar, native F04 one-time safe reads and F08 output filtering under machine flag soterai.lite.ps51Terminal. The row explicitly limits refusal to the cooperative checked dispatcher. Profile/hooks do not create a veto over arbitrary native/interpreter/absolute-path reads or independent uploads; badge says managed checks.

At the captured manifest/source hashes, no ps51Terminal setting, terminal profile contribution, registerTerminalProfileProvider implementation or TerminalOptions.strictEnv use exists in the extension. F09 adds real finite app/task/debug lifecycle surfaces, but is not a PS shell implementation.

## Actual installed shell metadata - no launch

Existing file: C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
Bytes: 454656
SHA-256: 8e8b07b3e7de55252ecc09dd7082542b6592afba8410e640acb7cda965a4ba16
Current PE FileVersion: 10.0.26100.8935 (WinBuild.160101.0800)
Current PE ProductVersion: 10.0.26100.8935

Historical retained metadata in docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/checkpoint-files.json:115-118 identifies Microsoft.PowerShell.Core at that ApplicationBase, System.Management.Automation.dll and PSVersion 5.1.26100.8935. This is previous stored metadata, not a fresh $PSVersionTable execution. The PE version alone is not a runtime PSVersion proof. Root must perform the planned actual pinned-executable version/UTF-8/command acceptance after freezing F10; no new executable/software is needed for this inventory.

Installed @types/vscode package metadata is version 1.125.0. The extension manifest still declares ^1.85.0, so newly consumed host APIs need actual floor/availability treatment rather than assuming installed declarations prove every supported host.

## Primary native API facts

node_modules/@types/vscode/index.d.ts:
- TerminalOptions:12469 has shellPath, shellArgs, cwd and env. strictEnv at12496-12503 explicitly makes env complete: no inherited process environment or terminal.integrated.env.windows override. Its default false merges those inputs. A native profile must use true with a fresh minimal map if it intends scrubbed inheritance.
- TerminalProfileProvider:8225 returns a profile and receives CancellationToken. TerminalProfile:8237 accepts TerminalOptions OR ExtensionTerminalOptions, enabling an owned Pseudoterminal profile as well as a directly rendered shellPath terminal. registerTerminalProfileProvider is declared at11830; a contributed profile needs a matching manifest contribution.
- Pseudoterminal:12613 writes to the terminal with onDidWrite. Output events before open are ignored; CRLF conversion is transport formatting at this sink. An owned pty can withhold raw process output until F08 finalization.
- TerminalShellIntegration.executeCommand:7842 sends commands (and can interrupt an existing command). It is not an inspection/veto hook over all terminal entrypoints.
- TerminalShellExecution.read:7983-7998 returns raw data already written to the terminal, only from when reading begins. This is an observation stream, not a replacement stream or suppression primitive.
- onDidStartTerminalShellExecution/End are events, with no awaited permission or cancellation result. Command-line confidence/cwd reporting depend on shell integration. Availability of these newer events is feature-detected in existing code.

Consequently, a direct shellPath TerminalProfile plus reading native execution output cannot meet F08's no-prefix-release contract: the native terminal has already displayed it. Profile aliases/functions/hooks are supplementary controls in a cooperative shell; they do not become a native execution veto. This limitation must determine the architecture and UI claim.

## Actual reusable extension paths

1. project-privacy/ReadTerminal.ts is a custom pty with input buffering, no echo, input cap4096, busy/closed state, Ctrl-C revoke and help/clear. It supports only read <relative path>; it explicitly has no process/shell launch API. Its lifecycle and reviewed-output frontend are reusable. It is not the required real PS5.1 backend.

2. project-privacy/ProjectFileAccess.ts is the real F04 service. Surfaces are exactly safe-preview, managed-read-terminal and integration-command (runtime validated). It holds a fixed60-second deadline across preparation/capture/approval; frozen receipt binds exact safeText/outputDigest/recipient plus current source/policy/root/identity. Revoke/dispose/config/workspace changes cancel outstanding review; fresh capture after exact true approval is required. Input64KiB/preview16KiB limits remain. Runtime preparation handles additive enrollment under the same deadline.

3. project-privacy/commands.ts:80 capture mediates local canonical single-link regular saved files and current effective policy/protected regions. It refuses policy/history files, aliases, pending sensitive/manual writes and drift. Env schemas show names with every value masked; comments and protected-region ambiguities remain withheld. Native modal at68-70 shows the service's exact safe output.

4. Existing public command soterai.readProjectFileSafely at147 uses integration-command; callers cannot choose approval/raw/surface/expiry. managed-read-terminal is currently bound only by the internal closure at193-197. That surface calls terminalSafeText BEFORE receipt creation in ProjectFileAccess.view, so a new terminal adapter must not obtain an integration-command approval and silently alter its approved text afterward. Reuse a trusted in-process managed-read callback/factory; do not add a public command argument that claims an arbitrary trusted surface or recipient. Copy/search output destinations, if supported, need an exact reviewed transformation/recipient contract.

5. SafeFileView.ts supplies dotenv schema parsing, sensitive summaries and recognized-secret redaction; terminalSafeText strips terminal C0/C1 escape controls. This saved-file transport treatment is not the F08 stateful process-output parser and must not replace it.

6. security/childEnvironment.ts creates a fresh minimal map of SystemRoot/WINDIR/TEMP/TMP/TMPDIR/LANG/LC_ALL/TZ only, matching names case-insensitively; no PATH/HOME/USERPROFILE/proxy/preload/credentials. F09 VaultAppJob.minimalEnvironment:64-71 further validates OS/temp paths, control-free bounded values and locale alphabet. That helper is currently private; extract/shared reuse is smaller than inventing another inherited-environment overlay. Do not copy F09 selected app values into an AI/PS process or mutate global process.env.

7. core/StreamingOutputRedactor.ts is the real F08 private byte collector: separate fatal UTF-8 and control-parser state for stdout/stderr; no undecided prefix release; raw128KiB/output128KiB/chunks4096/SGR128/OSC4096 limits, protected final output, cancellation and dynamic guard. It masks recognized operation views atomically, rejects unsupported control rewriting and withholds on invalid/incomplete final UTF-8. Process close plus drained channels must precede finalization. It is a finite completed-output pipeline, not a live interactive terminal passthrough.

8. secret-broker/runtime.ts starts matching/output guards false and supplies the actual singleton OutputFilter. filterChunks uses the actual shared F08 implementation with both callbacks. For an owned live shell child, avoid buffering unbounded chunks outside F08 and then passing them to filterChunks; create one guarded processor before data is accepted. No fallback to a raw native terminal sink after timeout, cancellation, flag withdrawal, invalid text or overflow.

9. F09 VaultAppJob/VaultSurfaces provide useful owned-process lifetime/drain and pty publication patterns, including cooperative stop and STOP_UNCONFIRMED ownership. They are Node-IPC/application-specific classes, not drop-in PowerShell processes. Reuse common lifetime concepts and only the factored safe helpers. Do not send Node READY/START IPC to PowerShell or claim ACK means exit.

10. security/SafeGit.ts already pins absolute Git executables, scrubs environment, disables system/global config, hooks, fsmonitor, credential helper and signing, and bounds execution. Its safe status/branch metadata operations are stronger reuse for declared Git forms than invoking arbitrary git from an inherited PowerShell PATH. Content/history reads still need separate file mediation and are intentionally absent from the existing controlled allowlist.

## Existing watcher and broker do not supply the F10 boundary

terminal/ShellExecutionWatcher.ts feature-detects onDidStartTerminalShellExecution, records a minimized verdict and shows a notification. shellExecutionPolicy.ts explicitly states detection AFTER START, no veto, MONITORED. The inherited 22-pattern risk detector and advisory suppression policy are useful context, not a security parser or proof that a new profile blocked a command.

The existing soterai.runControlledTerminalCommand command at broker/commands.ts:308 previews one string, gets a native approval, calls broker /v1/terminal/execute, then opens a redacted result document. guard-core/ControlledTerminal.ts supports a small fixed-argv read-only allowlist (Git status/branch, version queries, pwd/ls) and refuses unsupported shell syntax. Its quoting rules are not PowerShell syntax: they must not be relabelled as a complete PS5.1 parser or expanded to run arbitrary -Command/-EncodedCommand/native interpreter input.

BrokerServer.ts:434-481 rechecks that allowlist, bounds timeout/buffer, chooses a trusted absolute executable through ControlledExecution.ts, shell:false and controlledEnvironment. ControlledExecution.ts removes ambient credential/search/preload state and fixes Git controls. BrokerServer's result path uses redactForSharing, not the new F08 complete-byte service or native F04 saved-file approval. This separate broker execution path is therefore not an already integrated F10 backend and should not receive unreviewed shell broadening under F10.

## Small recommended design to freeze next - proposal, not an API contract

- Register an opt-in contributed profile using an owned Pseudoterminal/dispatcher that executes the ACTUAL pinned PS5.1 backend for a finite declared operation set. Preserve ordinary native terminal/profile behavior as an explicitly separate unmanaged surface. A raw shellPath profile can be offered with strictEnv and supplementary hooks only if its weaker coverage/output limits are plainly stated; it cannot inherit the checked-dispatcher enforcement claim.
- Parse bounded command text to typed plans before execution: safe read/search/copy, clean-env summary, public finite PS operation, safe Git operation or withheld unsupported form. Freeze alias/case/quoting/parameter/path behavior and paired controls before tests. Reject unimplemented chains, pipes/redirection, expressions/subexpressions, backticks, call/dot sourcing, provider paths, wildcard reads, module-qualified bypasses and interpreter one-liners rather than approximate full PowerShell semantics.
- Send only trusted fixed backend source plus structured literal operation data. Do not concatenate user commands/paths into -Command, Invoke-Expression or dynamic script blocks. Support PowerShell's actual encoding deliberately (5.1 output encoding is not proven by Node's UTF-8 default). No arbitrary runtime override or inherited PATH search. No account-wide/profile preload.
- Route recognized protected/env reads through the existing trusted managed-read F04 service; do not let the shell read original restricted bytes first. Env remains all-values-masked even after approval. Ordinary restricted approval stays one-time and leaves denies intact. Any safe copy/search derived from this output needs a frozen exact-output/destination and overwrite policy; no raw original fallback.
- Gate trust + machine ps51Terminal + dependent read/matching/output flags dynamically. Use a fresh scrubbed child env with no app-vault injection. Implement cancellation/withdrawal, finite output/chunk/lifetime bounds and real close/drain proof before completed F08 publication. Record only value-free operation/status metadata; raw typed commands/paths can contain values and should not become diagnostics.
- Show the public profile/config diff before opt-in; preserve the prior default/profile state and provide scoped undo. A contributed profile can avoid editing the owner's $PROFILE altogether. Do not silently switch all terminals, install a runtime, rewrite normal profiles or turn a profile into a mandatory all-command hook.
- Actual planned acceptance must invoke installed PS5.1 in isolated synthetic roots for public success and declared protected read/env/search/copy/Git/interpreter refusals, quoting/case/chains, restart/cancel/withdrawal and profile rollback. Native arbitrary direct interpreter reads, absolute original paths, hook bypasses and independent uploads remain residual catalog rows, not PASS because a risk regex notices them.

No new F10 implementation/tests or shell launch is performed here. Root must freeze the exact API, grammar, capacities, supported profile model and real-vs-mocked evidence contract next.

## SHA-256 source/type/metadata snapshots

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| docs/soterai-lite/IMPLEMENTATION-PLAN.md | 39112 | 2ba3a2e93019861c6c509457d0fcf3f55e509d39bdecd9f8a9323f1eabab2c67 |
| packages/vscode-extension/src/project-privacy/ReadTerminal.ts | 3476 | ece1e4ec5396190af8ed6a89003bb26ddd6cae928a9078f223bd6c02486df413 |
| packages/vscode-extension/src/terminal/ShellExecutionWatcher.ts | 5606 | d468f1dbfc23b4ff14b48875a527526afabe190f5bbd928a43b736b247d63f3c |
| packages/vscode-extension/src/terminal/shellExecutionPolicy.ts | 5460 | 5e6eed55487ffed9775837741cd474a7eed49f48815edc53ba5f9f776fec3f5e |
| packages/vscode-extension/src/project-privacy/ProjectFileAccess.ts | 7503 | 84a0765886c36af6d34c6dc261a7c842abcbe276c5b72130298b5485707e1648 |
| packages/vscode-extension/src/project-privacy/commands.ts | 14766 | b4a6ede3672c2b5dc13e107aa938a54eb309a828570e03b293f7af69ee7cf037 |
| packages/vscode-extension/src/project-privacy/SafeFileView.ts | 3445 | 6b8e7723380a791f0450cb9627354a2e8bbdb96d900a05607e0d2bc57cb13f51 |
| packages/vscode-extension/src/security/childEnvironment.ts | 577 | 39dfde2af1d33413958e64f4c7018101107afe5b44840b27768cb5f0298ecb67 |
| packages/vscode-extension/src/security/SafeGit.ts | 3938 | 7605156c5b48522d9da8819f0d0c6950e533cc34779c0072aff8538546d9e219 |
| packages/vscode-extension/src/vault-runtime/VaultAppJob.ts | 15613 | d3e50fbb9a6ce1699a40a5fc78811718ec99d4247e5d64fed38cfb1fc1851bda |
| packages/vscode-extension/src/vault-runtime/VaultSurfaces.ts | 8974 | 54ec706c8311dfdc31537792b3b6cad8eab086cf852ab2a7c0fc9e95bb0ea05d |
| packages/vscode-extension/src/vault-runtime/RuntimeBinding.ts | 4252 | b6b9e7eb49aad7644192a7abcacbbe289785a78c6aae77dda6fad6eb3adeba8e |
| packages/vscode-extension/src/secret-broker/OutputFilter.ts | 5423 | f3dd1f90a0878614dd0c2a61fbf1653712c49dc9cf8055e59436c716de9404bf |
| packages/vscode-extension/src/secret-broker/runtime.ts | 3781 | b7bf74a43c117e4c30ecc8de8e2f68e56ac7816a2d63eca09876187ceda1a74d |
| packages/core/src/StreamingOutputRedactor.ts | 7985 | 428903846312dc93d3f30b0c3f976678d7a59b6f2458f1ecb5deffa9daf69dc8 |
| packages/guard-core/src/ControlledTerminal.ts | 6060 | 7cf813cc1b53ac6b5affc1272b1a0e8d386166a03f051cf8506913bb8ca3fa90 |
| packages/vscode-extension/src/broker/commands.ts | 39343 | f3abd55cf296ab978369bd0e4e2df6b1158749c46281db8961c5e6489bf1db08 |
| apps/local-ai-broker/src/BrokerServer.ts | 86222 | b38828d3d5b9f101fa6fe6def7775aa18420caf8a1dc0c061c2d7b29f3885a26 |
| apps/local-ai-broker/src/ControlledExecution.ts | 1263 | 6c59f1cfc72d8e51b0df02064c5c94fa57e701e59cf82b3441f48bdade2ceaac |
| packages/vscode-extension/package.json | 108375 | ea04afa5564009d30a1d0d70c0341bd1d2dce4f5201b173c0840eb1b39a206e3 |
| node_modules/@types/vscode/index.d.ts | 742205 | b38554611e1421314f60a3854dda5f00ad70819a44bdde4ed94e2776d49277cc |
| node_modules/@types/vscode/package.json | 836 | f5ca4f747a16da89901502cae456c2d019ff8aa0859b56695dccf72b598033d0 |
| docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/checkpoint-files.json | 2953785 | 219bf53847920c19924b06a1d12fc69fd7cad08ea5a0cf733037fd09e180b8e7 |

Read bookkeeping: one broad multi-read result was truncated, so the exact terminal API/version/service excerpts were reread in bounded commands. No failed lookup or prior stored version was treated as new executed shell evidence.