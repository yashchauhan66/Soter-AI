# F10 frozen design 01 — before fixtures/production

F09 source7bfdc91279ab9f59811ba6918e388846c5ea2411 verified193indexed/193changed paths; transition24da9ce9907cd6082b7ce3a3e79136cd4c551508 verified6/6. F10 alone active. No F11 production. This card provides a real contributed **SoterAI PowerShell 5.1 (checked commands)** profile using VS Code's documented TerminalProfile + ExtensionTerminalOptions/Pseudoterminal, backed by actual finite installed PowerShell5.1 child operations. This is more than the existing fixed read frontend, but is deliberately not an arbitrary interactive PowerShell interpreter. Unsupported input never falls through to a shell. No normal user $PROFILE edits or arbitrary native-terminal output interception. Supplementary worker command hooks are not an OS veto. Independently launched interpreters/absolute original paths/native shells/uploads remain uncovered catalog routes.

## Host-free whole-input grammar

New `packages/core/src/PowerShell51Command.ts` exports frozen `PS51_LIMITS={maxCommandBytes:4096,maxTokens:32,maxTokenBytes:1024,maxSearchBytes:256,maxLines:100,maxSleepMs:2000,maxListEntries:256,maxWorkers:2,maxRuntimeMs:30000,stopGraceMs:1000,maxRequestBytes:16384}` and `parsePowerShell51Command(input:unknown):PowerShell51Command|undefined`. It never throws an input-bearing error. Result and all nested arrays/line objects are fresh deeply frozen copies. Input Unicode must round-trip strict UTF8; bound before lexing. No execution/FS/vscode import.

Operation union:

- `{kind:"PUBLIC",action:"location"|"version"|"date"|"write"|"list"|"sleep",args:readonly string[]}`.
- `{kind:"READ",path:string,lines?:Readonly<{side:"first"|"last",count:number}>}`.
- `{kind:"SEARCH",path:string,needle:string}` — literal substring matching only, no regex engine.
- `{kind:"COPY",path:string,destination:string}` — copy the reviewed filtered safe view into a NEW file, not raw Copy-Item semantics.
- `{kind:"ENV",name?:string}` — names and constant masks from the fresh managed child base only, never dump the extension host environment.
- `{kind:"GIT",action:"status"|"diff-stat"}` — fixed SafeGit metadata operations only.

Case-insensitive command/option names; preserve literal argument/path case and exact Unicode. Whole tokens may use single or double quotes. Single quote escaping by doubled single quotes is supported. Double quotes with `$`/interpolation, all backticks, unquoted `$`, expression/control syntax, splats and incomplete/concatenated quote fragments reject. Outside quotes reject `; | & > < ( ) { } @`, newlines and control characters. `--%` rejects. Literal punctuation within a quoted token is data, not evaluated. No chain/pipeline/redirection/prefix can execute partially. Unknown commands/options/extra tokens reject with no fallback.

Relative file/directory paths only: no drive/URI/UNC, absolute path, parent traversal, wildcard or NUL/control. Accept slash/backslash relative segments; no Unicode normalization. Directory `.` is allowed for list only. Canonical root containment/alias/hardlink/type/identity checks happen again at I/O. No original protected path is forwarded to a cmdlet or interpreter.

Declared exact forms:

