# F10 lifecycle regression baseline and directory protocol review

Same-lineage test author/read-only source review; independence LOW. No production
source edits, compiler/full suite, real child, directory enumeration outside a
project, process termination, downloads or login were performed by this author.

Design05 was read after ledger and handoff. The new fixture
`checkedPowerShellSessionOwnership.test.ts` has 10 declarations / 14 expanded
tests. Its pre-source bytes and the reviewed production hashes are frozen in
`session-ownership-fixture-freeze-01.json`. Fixture SHA256:
`6862f69a7e3b1cafca3af74e7ceb0774e7febfd57fe9fa6bddf7803fac31e4e1`.

## Exact execution and result

`run-f10-check.ps1 -Name session-ownership-before-01 -Tests @('checkedPowerShellSessionOwnership.test.ts')`
returned exit1 with runner `spawn EPERM`, one file-level failure and no fixture
execution. The 14 declared tests are NOT_EXECUTED for that attempt.

The same fixture was run through the required escalation with fresh name
`session-ownership-before-02`. Exit1; 14 tests, 3 PASS, 11 FAIL, zero skip/cancel.
Raw SHA256 `735f7fef4ff10e009c13de30127579131623e7c926dbcde0c0dd92bdcd25fed3`.
Exact argv, UTC observation, native exit and raw hashes are in the immutable
`.txt.result.json` receipts. The original raw evidence has not been overwritten.

The eleven failures show missing session lifecycle hooks: admission is never
called, a worker starts without durable READY admission, rejected/false/nonboolean
admission cannot prevent start, cancellation/root/policy drift during a held
admission is not rechecked, and no start/completion observer snapshots are sent.
These are expected failing preimplementation baselines, not assertions of new
implemented protection. Assertions after each test's first failure are not
represented as executed.

Three independently passing controls cover optional-hook compatibility and the
existing worker's directory identity guard. O09 swaps the validated in-project
directory to a synthetic outside junction after worker construction, during
mocked native launch and before its `spawn` protocol callback. Captured stdin is
zero bytes; output is withheld; the mocked child closes naturally; kill count0.
Neither target is enumerated. O10 preserves the directory and proves exact
`PUBLIC/list/public` JSON reaches stdin and the supplied public completed output
is released. This is mock protocol/race evidence, not a real filesystem listing
or universal protection from a hostile process racing after protocol dispatch.

## Hook requirements for the production owner

- Dependencies remain trusted internal constructor arguments. Add optional
  `admitWorker(snapshot): Promise<boolean>` and `workerChanged(snapshot): void`.
- Construct one worker, capture immutable value-free READY metadata, then await
  admission before calling `start`. Only strict `true` admits; exceptions and
  nonboolean truthy values withhold without start.
- Recheck the existing generation/root/source/directory/policy guard after the
  awaited admission. A canceled/disposed/withdrawn or changed binding must cancel
  the no-child worker, await its actual completion and report its terminal safe
  snapshot before forgetting ownership.
- Report the actual snapshot returned by `start` and the completion snapshot.
  Do not fabricate RUNNING/EXITED for BLOCKED no-child outcomes. Duplicate BLOCKED
  lifecycle observations are acceptable; snapshots remain value-free and bound
  to the same generated worker id. Keep the session BUSY through completion.
- Preserve no-hook internal compatibility and cancellation without killing.

Additional read-only concern: if a trusted observer unexpectedly throws after a
child starts, session cleanup must still retain close/EOF ownership. A catch that
simply clears `#worker` in `finally` would abandon that live worker. Observer
exceptions should safely withhold/cancel while still waiting for actual worker
completion. This concern was reported to the production owner; no unexecuted
test or completed fix is claimed here.

All synthetic directory fixtures, original directories retained by rename and
outside junction fixtures remain. No old raw outputs were deleted or rewritten.
