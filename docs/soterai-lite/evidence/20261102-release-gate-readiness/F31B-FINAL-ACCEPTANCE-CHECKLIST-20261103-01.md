# F31b final acceptance verifier proposal — after source03 commit

Preparation only,3November2026. This is an exact gate checklist for the existing F31b contract, not a replacement plan, executed verifier or DONE receipt. Root's source03 commit was active when this was authored. Do not execute a commit/helper again to check it. This authoring performs no Git, network, native launch, product/ledger/P mutation or queue transition.

Let **P** be `docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304/`. A root-reviewed verifier should create a new detached result only after the following checks, using the existing bounded readers and raw-Git verification pattern. Reject missing evidence, unknown shapes/counts, changed bytes or failed assertions. Do not print source contents or credentials.

## Exact evidence pins

| P-relative input | Bytes | SHA256 |
| --- | ---: | --- |
| `scoped-f31b-source-checkpoint-03-manifest.json` |537779|`13ee2c7dc36a3cc0baa2f39f2f91adca7c5d59f0a3e700d25baf5b8745935cc4`|
| `full-inputs-04.json` |223544|`221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99`|
| `full-suite-acceptance-04.json` |40919|`24726fdaab8099259ea2005d2d88bafce50f8c7bc581f9120cb9ff6c998b56a3`|
| `backend-byte-reuse-01.json` |99767|`b3121ea5c36e722c42bdd3c3b439e4d0c2f9ab14e8a110555b6044212505929c`|
| `content-inspection-02.json` |7165|`bf93f31670e979414c464be5caea8ad48bc58cc200c4b477af60b52d69cd4b0d`|
| `affected-acceptance-01.json` |27923|`b366fafa3c409bdc55b53cb83d6c5ca9b87a0fe1972cd9c392ba807a6b8f804a`|
| `vendor-drift-observation-01.json` |964|`21dc2a26c33f825a807cbb492477785ee394511be28957b111c257032ca278dd`|
| `advisory-detail-result-review-01.json` |269561|`2d0a41c4986c149ec10cdc194de93d266f005af20ce101c40c43255a219ec6d2`|

Candidate `packages/soterai-lite/soterai-lite-0.7.0-f31b-20261102-attempt03.vsix`:1735938bytes/SHA256`6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c`. Frontend SHA256`7a330ee572fc3792da3ef179f95e875ab69fed6871edc9ae10617338e7fcb7d2`. These are the tested object, not a future rebuild.

External claims candidate, outside P: `docs/soterai-lite/evidence/20261102-release-gate-readiness/F31B-README-CLAIMS-CANDIDATE-02.txt`,5325bytes/SHA256`7e551aedd3a87358634ca3ffe1ee1a6591bb22a8344c47e95b046cc7180a6adf`. This exact reviewed full-document candidate supersedes the earlier proposed one-row-only refresh. No other documentation drift is allowed.

## Source03 and current bytes

1. Wait for root's actual commit process to close. Require `P/scoped-f31b-source-checkpoint-03-byte-proof.json` status `PASS_EXACT_LOCAL_F31B_SOURCE18_CHECKPOINT_BYTES_FEATURE_INCOMPLETE`, `fileCount:832`, `sourceCount:18`, zero mismatches/unexpected paths and empty index. Record the actual proof file's byte length/hash; none is guessed here. Root observed HEAD`730b01d95ee89b62c58ef0a5ace3991b549107e3` while per-blob verification was still active: HEAD/index0 alone is **not** a byte PASS. Bind that expected commit only if the actual completed proof agrees. Its immutable `featureComplete:false`/`nextFeatureSelected:false` are correct for the source checkpoint and must not be rewritten to manufacture feature completion.
2. Through the existing read-only, hooks/fsmonitor/GC-disabled Git invocation, check current HEAD equals that proof's commit, its parent is `0affcdd0a46ff0e5d6921b69356303b7dd6d22b4`, branch is `soterai-lite-f22h-resume-20261023`, and raw changed-path set equals all832 declared paths. Read every declared blob with `cat-file`; match bytes/SHA256/raw blob OID/mode. Pin `feature-source-scope01.json` SHA256`7fcf4bd4332f0bb489194bd50c7ac0c6b417b112b136d12f4bbc96eee7ce142f`; all18 source paths must be present. Do not use filtered checkout bytes as a substitute for raw Git blobs.
3. Recheck the1098 frozen rows and all immutable artifact/build/test/evidence inputs. The only possible exception is the exact external claims candidate refresh below. Preserve unrelated dirty changes and the three retained F26a source files excluded from this commit. The artifact includes those retained inputs; scoped HEAD alone is not a whole-artifact reproduction claim.