- `Get-Location|pwd`, `Get-Date`, `version|$PSVersionTable.PSVersion`: no args.
- `Get-ChildItem|ls|dir [relativeDirectory]` (default `.`); `Get-ChildItem|ls|dir Env:` is ENV.
- `Write-Output|echo [literal ...]`; `Start-Sleep|sleep -Milliseconds <canonical decimal 0..2000>`.
- `Get-Content|cat|type|gc <relativeFile>` or `... -LiteralPath|-Path <relativeFile>`.
- `head|tail [-n <canonical decimal 1..100>] <relativeFile>`, default10, returned as READ first/last.
- `Select-String|sls|grep|rg <literalNeedle> <relativeFile>` or `Select-String|sls -SimpleMatch -Pattern <needle> -LiteralPath <file>`. Needle <=256UTF8bytes, no regex interpretation.
- `Copy-Item|copy|cp <source> <newDestination>` or `... -LiteralPath <source> -Destination <newDestination>`; source==destination rejects.
- `env|set` no args; `printenv [NAME]`; `$env:NAME`; `Get-Item Env:NAME`. NAME exact environment identifier, preserve case; no assignment or value expansion.
- `git status [--short]`, `git diff --stat`; every history/body command (`show`, `log -p`, raw `diff`) refuses. Detectable Node/Python/PowerShell/cmd/script one-liners and every other native executable refuse as unsupported.

These refusals are checked-dispatcher grammar evidence, not a claim to detect every equivalent command in another shell. `head/tail/grep/rg/copy` in this profile have the declared safe-view meanings, not full native-tool semantics.

## Actual finite PowerShell worker

New `packages/vscode-extension/src/terminal/PowerShell51Worker.ts` exports class and safe types. Constructor `(options:{id:string,executable:string,root:string,operation:Extract<PowerShell51Command,{kind:"PUBLIC"}>,parentEnvironment:NodeJS.ProcessEnv,output:PowerShell51Output,enabled?:()=>boolean},deps?:{spawn?:typeof import("node:child_process").spawn,setTimer?:(callback:()=>void,ms:number)=>unknown,clearTimer?:(handle:unknown)=>void})`.

`PowerShell51Output` structural API is F08-compatible `push(channel,Uint8Array)->{status:"BUFFERED"|"WITHHELD"}`, `finish(exitCode)->OutputResult`, `cancel()`, `dispose()`. Private output registration comes from the vault, never injected into this worker. Trusted test deps are not command arguments. Actual executable is only the existing pinned local System32 WindowsPowerShell/v1.0/powershell.exe; no PATH discovery/download. Public metadata inspection is not a fresh shell version proof; native acceptance must observe actual version5.1.

Methods `start():Promise<PowerShell51Snapshot>`, `snapshot():Readonly<PowerShell51Snapshot>`, `cancel():void`, `dispose():void`, getter `completion:Promise<{snapshot:PowerShell51Snapshot,output:OutputResult}>`. Safe snapshot exactly `{id,state,pid?,exitCode?}`, id validated UUIDv4 before reporting; state `READY|BLOCKED|RUNNING|CANCEL_PENDING|STOP_UNCONFIRMED|EXITED|CANCELLED`. Single-use. Spawn failure BLOCKED; post-spawn error is not exit proof. Install child-close/error listeners before nullable pipe setup. All data drained even after overflow/error/cancel, no fallback text.

Use `spawn` shell=false/windowsHide=true, root cwd, fresh validated minimal OS/locale/temp env with no inherited credentials/search paths/loader/proxy values. Ignore stdin interaction outside the trusted fixed protocol. Fixed script only in `-NoLogo -NoProfile -NonInteractive -EncodedCommand <fixed UTF16LE script>` argv; operation/args go as bounded UTF8 JSON over stdin, never interpolated into script or a workspace file. Validate operation schema/bounds again before spawn. Worker switch calls only fixed public cmdlets; no Invoke-Expression, scriptblock evaluation or request-controlled executable. Worker guards shadow protected read/env/unsafe entry points and never fall back to originals; actual read/search/copy/env operations are dispatched by the extension's existing approved reader instead. List emits at most256 names after bounded collection, with no recursive/force options. Output encoding explicitly UTF8; actual shell version, location/date/write/list/bounded sleep are useful positive controls.

No chunk reaches UI before actual child close + drained EOF and final F08 decision. All short selected registrations conservatively mask nonempty output as under F09; unsafe replacement markers withhold. Timeout30s/withdrawal/cancel permanently withhold output. Cancel closes no unrelated process and never calls kill/Terminate/process.exit. Finite cmdlet cancellation is a request to abandon output; wait for actual natural child close. After1s unclosed operation remains STOP_UNCONFIRMED, never falsely resolve/close PTY. Indefinite cases use mocks; real negative fixtures self-finish. Deactivation records value-free outstanding ownership; restart UNVERIFIED, no PID adoption.

