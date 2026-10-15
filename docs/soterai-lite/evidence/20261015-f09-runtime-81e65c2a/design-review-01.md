# F09 design review 01

Date: 15 October 2026. Independence **LOW**, same model lineage. Read-only contract review; no source/test edits, product/test execution, real-secret/configuration reads or network operations. Only this unique evidence note was written. This is not human/independent acceptance or a numerical rating.

Reviewed frozen documents:

| Document | SHA-256 |
| --- | --- |
| design-01.md | fabd53d6e3b17706774107acfe10d6bf2d12b7fc7e68873051738c14ad421e92 |
| design-02.md | b292829ddd54604ae135278661b70e4f6f2f8e4c1e62f71242d6ef0d9c632b8a |
| design-03.md | 2db7c5118dc5e837ccbc3c75260f5340779e939fdd046ecf424dbbb0793ba09c6 |

## Findings resolved during design review

**D09-01, placeholder identity — resolved by design02.** F06 placeholders use exactly 32 uppercase hexadecimal characters and canonical decimal ordinal0..255, not generic mixed-case hex/unbounded digits. Explicit shape/case/range controls now precede fixtures.

**D09-02, values before bootstrap compatibility proof — resolved by design03.** An Electron executable is not necessarily usable as standalone Node on every distribution. Spawning it with selected secret values before proving the fixed bootstrap could deliver those values to the wrong runtime. The same owned child now receives only the sanitized public base environment initially, emits private READY before app loading, and receives selected values only in one private START message after fresh guards. Bootstrap sets only its own child environment. No extra probe process, credential argv/file, parent environment mutation or executable discovery is required.

**D09-03, STOP during startup — clarified by design02/03, subject to D09-04 below.** STOP/disconnect handlers are installed before READY/import; cancellation is remembered; exported start cannot run after cancellation; stop is called at most once. Fixed argv boundary and Windows ESM pathToFileURL handling are explicit. The actual supported executable/build still needs native acceptance. Missing READY proves absence of the selected-value transfer, not absence of every side effect an unsupported runtime might produce; other distributions remain unverified.

## Remaining contract clarifications

**D09-04 — pending ESM import is not reversible. MEDIUM wording/acceptance boundary.** Design03 says cancellation prevents app load "including while ESM import is pending." Once import/module evaluation has begun it may already execute top-level code or continue after an await; the launcher cannot revoke those effects. State the two guarantees separately:

1. STOP/disconnect before accepted START prevents initiating the app import/load.
2. STOP after import begins records cancellation, withholds output, skips exported start and invokes the cooperative stop contract once exports become available. It does not undo top-level module effects.

The later sentence acknowledging normal module-initialization effects is consistent with this narrower guarantee. Test cancel-before-START separately from cancel-during-held-import. No source-level debugger or app-confinement redesign is requested.

**D09-05 — recovered ownership is not a live job snapshot. LOW API-shape gap.** Live VaultAppJobSnapshot has an exact state union that excludes UNVERIFIED, while recovery must display previous live/unknown PID records as UNVERIFIED and jobs() is typed as returning those live snapshots. Define recovery-only ownership metadata with its own verification status or an explicit safe union. Do not create a live VaultAppJob/completion or adopt a process from the old PID. This is a schema/claim distinction, not a request to add process control.

## Acceptance constraints retained

The forthcoming private lease API must remain one-shot, internal and bound to exact current root/source/name/placeholder/key/policy/epochs; it must preserve F06 and never create a key or mutate source/ciphertext as fallback. The retained guard must be used before spawn and again before private START; stopped/withdrawn preparations cannot inject later.

Reserve maxJobs admission before held approval/decryption, including pending approvals and STOP_UNCONFIRMED children. The design02 coordinator admission contract states this. Treat spawn/IPC/pipe errors after creation as uncertain ownership until actual child close; an ACK/error/timer is not exit evidence. Persist only value-free ownership metadata and retain unresolved jobs visibly.

Both stdout/stderr must remain drained after F08 overflow/cancel while data is discarded. F08 completed output may be released only after actual close and drained pipes. Cooperative STOP, timeouts and task/debug close never call OS kill, TaskExecution.terminate or forced timeout exit; a child that ignores shutdown remains STOP_UNCONFIRMED. Real negative fixtures must self-exit shortly; indefinite cases use mocks.

CustomExecution and lifecycle-only inline debugging share the same coordinator and do not expose values in task/debug configuration. Unsupported evaluation/source debugging stays explicitly outside the card. Owner-approved application code can inspect/write/print/transmit injected values; these controls do not confine arbitrary app code or independent native routes.

No other concrete design blocker was identified in the reviewed frozen documents. Implementation/fixture/native evidence remains pending; this review cannot mark any runtime behavior PASS, promote the catalog or authorize F10.

