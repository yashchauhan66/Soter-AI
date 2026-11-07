# F26a finite Git process contract01

**TEST-AUTHORING / PREPARED / STATIC-ONLY / NOT-EXECUTED; independence LOW.** This freezes the next private transport component before root implementation. Tests construct retained synthetic metadata/index files manually and inject every Git child. No real Git, hook, process signal, pipe destruction, worktree/history scan, network, normal profile or deletion runs. Existing F26a order, ledger and required native gates remain unchanged.

`history-hooks/PreCommitGitProcess.ts` exports `PreCommitGitProcess` with options `{index:CheckedHookIndex, operation:unknown, valid:()=>boolean, deadline:number, now?:()=>number, spawn?:typeof spawn}`. Methods: `start():Promise<{status:'COMPLETE',bytes:Buffer}|{status:'UNAVAILABLE'|'STOP_UNCONFIRMED'}>`, `withdraw():void`, readonly `closed:Promise<void>` and `busy:boolean`. Only a genuine `CheckedHookIndex` authorizes process creation; a caller cannot replace its root, metadata, environment or selected index with a structural lookalike.

Fixed operation grammar (exact own data fields, no accessors/coercion/arbitrary args):

| Operation | Literal suffix | Private stdin | Stdout cap |
| --- | --- | --- | --- |
| `{kind:'version'}` | `--version` | none |4096 |
| `{kind:'entries'}` | `ls-files --stage -z` | none |262144 |
| `{kind:'sizes',oids}` | `cat-file --batch-check=%(objectname) %(objecttype) %(objectsize)` | each validated OID + LF |12288 |
| `{kind:'batch',objects}` | `cat-file --batch` | each validated OID + LF | sum sizes +96 × count |

`oids` and `objects` are nonempty ordinary dense arrays, at most128 unique lowercase40-hex OIDs, with no extra/accessor fields. Each batch object has exactly `{oid,size}`; size is a safe integer0..65536, total≤1048576. Repeated OIDs, upper-case/option/ref spellings, malformed arrays/objects and any extra route/argv/env/config field refuse before spawn. The transport does not parse stdout object/listing bodies or validate credential content; a later pure parser/analyzer owns those decisions. COMPLETE bytes are private local data, not UI-safe/redacted output.

Spawn the fixed `index.metadata.executable`, literal arguments with existing `safeGitArguments(index.metadata.job, ...)` and fixed no-lazy-fetch/no-replace/no-optional-locks/protocol.allow=never/pager/color/attributes/gc/maintenance controls equivalent to HistoryGitProcess. This scanner child deliberately disables hooks; it must never be reused as the later positive owner-commit invocation. Environment is **exactly** `index.environment`, including captured absolute GIT_INDEX_FILE. Version cwd is metadata.job; every other cwd is index.root. `shell:false`, `windowsHide:true`; no timeout, killSignal, AbortSignal, process killing or pipe destruction.

Observe actual child close0 plus both stream EOFs, zero stderr, valid monotonic clock before the effective min(caller deadline,start+60000), current valid guard and still-live checked index before releasing the entire private stdout buffer. Copy admitted chunks so caller buffer mutation cannot change held bytes. Nonzero/missing/signal exit, stderr, stream error, overflow, guard/index drift, clock reversal/nonfinite or deadline expiry withhold; no raw error/stringification fallback. Non-COMPLETE results contain only status.

Withdrawal before start produces UNAVAILABLE without spawning. Withdrawal of an owned open child is sticky, clears private held bytes, returns STOP_UNCONFIRMED and retains busy/closed ownership until actual close and both EOFs. Later data, true guard, restored index or repeated start cannot revive it. No signal (including0), pipe destruction or inferred wrapper exit. Pre-spawn exception/error without a PID can finish unavailable without claiming actual child closure; an error after ownership retains that ownership until real observations.

Tests hold an injected monotonic clock at1000 through all real filesystem preparation and fake admission. Deadline/60-second-cap tests advance only after the fake child exists and trigger synchronous data/final guards; they do not rely on a30ms wall-clock filesystem preflight or a1000ms per-test timeout. Reuse a genuine synthetic index within a single multi-operation test to avoid repeated metadata setup while retaining independent child/guard/assertion cases. The test author will not execute imports/tests; root records the actual missing-module baseline and results after fixture freeze.
