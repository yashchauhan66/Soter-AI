# F09 deferred release and acceptance scaffolding 01

Prepared on 2026-10-15; NOT RUN by this author. No package, native host, test, compiler, Git mutation, queue advance or acceptance write was executed. This is a usage contract for later root-owned facts, not an acceptance receipt.

## Release runner

run-release-01.ps1 requires -RetainedTypecheck, -RetainedFocused and -RetainedFullTests, each naming an existing log inside this exact F09 evidence directory. The runner verifies each .result.json exit code, raw-log SHA-256 and declared output path. It separately verifies already-recorded metadata-sync-01.txt and generate-readiness-01.txt; it never reruns metadata/readiness/full tests. It then runs package-01, vsix-inspection-01 and host-build-01 through the retained run-check wrapper, refusing pre-existing output files and artifact/extraction paths.

run-local-checks-01.ps1 remains retained NOT RUN; it would repeat sync/readiness and should not be used for the current state.

## Deferred acceptance input

Before executing prepare-acceptance-01.cjs, create a NEW bindings JSON inside this F09 directory using final observed facts. No such bindings file is authored here. Invocation: node <this-directory>/prepare-acceptance-01.cjs <bindings-relative-name>.

Required fields:
- schemaVersion: 1; feature: F09; parentCommit: exact frozen F08 transition 583e4f79e8bbfd2c18a4bbe64c9fbd08d091f2cc.
- artifact: {path,sha256}; path is the exact planned packages/soterai-lite/soterai-lite-0.7.0-f09-20261015-attempt01.vsix. Supply the freshly measured final SHA-256.
- inspection: {path,sha256}, bound to the final immutable VSIX inspection JSON.
- checks: exactly ten objects with unique role typecheck/focused/full/metadata/readiness/package/inspection/hostBuild/native/affected. Each supplies log relative to this F09 directory. Focused/full also supply kind: tap and expected observed tests/pass/fail/cancelled/skipped counts. No unknown or estimated test total is built into the script.
- native: result and probe, each {path,sha256}, relative to this F09 directory. Result must contain the declared F09-H01 through F09-H12 observations, all PASS on the exact packaged runtime. The sibling freeze.json must identify its retained D: execution root and matching probe. The original D: runtime-results.json must match the retained copy byte-for-byte. The script checks actual task/debug completion, zero plaintext source TextDocument calls/events and actual synthetic SecretStorage get/store observations. It does not infer installed-VSIX lifecycle, owner presence or independent review.
- affected: summary/functional/security/comparison, each {path,sha256}, relative to this F09 directory. The summary's recorded absolute functional/security paths must resolve to those exact files. The known functional10/security17 comparison contract is checked on the current runtime, retaining the 8 BLOCKED_SCOPED and 9 LEAK_CONFIRMED residuals.
- reviews: nonempty array of final review {path,sha256} facts, plus explicit reviewDisposition: NO_OPEN_SCOPED_BLOCKERS. This disposition is attributed to the root, same lineage LOW, not inferred by an independent oracle.
- sourcePaths: explicit repository-relative production/test/doc/prior-postcommit-receipt paths to index, at most 96. Include FEATURE-QUEUE.json, ledger.md and both canonical/Lite manifests; include all final scoped source changes and any older postcommit receipts that need this commit. Runtime source inputs are independently rechecked against the inspected build receipt.

Create all final deferred commit scripts and final review notes BEFORE running acceptance, so their hashes enter the immutable index. Do not create/modify them after index freeze and reuse that index. The script additionally walks only eligible F09 raw evidence extensions, excluding profiles, compiled runtimes, extracted artifacts and host bundles. It computes a changed-path allowlist within the explicit source paths plus F09 evidence. It does not stage, commit or publish.

Only after all assertions pass does it write new external-copy/acceptance/index/allowlist evidence and append a scoped ledger receipt. Acceptance remains pending the serial commit/byte-verification barrier. Original failed attempts remain retained.

## Deferred source and transition verification

verify-and-advance.cjs takes explicit positional sourceCommit40, expectedArtifactSha256 and sourceCommitLogRelativeName. After root has made the exact scoped source/evidence commit, it verifies HEAD/parent, index byte counts and SHA-256 against committed and working-tree bytes, exact changed-path allowlist, current artifact/current source inputs and empty staged index. It stages/commits nothing. Only after these checks does it write a new source-byte receipt, update the operational queue/ledger from F09 to F10 and prepare a scoped transition index/allowlist. The transition remains a separate required commit/verification gate.

verify-transition-01.cjs takes transitionCommit40, sourceCommit40 and expectedArtifactSha256. After root has made that exact scoped transition commit, it verifies committed/current transition bytes, exact changed paths and artifact hash, then writes a NEW transition-byte receipt. No Git mutation occurs.

No numerical rating, catalog44 promotion, independent AI-tool/platform proof, source debugger, arbitrary shell interception or application confinement is represented by any scaffold.

## Frozen script identities at preparation

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| run-release-01.ps1 | 4427 | e6f0a0ce70de19bcfa5cd863ea8d96794eb43054078e66eb24f6be5f307ada34 |
| f09-evidence-lib.cjs | 3426 | 790e8af2508178a8624a9e96d64427de0dbac9df6e7fdb0df83b53fd8da6b787 |
| prepare-acceptance-01.cjs | 11116 | d0f124bed40d1f596c55c19b262d38829c9a9ce2f8e53cb4c697bf16d7257684 |
| verify-and-advance.cjs | 6019 | 86074ae27683cefc5e0be3764d90c17a4cba57e1cbe25b58c96b0a02698d978a |
| verify-transition-01.cjs | 2467 | 76ca32699e9cb888ba09bcf572abd5d3cad4914d37b5aa5373c374273e5d1f47 |