# F26a source and transition byte barriers: author contract

**PREPARED_NOT_BOUND.** These new templates implement the existing F26a card's
local source/transition verification steps. They have not been materialized or
executed. No current acceptance, final scope, Git result, native PASS, queue or
ledger update is claimed. The retained draft `scoped-git-lib-01.template.cjs`
and all H25 actual05 helpers remain unchanged.

The six new executable templates are:

- `scoped-git-lib-02.template.cjs`
- `current-acceptance-guard-01.template.cjs`
- `prepare-source-commit-01.template.cjs`
- `commit-source-01.template.cjs`
- `prepare-transition-01.template.cjs`
- `commit-transition-01.template.cjs`

`byte-proof-binding-required-01.json` is an intentionally invalid, unbound shape
guide. Empty arrays, null sizes and non-digest strings must not be accepted as
facts. Root must construct a new reviewed `byte-proof-binding-current-01.json`
after all required actual gates and the exact source review. Root may then copy
each template to its corresponding new `.cjs` path with no overwrite, replacing
`__F26A_BYTE_PROOF_BOUND__` with `F26A_CURRENT_BYTE_PROOF_FACTS_BOUND`, and the
library's `__F26A_BYTE_BINDING_SHA256__` with the SHA256 of that complete JSON.
No authoring step executes those copies. Root must review and syntax-check the
new actual copies separately.

The frozen parent is `1969c368d439237126a360af452c254a5826be88`. A changed parent,
VSIX, source freeze, fixture or driver basis requires a reviewed successor; this
template does not rebase, regrade failed runs or silently permit new deltas.

The known current facts are historical full02 on 989 inputs, current native03
on the same 989 memberships with exactly the error-name literal change in
`litePreCommitGuard.host.ts`, 988 unchanged inputs, compiler14 and fresh21-driver03
build with all20 affected driver outputs equal02, and the unchanged four-runtime
VSIX `bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91`.
The future guard preserves the historical attribution. It does not call full02
a new execution on the corrected native fixture. The earlier617 components,
targeted151 integration and historical full02 relationship is explicit in the
required `focusedCoverage` value.

Future acceptance must use feature `F26a`, status
`PASS_SCOPED_REQUIRED_F26A_GATES_BYTE_BARRIERS_PENDING`, and
`bindingVerification.status = PASS_EXACT_F26A_ACCEPTANCE_BINDINGS`. It retains
the H25 canonical artifact/content/gates/full/bindingVerification/native/
functionalSecurity field structures. The bindingVerification object must also
contain the four binding facts from the shape guide, `hostReview`,
`nativeDriverProvenance`, `snapshots`, `preCommitOffline` and `durableExit` facts.
The native array adds family `precommit` with primary30/restart4. Together with
the same20 affected families, the required actual totals are21 families,
543 checks and39 phases. Native02's2PASS/1FAIL/27NOTRUN, native03's startup
failure and diagnostic observations cannot satisfy those totals.

Each phase requires exact actual owned D-result/copy equality, its current
compiled driver's SHA, the same four runtime bytes, zero failed/not-run checks,
and Code's actual exit0, both EOFs and zero signals. Precommit additionally
requires its actual direct-child closure/env/argument proofs, metadata-only
signed request/index witnesses, actual owner commit proofs, and the actual
offline-owner-block receipt after primary Code closure/absence/stable streams.
Parent Git closure never substitutes for nested client closure. F08 retains
its existing lack of TextDocument counters; absent counters are never invented.
Owned-output keeps13 actual naturally closed children,8 task runs and7 debug
runs. Fresh functional10 and security17 must retain actual close/EOF and the
same8 BLOCKED_SCOPED/9 LEAK_CONFIRMED baseline. Content must be15 entries,
four runtimes and82 machine settings with the precommit flag default false.

`requiredExecutedFixtures` must contain exact facts for every helper/driver
actually executed in the accepted native run: all21 compiled03 drivers plus
the actual launcher/control/bootstrap/offline/host/artifact/pipe helpers. Each
must appear in the reviewed custody manifest. Its records retain canonical
`path`, `bytes`, `sha256`, and `snapshot` fields. Known failed/corrupt files stay
listed as `RETAINED_NONPASS_NOT_EXECUTABLE_NOT_CURRENT_GATE`; their raw bytes are
preserved, including any binary/NUL archives. Such bytes never support a current
passing text gate. All H26 evidence is included recursively in the later source
membership, independently of whether it is acceptance evidence.

