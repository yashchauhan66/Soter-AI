# F26a protected source review

Read-only same-lineage review against observed HEAD `2ec232e8b28a6670c7651022833fc99710fce176`. **No new implementation blocker found in the reviewed three-file delta.** This is LOW-independence source review, not native acceptance, a human/independent review, release readiness or a rating. The approved current native09 attempt is owned by the root agent; this review neither invokes nor observes its results.

## Source scope and exact-byte mapping

The working tree has two tracked modifications and one new untracked test. The table is the complete remaining three-path source scope observed with read-only `git diff HEAD`, `git status --short`, `git ls-files --stage`, source reads and SHA256 reads. No Git write occurred.

| Workspace-relative path | HEAD state | Current bytes / SHA256 |
| --- | --- | --- |
| `packages/vscode-extension/src/history-hooks/PreCommitController.ts` | Modified; HEAD blob `a98ad318e9acb3190868b0a9b6b26b4ba876f3ac` | 27,240 / `f4c58c2e161acbf0317b85df076d5a32ef9226972e90c20f47cb0e4727efb769` |
| `packages/vscode-extension/src/__tests__/preCommitStorageUri.review.test.ts` | New/untracked; no HEAD/index blob | 8,530 / `cce9d6f366342eea22a1e3263c7d1f241bfcb871111db8c110a73479b1ce87d0` |
| `packages/vscode-extension/src/__tests__/protectionCenter.model.test.ts` | Modified; HEAD blob `148c0f5fb79c149f7b9633ccd338fbff91d95bf3` | 6,964 / `4d5b511c3f2d05b29b0a78108ef944541181ae27e03adce4899ce033bf07c3b6` |

All three current rows are identical across old F26a `full-inputs-09.json.changedSource`, current F28 `full-inputs-02.json.files`, its explicit `protectedF26a` rows, and current `native09-current-binding-01.json.facts`. Current source proof is `70d3b237332ada5f7317906a8e745ff7d8f7bc2213b8c27f810a25b919b30743`/1076 inputs. Current native09 binding is `9a6e8cac4f1ef74618565faf9c4bb5c6f71e0f36b2f7c6f755996d685d131616`.

Checkpoint `2ec232e8` is the77-path preparation/evidence checkpoint, not a commit of these three source paths. Its proof `f26a-native09-preparation-byte-proof-01.json` has SHA256 `507c3c93e9b85922b8eace9d21f6d272f010bfa97bbb0e5ed00e9fa7580bc53f`, zero mismatches/unexpected paths and empty-index receipt. The later F26a scoped source commit must include all three paths, particularly the untracked test, then verify raw Git bytes; a normal diff or old preparation commit cannot substitute. Git emitted the existing LF→CRLF normalization warning for the two tracked files, reinforcing the established raw-byte commit/verification procedure.

## Behavior review

The controller diff is confined to `#descriptor` at lines185–192. It replaces the former file-only URI test with support for exactly `file` and the desktop `vscode-userdata` mapping. It additionally rejects remote contexts, authority/query/fragment, nonabsolute or non-drive paths, and mismatched URI/fsPath round trips. This matches the retained native07 diagnostic: a non-file desktop storage URI reached real loopback listener creation but was refused before descriptor writes/backup. The older component baseline also exposed a malformed file URI accepted by the previous check; the new round-trip condition addresses that case.

The existing checks after the changed lines remain intact: storage outside the project, exact generation descriptor path, checked physical directory ancestry/identity, single-link regular descriptor, verified existing descriptor signature, actual handle/inode checks, pre/post byte/identity verification, operation validity and handle close. The constructor/root/flag/epoch/key-withdrawal logic and reviewed install/resume/restore transaction are unchanged by this delta. Admitting the desktop alias does not grant arbitrary URI schemes, remote storage, UNC/device paths or workspace-contained descriptor storage.

The new11-case regression exercises the actual production controller, crypto, transaction, descriptor filesystem and owned numeric-loopback service, with discovery/root-policy/artifact/backup/hook-file capabilities explicitly substituted. Four positive cases cover absent/present file and desktop-userdata storage; seven negative cases cover unknown scheme, authority/query/fragment, remote context, storage inside the workspace and malformed URI path. The retained before result is8PASS/3FAIL (two desktop positives refused and malformed file URI accepted); corrected focused11 and combined66 results are recorded in the original storage-fix evidence. These are component results, not native34 coverage.

The model-test diff changes one call to supply the fixture's already-fixed `2026-10-28T00:00:00Z` clock explicitly. Assertions requiring reported evidence, no live/independent claim and uncovered/NOT_TESTED labels remain unchanged. Adjacent stale/future tests remain unchanged. No production freshness behavior changes; this corrects the recorded test that became legitimately stale with wall-clock passage. Retained combined storage/model31 checks report31PASS.

## Evidence limits and remaining gates

The current full-suite text records4780 tests/4776PASS/0FAIL/0cancelled/4SKIP. Current exact artifact is `packages/soterai-lite/soterai-lite-0.7.0-f28-20261101-attempt01.vsix`,1,749,703 bytes/SHA256 `5dac9288fb259ad538ab751258f250d85a933bfb5bc8641dc32e54c01f6f047f`; its frozen1076 graph includes these exact three working-tree inputs. No full, focused, build, native or network check was executed for this review. The four named privileged-symlink skips stay skips.

No additional mandatory code fix is justified by the inspected delta. F26a nevertheless remains incomplete until the one approved current attempt produces authentic primary30/offline-owner/restart4 results with all required ownership/EOF/withdrawal evidence, affected-current evidence is explicitly reconciled to its own scope, and the scoped source plus separate DONE-transition commits pass raw-byte verification. Prior native08 primary30 and F28 native/affected results do not silently supply missing F26a outcomes. The review does not infer the live run's consumption, process liveness, exit status or coverage. Existing cooperative Windows-local scope and original L6 HUMAN-ACTIONS/STOP remain.

Review actions: ledger first; source/test/diff/hash/evidence reads only. One literal-glob `rg` lookup was rejected by Windows path syntax and was replaced with a directory plus `--glob` lookup; no state changed or result was inferred from that lookup. This new Markdown is the only file written by this review; guard/helpers/launcher/driver/proofs/native outputs/source/queue/ledger are untouched.