## Private output protection and dispatch

Add internal `VaultManager.createManagedOutputFilter(rootUri,enabled)` returning only an F08-compatible filter, not raw registrations. It privately reads current bound workspace vault values with verified existing key/no key creation/no pending migration and applies F07 registration limits. No vault file => empty registry/provider detection, no key generation. Unavailable/incomplete registry => WITHHELD output/launch, not partial masking. Current flag/trust/config/key/policy/cipher changes revoke pending output. A short-value conservative output wrapper may be a new F10 helper; F07/F08/F09 behavior remains tested and unchanged.

Protected/public file reads all reuse the exact existing F04 native approval/private trusted closure and its current safe text, expiry, file identity and revocation, rather than a public caller-supplied trusted-surface claim. Search/head/tail transform only that reviewed safe view then pass final bytes through output protection. COPY additionally reviews a new in-project canonical destination, writes only the finalized filtered safe view exclusively, refuses aliases/existing destinations, and rechecks cancellation/policy/source immediately before publication. Native protected env access always requires approval and returns names/masks; ordinary restrictions remain stored after one read. ENV never returns inherited host credential values. Fixed SafeGit metadata operations retain its hardened env/config/options; history/body forms refuse before invoking Git. No arbitrary code/build scripts are advertised as checked.

## Profile, opt-in diff/undo and terminal UI

Contributed profile id `soterai.ps51.checked`, title `SoterAI PowerShell 5.1 (checked commands)`. `soterai.lite.ps51Terminal` defaulttrue machine/restricted, but profile activation is optional. Use ExtensionTerminalOptions/Pseudoterminal with the actual captured worker for public operations; this avoids TerminalOptions env merging. If a raw native profile is ever added separately, strictEnv:true and a separate honesty gate are mandatory. This card adds no such raw native profile and does not edit $PROFILE.

Native **Enable Checked PowerShell 5.1 Profile** shows a metadata-only diff for the chosen workspace folder's `terminal.integrated.defaultProfile.windows`, asks approval, preserves exact prior value and all unrelated settings, persists bounded owned change metadata, writes/reads back that one setting. Never read/display whole user settings or profile/history. **Restore Previous Terminal Profile** reviews undo, acts only if root/current owned value still match, otherwise withholds and retains the record. Crash/incomplete states retain their metadata; no blind rollback. Existing profile records remain on feature withdrawal, with new operations withheld. Normal user VS Code/profile remains untouched by agent tests; all acceptance changes occur only in isolated synthetic profiles/projects.

`PowerShell51Terminal` Pseudoterminal uses hidden bounded input (no raw command echo/history), `help`/`clear`, single pending command, fresh cancellation signal, clear command grammar/coverage text. Native input-box execution is available for readable owner command entry. Ctrl+C revokes owned read approvals and cancels pending worker output; no secret prefix or undecided tail. On close wait for actual worker close or show tracked STOP_UNCONFIRMED, not false completion; VS Code/user can remove a visible tab independently. At most2active workers globally, no unbounded queued approvals. The toolbar/status says **Managed checks — declared commands**, with the known bypass list visible.

Registration commands configure/open/run/restore/status accept only URIs/opaque metadata or native owner input, no spawn/reader/env overrides. Task/shell events that fire after execution remain the existing advisory monitor. F10 acceptance: authored failing grammar/worker/dispatch/profile tests; real installed PS5.1 finite commands and env absence; ordinary/env native approval, masked search/copy, whole-input refusal, diff/undo/restart/cancel/flag withdrawal, exact VSIX/native/affected/scoped commit+byte verification. No F11 production before the barrier; catalog44/rating/human/platform/external routes pending.