Root's `source-candidates-03.json` is advisory, not an allowlist. Its67 apparent
working-checkpoint deltas are not assumed to mean55 actual Git additions and12
Git modifications. In particular, an entry already present at HEAD may have
been absent from the prior working-input inventory. The earlier862 raw-blob
differences include795 preexisting LF/CRLF differences and must not become the
commit scope. This author did not run Git or finalize any of these paths.

Root must freeze `planned-source-scope-current-01.json` only after acceptance
and review of the actual current Git delta. `records` contains the explicit
production/unit/docs paths plus the intended queue and ledger. Evidence paths
are omitted from this list because the preparation captures the complete H26
tree itself. `trackedDelta` is the exact changed tracked subset of those records.
`unrelatedPreserved` contains facts for the remaining actual tracked working
delta; those paths are never staged and are checked before/after. Preexisting
line-ending differences remain outside the pathspec. Untracked unrelated files
are untouched by the explicit allowlist. An existing nonempty index is refused
without reset, unstage, stash, restore or cleanup.

`parentRecords` must give the actual parent Git blob fact/OID/regular-file mode
for every selected existing path, or `{path, absent:true}` for an actual new Git
path. Deleted records use `{path, deleted:true, before:<exact parent record>}`.
The parent fact describes actual Git object bytes, not a CRLF working snapshot.
The helper independently verifies Git's SHA1 blob framing, SHA256, length and
mode. It does not infer an LF/CRLF transformation or pair a working snapshot with
an unrelated Git OID. Present working facts always name exact frozen bytes.

Root writes the reviewed source queue/ledger first: parentF26 remainsACTIVE,
subcardF26a isVERIFYING and points at the acceptance file, F26b/c remainPLANNED.
The binding pins those queue/ledger hashes. The authorized later order is:

1. `prepare-source-commit-01.cjs` checks current acceptance/source/scope and
   captures the explicit memberships plus every current H26 file recursively.
2. `commit-source-01.cjs` additionally freezes the membership JSON itself,
   checks every present/deleted membership immediately before explicit-path
   staging, reads and verifies every actual index blob, rechecks the full index
   immediately before commit, and reads every actual committed blob afterward.
3. After that actual proof, root writes the prospective transition queue/ledger:
   F26a DONE/PASS_SCOPED with exact source proof references; parentF26 staysACTIVE;
   F26b may be markedACTIVE in these reviewed bytes, but its production remains
   prohibited until the separate transition proof exists. F26c staysPLANNED.
4. `prepare-transition-01.cjs` verifies the source proof/actual source commit,
   rechecks all source working memberships except the exact queue/ledger
   exceptions, and captures those two new files plus every H26 path not already
   present in the source commit.
5. `commit-transition-01.cjs` verifies every transition membership including its
   unchanged JSON, repeats full index and actual commit checks, and rechecks
   source working/actual committed bytes before/after with only the same two
   intentional exceptions. F26b may begin only after the resulting proof exists.

Both commits use NUL-separated literal explicit pathspecs; no `add -A`, `commit
-a` or unrelated staging occurs. Unknown staged paths, in-progress merge/revert/
cherry-pick state, an unexpected parent, new evidence after the freeze, changed
input bytes, changed accepted facts, unexpected mode or missing blob all refuse.
The established offline-hook arguments belong only to these root local evidence
commits and must never be reused for native owner-commit fixtures.

Membership JSON cannot include its own hash recursively; its actual fact is
captured immediately afterward and checked before add, in index and in commit.
The source pathspec/index-check/commit-output files and final source proof are
new post-freeze evidence retained for the transition. The transition has its
own explicitly enumerated post-freeze auxiliaries/final proof. Root must not add
another H26 wrapper receipt between a freeze and its corresponding commit;
unexpected files cause refusal. Proof status describes actual checked bytes,
not an atomic OS transaction. A failure after staging/commit preserves that
state for root inspection and never resets or retries automatically.

The only author verification is syntax and exact copy/hash custody, recorded
separately. No feature test, helper behavior, actual blob check, membership
freeze, staged path, commit or transition has been executed by this author.