## Exact candidate external claims refresh

Only `docs/soterai-lite/README-CLAIMS.md` may receive the exact separately reviewed full-document candidate02 after source03 closes. It is outside the packaged/runtime/build/test inputs but is itself a row in proof04 and a source03 blob. Therefore a naive proof04-only matcher will correctly detect its changed bytes; **do not** skip all docs, skip all source drift or rewrite proof04.

Root must retain a new refresh receipt containing source03 commit/path, original whole-file length/SHA256 matching its raw committed blob and proof04 pin, exact candidate02 path/5325bytes/SHA256 above, new canonical whole-file length/SHA256 and authoring purpose. Require **byte equality** between current `docs/soterai-lite/README-CLAIMS.md` and that fixed candidate; semantic similarity or an arbitrary new document is insufficient. Candidate changes require a new explicit reviewed pin, never a broad exemption.

Require root's new proof05 to contain exactly1098rows and a mechanically computed difference from proof04 of **only that one exact path**. Its replacement row must match candidate02's whole-file bytes/hash, while every other1097row—including all runtime/build/test/packaged assets—remains identical. Preserve source03 proof04/current native/content evidence as historical results for the original frozen graph. A separate requalification receipt can bind proof05's one external-document-only delta to the unchanged graph and exact existing execution evidence. It must explicitly say **REQUALIFIED_BY_UNCHANGED_EXECUTED_INPUTS**, never call the old full4783/backend/native results an actual rerun. Pin proof05/requalification/refresh receipt and candidate02 in detached final acceptance and the later transition commit.

## Existing execution, artifact and withdrawal evidence

4. Full acceptance04 must bind proof04, exactly350 unique current TS test files and4783tests:4779PASS/0FAIL/0cancel/4declared privileged-symlink SKIP. Verify eight actual shard TAP totals and each raw stdout/stderr hash against owned-close records: actualclose/natural0/bothEOF/no deadline/overflow/stream error/signals. Respect recorded requalification by unchanged TS/config plus fresh package/manifest controls; do not count repeated controls as extra full tests. Keep original monolithic01 closure UNCONFIRMED and repo-cwd failed06 results unchanged.
5. Check existing compiler02 actual successful close; package-components06 actual46PASS/0FAIL and manifest-components03 all41 reference files/559PASS, with raw output/closure pins. Their frozen code/config/package inputs must still agree; no rerun is implied by authoring this checklist.
6. Backend reuse01 must retain exact350 compiler/test source rows, three unchanged worker input graphs/output hashes and authentic prior closed typecheck/backend144tests=143PASS/1SKIP. This is qualified prior evidence reuse, not a fresh backend invocation.
7. Content03's actual canonical receipt and content-inspection02 must bind exact candidate6231159d,18entries/fourruntimes/88restricted machine settings, win32-x64 and actual XML pre-release property. Recheck embedded SBOM/notices/full owner-selected BUSL4493bytes/SHA256`50850df5d69907a09666f7ce40740b5bb54d1b6bbdd5c39ed9ad7b7e9f86a253`, privacy and exact asset/manifest/runtime/build-input receipts using the existing final audit API. Preserve `releaseReady:false`; actual15-entry/missing-allowlist and README-rewrite failed packages remain failures.
8. Affected acceptance01 must report four families:PS51=19/editor=25/MCP=25/retained=106,175native assertions/eightphases, plus functional10 and securitybaseline17:202assertions/10phases total. Verify every pinned original result and its declared runtime identity and actual owned helper/Code/broker/outer closure evidence; require recorded post-owner-absence01 and stable streams. Security baseline remains8blocked-scoped/9confirmed unmanaged leaks;202 assertions is not a claim of202 blocked attacks. Historical filenames containing `f26a` for reused PS51/editor helpers do not grant pre-commit original34 coverage.
9. Current declared owners have accepted withdrawal evidence; do not infer arbitrary nested vendor descendants, earlier F20 workers or interrupted historical outer sessions closed. Keep historical gaps UNCONFIRMED with their existing human follow-up. No process killing or new owner observation is requested by this proposal.

## Advisory and tested-vendor scope

