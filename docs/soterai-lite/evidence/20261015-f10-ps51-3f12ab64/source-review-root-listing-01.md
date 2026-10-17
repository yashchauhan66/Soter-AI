# F10 workspace-root listing correction review

Reviewer `/root/git_design`, same-lineage independence LOW, 17 October 2026. Read ledger tail first, then the exact baseline, frozen contract/test and current session source. This is a completed STATIC-ONLY source review plus inspection/hash verification of existing root-run receipts. No production/test edit, test/native process execution or escalation was performed. This new note is the sole write in this review pass.

Result: **no scoped blocker identified in the F10-only root metadata policy target correction**. The file-oriented boundary helper rejects an empty relative path; this previously withheld normal root listing. The correction does not change BoundarySnapshot, its policy parsing/glob semantics, the private reader or any other completed feature.

The actual directory is still derived from the parsed relative command and validated by managedPathIdentity before the policy await. Only when path.relative(root, actualDirectory) is empty does policy classification use the fixed in-root `__soterai_root_directory_metadata__` URI. That URI is passed to the same loaded snapshot's blocks/isSensitive/classify checks; no filesystem read/create/list/execute is applied to it. Child directories use their actual policy target. The original directory identity remains in the retained guard, and the original PUBLIC operation/args still go to the finite worker; the policy URI is not substituted into the command or input protocol.

Workspace/locality/root and policy drift checks, complete private output filtering and the completed-only canRelease check remain on the final managed result. Whole-project glob and folder-root denies, plus invalid policy, continue to withhold before filter/worker admission. The tests concern directory names only and do not grant child contents or certify filtering of every possible name/fragment. A rule covering the fixed metadata target may conservatively withhold root listing.

Observed baseline `root-listing-before-01.txt`: **five tests, four PASS/one FAIL**, exit1. RL01 normal root is the sole failure (WITHHELD versus expected COMPLETE); RL02 normal child, RL03 glob ** deny, RL04 folder . deny and RL05 corrupt storage all pass. Fresh raw SHA256 `21b260fc0da5cfdbb831356af206587356569c53babf76986bd8a934bcc064c1` matches its result receipt. This is an availability/dispatch regression result, not a secret-leak claim.

Observed `root-listing-after-01.txt`: **44 tests, 44 PASS, zero FAIL/cancel/SKIP**, exit0 at `2026-10-17T02:32:57.0397917Z`. Fresh raw SHA256 `b2913dd215480c69e5099bf58680d7a63eeea3a2aa0283484dcba107506baf82` matches its result receipt. Its exact argv includes root-listing, session, publication review, ownership and COPY review fixtures. All five RL controls and both retained PR publication controls are explicitly ok. The actual TAP total is 44; no total is inferred by adding older card counts.

| Bound current source / frozen inputs | SHA256 |
| --- | --- |
| `packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts` | `81f5e1c43056649d99446893a5d0ef7826e59796ce58c89046d54d22b745d396` |
| `packages/vscode-extension/src/__tests__/checkedPowerShellRootListing.test.ts` | `351b2780b012367c836bc30cf0c954435dbe9d5ffd852e7bc2668238bc8435d1` |
| `docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/root-listing-contract-01.md` | `add31513d0cb089f00d29e09c434372c214f76483bf4e93851c57be68e8899c8` |

Earlier session reviews and packaged/native attempts remain historical at their recorded source/runtime hashes. New final full-suite/compiler/exact package/native H05/affected-host/ledger/commit/byte verification remain root acceptance gates, not certified by this narrow review. This is same-lineage evidence, not independent/human review, hostile filesystem locking, arbitrary shell interception, external-tool coverage, catalog promotion or a rating.
