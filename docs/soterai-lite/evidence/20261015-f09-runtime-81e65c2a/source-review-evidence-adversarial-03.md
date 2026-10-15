# F09 narrow static source review 03

Reviewer: `/root/evidence_adversarial_review`, same lineage, independence LOW. Closing metadata read: 2026-10-15 12:45:11 UTC. Scope is only the no-child debug cancellation correction in `VaultSurfaces.ts` and the design06 short-value output correction in `VaultAppJob.ts`. No tests, compiler, build, child process, native host, package or installed extension was executed or rerun by this reviewer. No production/test files were changed. This new note is the sole write for this task.

**S09-06 source-corrected:** terminate/disconnect now request cooperative stop, send the response acknowledgement, then emit exited/terminated exactly once only when `#started` is false and `#finished` is false. `#finished` is set before those events. Aborted state prevents later launch/configurationDone from starting work; repeated stop requests cannot repeat completion. A started pending approval or owned child remains on the existing async completion path, so the new branch does not assert exit for an in-flight run. Disposal suppresses events and clears the no-start/completed waiting timer. No OS process termination was introduced.

**Design06 short values implemented conservatively:** construction records whether any selected exact value contains fewer than eight Unicode scalars. After F08 has produced COMPLETE output, each nonempty completed channel is replaced with the fixed marker if such a short registration exists. Empty channels remain empty. The actual private registry validates the combined replacement via `isSafeReplacement`; an unsafe marker is withheld. Existing WITHHELD results remain withheld. This happens only after actual child close and both pipes have drained, and retains the existing redactor's bounds, failure and cancellation paths. Private matcher state is cleared during completion. The implementation does not change F07/F08 short-token matching semantics or claim selective public-output availability for short values. Values of eight or more scalars stay on the existing output path.

No new high-confidence blocker was found in this narrow source review. This is not a behavioral PASS or a general release certification. The root reported retained pre-fix four-case cancellation and four-case short-output fixture baselines; this reviewer did not rerun or recalculate them. Final matching focused/full/compiler receipts remain the root's responsibility. Package identity, actual executable handshake, native task/debug lifecycle, installed-VSIX behavior, supported-tool promotion and independent human review are not certified. No score or final rating is assigned.

The files below were read, hashed, and hashed again unchanged at review close using narrow `Get-Content`/`Get-FileHash` and UTC clock queries:

| Path | SHA256 |
| --- | --- |
| `packages/vscode-extension/src/vault-runtime/VaultAppJob.ts` | `d3e50fbb9a6ce1699a40a5fc78811718ec99d4247e5d64fed38cfb1fc1851bda` |
| `packages/vscode-extension/src/vault-runtime/VaultSurfaces.ts` | `54ec706c8311dfdc31537792b3b6cad8eab086cf852ab2a7c0fc9e95bb0ea05d` |
| `design-06.md` in this evidence directory | `7a13a742bdba56e347f62bd719481ee9e102bf397d857650a902d07161522053` |