10. Advisory detail review01 must say `COMPLETE_WITH_KNOWN_BUILD_FINDINGS`, actual42 records/42 active affected associations, withdrawn0/unsupported0, explicit labels17HIGH/19MODERATE/6LOW, nine positive build-tool versions/zero positive embedded-runtime versions. Verify each pinned raw query/detail/approval/consumption/transport record and the two separately consumed owner decisions;42detail GETs have actual request-close/response-close/end/complete under10s/1MiB/480s. No retries, pagination or reference visits. Preserve semantics: required audit/review completed, remediation `OPEN_NOT_AUTHORIZED_NOT_PERFORMED`, owner risk acceptance `NOT_GRANTED_OR_INFERRED`, releaseReadyfalse. No clean/vulnerability-free/harmless/waived claim. MASTER:105/plan:120 require an actual audit/review, not an invented universal zero-CVE threshold. The745 unrelated lockfile records/34absent optional entries remain outside this declared Lite scope. Fixed endpoints are observed advisory thresholds, not verified compatible installed replacements.
11. Preserve post-test Edge drift observation: testedexe SHA`18380f009aeddb87f011a01b991bc4e52925f77694f69760a5a9a57937f04cde`/5072200bytes versus observedSHA`b012c559db235678a030013af0a3627a453cc8b695b5bd609c3198d27f6dc1ef`/5073224bytes;26other public vendor rows unchanged in two observations. Accepted tests remain evidence for their recorded snapshot. **No current-Edge acceptance or future native admission follows.** Do not relaunch an outdated binding to verify a commit; preserve existing pins and named future review.

## B01–B18 evidence boundaries and named subcases

| Contract cases | Accepted evidence and conservative boundary |
| --- | --- |
| B01–B03 | Deterministic metadata/source-runtime-digest/missing+duplicate runtime and current recomputation controls. No entire-ZIP byte reproducibility or OS-atomic race proof. |
| B04–B06 | Current three bundled components have exact complete notices/metadata; unknown/missing/tampered notice and path/size controls. Repeated same-name/version at distinct nested package roots conservatively refuses: future-graph limitation. A multi-version/nested-duplicate fixture and every identity/notice-count permutation are **NOT_SEPARATELY_EXERCISED**, not silently passed. |
| B07–B09 | Final18 allowlist/missingprivacy/map/tamperedSBOM/source controls plus retained shared legacy ZIP bounds/aliases/truncation coverage. Not every malformed asset at every archive position has a separate final-mode mutation case. |
| B10–B12 | Actual XML pre-release/target/identity, strict SAX malformed roots/entities, virtual=false/limitedtrust, pre-commit exclusion and real command withdrawal controls. No Linux/macOS/remote/current-Edge acceptance. |
| B13–B15 | Exclusive output refusal, ordinary path guards, full BUSL and honest no-readiness metadata controls. Dedicated hostile linked-output-parent and synthetic environment/token sentinel-through-all-logs cases are **NOT_SEPARATELY_EXERCISED**. No real environment credential inspection or secret-free RAM guarantee is inferred. |
| B16 | Installed-vsce integration, actual production files allowlist and GitHub README relative-link preservation controls. These are local packaging tests, not Marketplace/OpenVSX publication tests. |
| B17 | Actual new attempt03 VSIX and final content/native affected evidence above. This is scoped package acceptance; installed-only upgrade/uninstall/onboarding remains F32. |
| B18 | Reviewed current asset bytes and exact pinned candidate02 detached claims refresh; current202affected results plus prior feature receipts support their declared scope. A new all-tool/version integrated route corpus, catalog44 mutation corpus, real-provider/login, human screen-reader/usability and independent exact-object review remain V01–V05/L6/L7. No unconditional protection/rating assertion. |

These named unexercised subcases prevent fabricated coverage; they do not create a replacement execution plan or invent a zero-CVE gate. Root must retain their exact scope/limitations in final acceptance.

## Permitted conclusion and remaining barrier

If all recorded checks hold, a detached verifier may report **SCOPED_F31B_PACKAGING_AUDIT_WORK_ACCEPTED_NOT_RELEASE_READY** with source03 commit/proof832/18, exact VSIX, evidence hashes, exact candidate02/proof05/document-refresh/requalification receipts, tested vendor snapshot/drift, audit findings/remediation and all limitations. No actual product/packaging failure was found under the recorded measured trusted-input checks; no hostile builder exploit/DoS or new dynamic absence proof was run.

F26a remains USER_SKIPPED/INCOMPLETE/unsupported; parentF26 is not DONE, source/evidence/recovery remain retained and no further original34 run is authorized. F31b DONE/nextF32 selection still require root's separate existing ledger/queue/status transition and its raw-byte verification; source03 alone selects no next feature. ParentF31 status follows that actual transition. F32/V01–V05/global human/readiness/publication remain pending; original L6 writes HUMAN-ACTIONS and STOP, no rating/publish/push/tag. This proposal executes none of those actions.
