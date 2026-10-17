# F10 additional observer and PTY regressions

Same-lineage test author/read-only review, LOW independence. Only test/evidence
files changed by this author; no production edits or compiler/full suite/native
host were run.

O11 was appended to the ownership fixture, now 11 declarations / 15 tests,
SHA256 `0789166a0a7deb8919b79862b6a967c5d12920ba20ef281d65eed93c040e6056`.
It makes worker cancellation a request that leaves completion held, throws from
the RUNNING observer, and requires cancellation, withheld output, a BUSY session
until manual actual completion, and the terminal CANCELLED observation.

`session-observer-before-01` exit0 / 15 PASS / 0 skip/cancel, raw SHA256
`f84e80fee83364e0de6c0c2179f802d9997ee01d37d01d92e60a539d28350a68`.
Despite that output name, O11 is **postimplementation regression evidence**:
the production owner had already implemented observer catch/cancel/await before
O11 was authored. No preimplementation failure exists or is claimed for O11.
Freeze02 captured session SHA37972581..., and the owner then corrected start
snapshot reporting before the run; postrun source SHA256 is
`bf9646285b3426052f04ff318d4ba2e641da2e5d63fdc93cc96aaf417c4173bc`.
The pass is not attributed to the earlier frozen source identity. Prior 14-test
preimplementation baseline remains immutable and separate.

Read-only PTY review found that `run` defers execution to a microtask after
reserving `#pending`. Same-turn Ctrl+C cancels the session before `execute`
starts, allowing that command to acquire the newer generation as a fresh request.
Same-turn close also still invokes the reserved session command. The actual
closed session withholds, but the PTY should skip dispatch entirely after close.
Programmatic run bypasses the PTY's typed input validation; the actual session
parser separately rejects those inputs, so this was not a demonstrated arbitrary
shell bypass. No claim about a hostile replacement session is made.

New `powerShell51TerminalReview.test.ts`: 7 declarations / 16 tests, SHA256
`ae10b09fbdd65f55259bfd4938c4014100c72c8a2e655c800a74a1cbfdfb7987`.
Before production fixes, `pty-review-before-01` exit1 / 2 PASS / 14 FAIL /
0 skip/cancel, raw SHA256
`f8338a5003f381a654118280c43e869cc1e2cfc214ae0cb1b11ddda2b0e90f33`.
PTY production SHA256
`4d966c33ee8a0283ef267ec9958b86aaf1a22f9a0ddb5a30c384acc896e25f27`
matches both pre-run freeze and post-run read. Thus this is a real pre-fix
baseline. Failed cases: same-turn cancel/close, ASCII/UTF8 overflow, six control
cases, malformed high/low UTF16, null/object without coercion. Both inclusive
valid4096-byte public controls PASS. Later assertions after a first failure are
not represented as executed.

All exact argv, exit codes, UTC timestamps and output hashes are in the immutable
`.txt.result.json` files. Synthetic directories and all old evidence remain.
