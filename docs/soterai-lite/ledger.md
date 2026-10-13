# SoterAI Lite ledger

Read this file FIRST after any context compaction or on resumption. Do not overwrite evidence or repeat finished work. User request identity is recorded in `evidence/20261013-l0-disk-gate-51f892d0/request-identity.json`.

## Current state

- **L0 ACTIVE: the user explicitly waived the 20 GB threshold on 13 October 2026; continue P01-P03, then serial features.** Historical disk measurements remain FAIL and are preserved; the threshold no longer blocks this authorized run.
- L1-L7: **NOT-RUN**. Do not describe preflight as reaching L6.
- No extension behavior, workspace protection, vendor configuration, or normal VS Code profile has changed.
- New Lite VSIX: **NOT-BUILT**. Coverage, requirement ratings, hostile sub-score, old score, and prior reported results: **UNVERIFIED / NOT-RUN**, as applicable.
- Baseline HEAD: `8ef3aeb54f4019f4ee815a844443995176a656f0`; starting branch: `security-hardening`. Inspected prior source modifications were checkpointed at `915a5300a7745e4ffaeab80b5d08d3305e3772f9`; unknown scratch/raw artifacts remain untouched.
- P01 required scoped checks passed, with the supplemental full blob checksum check still running. P02 reversible packaging is active; no behavior card has started.

## STEP RECEIPT L0.1 — preflight stop

Result: **FAIL** (disk gate); **INCOMPLETE** (L0 overall).

Exact executed gate command:

```powershell
& '.\docs\soterai-lite\evidence\20261013-l0-disk-gate-51f892d0\preflight.ps1'
```

The exact read-only commands for disk measurement, Git status, branch, HEAD and request hashing are in that script. Raw measurement and Git outputs are saved beside it. The exec tool reported exit code `1`; the script requested `20`. Both are recorded explicitly in `execution-result.json`.

Saved measurement: **3,051,290,624 bytes available on C:** at `2026-10-13T04:19:12.0779265Z`, using `System.IO.DriveInfo.AvailableFreeSpace`. This is **3.051290624 GB / 2.84173583984375 GiB**, below both 20 GB and 20 GiB. Earlier direct measurement: 3,091,800,064 bytes; also FAIL. Initial null `Get-PSDrive.Free` was not treated as zero. CIM corroboration was INCOMPLETE with exact message `Get-CimInstance : Access denied`; see `initial-observations.txt`.

The request says "check free disk (>= 20 GB else STOP)". This specific gate overrides continued stage work. No disk cleanup, process termination, download, login, publication, backup bundle, fsck, catalog freeze, split, build, suite, host test or installation was performed.

Files changed and computed SHA-256 (paths relative to this directory):

| File | SHA-256 |
| --- | --- |
| `evidence/20261013-l0-disk-gate-51f892d0/disk-measurement.json` | `F7671CC5974FD259559333ED97B98E6E8B15157E086E37BB2408982E7E984123` |
| `evidence/20261013-l0-disk-gate-51f892d0/execution-result.json` | `62426054221BD145ACDE4120962CE83F8D073121A77C88A0D437EACFB56C7623` |
| `evidence/20261013-l0-disk-gate-51f892d0/git-branch-before.txt` | `8DF13568F5FBD22AC0AEA86D7883CB03A3747EA614DE8226144C5BBC145BF9A0` |
| `evidence/20261013-l0-disk-gate-51f892d0/git-head-before.txt` | `99188ED9196A8FA235B4CE86C10DEFFC27B2C3715F3E2F6AAF3FFE90DA1440F1` |
| `evidence/20261013-l0-disk-gate-51f892d0/git-status-before.txt` | `8FAB22024A0FAC804C38722BFEFF22F04F95C3C38ACC9F509D683D175798F7C5` |
| `evidence/20261013-l0-disk-gate-51f892d0/initial-observations.txt` | `3E91D26B42A056FEE5B9A5A2AF3D66E3E563E347E6A58393CF97ED3D29114100` |
| `evidence/20261013-l0-disk-gate-51f892d0/offline-hooks/.keep` | `44F4DD67009324A9FD4FAED0040A49CD696429EC8C7AD062BA6BDE15178A61F9` |
| `evidence/20261013-l0-disk-gate-51f892d0/preflight.ps1` | `87F3E7602B66AE6E5E0C2D0CC9909D42B84D105D04C852A4B8F4667AB4392CA9` |
| `evidence/20261013-l0-disk-gate-51f892d0/request-identity.json` | `341A4EB78E684F942665661F0948929D808DC8A2447211644BEB74D5032D71FD` |
| `PREFLIGHT-STOP.md` | `B91E6E35CEB0F72ECC2BC8E7968766D3C6660513CD47AEACAFF6753BF7AF7976` |

The ledger's own computed hash is in `evidence-index.json`, avoiding a self-referential hash. Any later receipt must get a new evidence index; do not overwrite the current one.

Adversarial review: a same-lineage sub-agent checked only the stop decision and unit conversion. Independence **LOW**; this does not count as product review.

What remains unprotected: the existing product configuration is unverified in this task; no new mitigation is installed. The same-user hostile-process model remains outside the intended Lite scope. Cooperative-tool coverage is unmeasured, not assumed.

Next: stop. User frees C: space to at least 20 GiB, then sends the exact resume text in `PREFLIGHT-STOP.md`. Recheck disk with new unique evidence paths before further L0 work. The remaining preflight, catalog freeze and stages have not been completed and must still run.

## Evidence-only Git operation

Planned exact commands, recorded here before execution:

```powershell
git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks switch -c soterai-lite
git add -- docs/soterai-lite
git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m "docs(soterai-lite): record failed L0 disk gate and stop"
```

Per-command `core.hooksPath` avoids invoking the existing external Qoder post-commit tracker or LFS checkout hooks. It does not change persistent Git configuration or product protection. Only task evidence may be staged. Verify no unrelated file is staged before committing. Store each command's actual output in a new evidence file, and verify the commit afterwards.

Branch creation is now **PASS**: `git branch --show-current` returned `soterai-lite`. Branch command exit code was `0`; PowerShell represented Git's informational stderr as `NativeCommandError`, which does not indicate a failed switch. Raw output: `evidence/20261013-l0-disk-gate-51f892d0/branch-result.txt`, SHA-256 `E2FEEF21395C0A5B5651E6E5BEC4AEFCD9F84E23EF42FA083E58F125E0F8A2F9`.

The initial `evidence-index.json` snapshot was verified: **11 entries checked, 0 hash mismatches**, before this append. Preserve that index as a historical snapshot; `evidence-index-20261013-l0-stop.json` records the final appended ledger and all pre-commit files. Actual staging uses `git -c core.autocrlf=false add -- docs/soterai-lite` to preserve evidence bytes. This per-command option leaves persistent Git configuration unchanged. The exact final mutation commands are in `evidence/20261013-l0-disk-gate-51f892d0/commit-evidence.ps1`; raw commit output and post-commit identity will be written to new files after the commit and are deliberately outside that commit.

## STEP RECEIPT REVIEW-01 — requested requirements assessment

The user explicitly requested checking which of their five demands are implemented and what remains. This authorizes a read-only source/evidence assessment while the earlier implementation disk gate remains failed; it does not waive that gate or start L1. The first evidence commit was verified as `3ce43885f0d1dc996e786817f1bf4b8404b278f6`: 14 SHA-256 entries and 15 committed byte objects matched; 0 unrelated committed files; 0 differences in existing project status. Its post-commit outputs remain outside that commit.

Exact inspection command:

```powershell
& '.\docs\soterai-lite\evidence\20261013-requirements-audit-a816bcf9\audit-evidence.ps1'
```

The script records exact commands for metadata-only recounts, in-memory ZIP inspection without extraction, artifact/source hashing and the disk measurement. Raw output file: `evidence/20261013-requirements-audit-a816bcf9/audit-raw-metadata.json`. Tool exit: `0`. Last audit disk measurement: **1,913,761,792 available bytes**; gate **FAIL**. No real secret files, credentials or live AI sessions were used; no build, suite, install, upload or publication ran.

Result labels: requirements **PARTIAL / INCOMPLETE**; source assessment **STATIC-ONLY**; retained evidence integrity/recount **PASS**; fresh product execution **NOT-RUN**; new Lite artifact **NOT-BUILT**; Lite Coverage Score **UNMEASURED**. Retained 2026-10-12 records: 793 tests/106 suites, 0 failing TAP records, 3 skips (790 passes); functional 10 PASS; SecurityReview 8 scoped blocks/9 leaks; 17 comparison rows/0 mismatches; all 16 candidate archive entries match inventory. Visual 30/0 is aggregate metadata, not a recount of individual assertions. Independence **LOW** (same-lineage adversarial reviewers only).

Files changed and computed SHA-256:

| File | SHA-256 |
| --- | --- |
| `REQUIREMENTS-AUDIT-20261013.md` | `1F41B8F934AC2ABD1B8E73946A537D9B924C15194DDBDDC02B846952DBFB6D1A` |
| `evidence/20261013-requirements-audit-a816bcf9/audit-evidence.ps1` | `91CA655AB6075DD480D132E891B4B635639033ABC292A32DD06F48DEAD36CB4F` |
| `evidence/20261013-requirements-audit-a816bcf9/audit-raw-metadata.json` | `E3D415970EDDF691B70EF79DC7D11FA45039160C875EA45BFD82FF3705E22E5C` |

The appended ledger and review-commit script hashes are computed in the new immutable review evidence index. Existing indexes remain historical snapshots and are not overwritten.

Artifact gap: current extension SHA-256 is `d8abff1a7ac48809420bb4f2862b8d9700ccc85c9b5cd97152608be85556b032`; tested dated candidate SHA-256 is `7b590560325aa46c3519cbf6bf0300c7bf7783d910cbae7d89e4636010e61c2c`. The normal local `soterai-ide-guard-0.6.3.vsix` has SHA-256 `dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677` and an older extension/runtime/manifest, with no project-privacy verification JSON. Do not attribute current candidate tests to that artifact or a Marketplace download. Current source does create a broker control token; do not repeat an unqualified claim that it is absent.

What remains unprotected: native AI/direct original-file reads, normal shells, original buffers, alias/copy/history paths, inherited environment/output and independent uploads. The managed approval-and-masking route is implemented; universal mediation is not. The report details source-only persistence-status and partial-value-preview findings that require flagged regression fixes later.

Next: return the requested simple assessment; implementation remains stopped at L0 until the user supplies sufficient C: disk space. Resume by reading this ledger and retrying the disk gate with a new evidence directory. No required original build stage is marked finished by this review. Exact local review-commit commands and their result are recorded in `evidence/20261013-requirements-audit-a816bcf9/commit-review.ps1` and its new output. Commit only the review allowlist; preserve all pre-existing project changes and prior evidence.

## STEP RECEIPT PLAN-01 — serial feature implementation plan

Latest user direction: plan every remaining feature first; production work must implement and test **one feature completely before the next**, and final rating must wait until all required work is completed. This supersedes any execution suggestion to implement several upgrades together. Planning is complete; **implementation concurrency is 1**, active feature is null and numerical rating is **PENDING**.

Saved `IMPLEMENTATION-PLAN.md` and `FEATURE-QUEUE.json`: 4 prerequisite cards, 32 behavior/release cards, 19 explicit subcards and 5 final verification/handoff gates. Original U1-U10/L2-L7 requirements are mapped. The proposed 44 checks exceed the original 42 category minima; the actual LITE-CATALOG remains NOT-FROZEN until P03 after L0 prerequisites. Do not treat planned cards or proposed flags as implemented controls.

First product behavior card after P00-P03 is **F01 reliable restriction persistence/reporting**. Do not acknowledge saved protection if policy persistence failed. Each next card requires focused checks, affected real host/exact package identity, error/cancel/mutation/safe rollback evidence and a scoped local commit. Actual tool tests must execute the tool's declared route; required auth blocks that card for human action rather than moving it silently to L6. Optional unavailable shells/tools are recorded before frozen applicability, remain NOT_TESTED/NOT COVERED and are never counted DONE.

Exact plan-integrity command:

```powershell
& '.\docs\soterai-lite\evidence\20261013-serial-plan-780b451e\check-plan.ps1'
```

Raw output: `evidence/20261013-serial-plan-780b451e/planning-integrity.json`; tool exit `0`. Result **PASS** for planning-document/queue integrity only; plan scope **STATIC-ONLY**. 32 feature rows/IDs match; all U1-U10/L2-L7 trace tokens present; matcher F07 precedes redactor F08, which precedes vault app runtime F09; 31 prior source/evidence SHA-256 entries unchanged. Fresh product implementation/tests **NOT-RUN**, new Lite VSIX **NOT-BUILT**, final rating **PENDING**, independence **LOW**.

Plan-start C: free bytes: 1,896,992,768. Latest saved planning measurement: **1,800,519,680 available bytes**. Disk gate **FAIL**; original L0 remains **INCOMPLETE**. Planning does not waive the user's >=20 GB else STOP condition. No product build/test, real credential inspection, OS/profile change, download, push or publish occurred.

Adversarial plan review is recorded in `plan-review.md`. Necessary corrections were incorporated: runtime after output redaction; actual adapter test/auth gate before DONE; terminal refusal scoped to the cooperative checked-command dispatcher; exact L6 report/resume identity payload; full publishing runbook contents; <120-second default onboarding; end-of-run artifact hash recheck. This is same-lineage planning review, not independent product verification.

Retained failed draft edit: `plan-edit-attempt-01.json`, **INCOMPLETE**, exact message `apply_patch verification failed: Failed to find expected lines in C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\IMPLEMENTATION-PLAN.md: Feature task states: PLANNED, ACTIVE, VERIFYING, DONE.` The edit matched only a partial paragraph; no files changed. The retry matched the complete actual paragraph. No safety refusal occurred.

Files changed and computed SHA-256:

| File | SHA-256 |
| --- | --- |
| `IMPLEMENTATION-PLAN.md` | `5C81A3D9100672CA3DE89382C0696DBBE1A20B3B423EB53A33F7ADD3672CD7BE` |
| `FEATURE-QUEUE.json` | `5189FDAD08F296617D18D2395C0A1585CFACB93EFAB38798C8A40E60D48ADF30` |
| `evidence/20261013-serial-plan-780b451e/check-plan.ps1` | `FA0ADCC762FB65EEE87B50628C74864F95A7A4878B704596906A834C2E98D482` |
| `evidence/20261013-serial-plan-780b451e/planning-integrity.json` | `2DAFF0D8A20431E07468D5F3A01AF42FC14719B9F59F061361A8E6A7E14E0727` |
| `evidence/20261013-serial-plan-780b451e/plan-review.md` | `3F68D6FC758267FFCAFAEA41F4C98B10F6198575B9EEBE48F325C75C9569BE0F` |
| `evidence/20261013-serial-plan-780b451e/plan-edit-attempt-01.json` | `546A96907F29DF1B8FB54D27AE78B0E169EB23D7D255DB26EE7DC4490CC379DE` |

The appended ledger and plan-commit script are hashed in the new immutable plan evidence index; old evidence/indexes remain historical snapshots. Exact scoped Git mutation commands are in `evidence/20261013-serial-plan-780b451e/commit-plan.ps1`, with a unique post-commit output outside the commit.

What remains unprotected: all existing audit gaps remain; writing this plan changes no mitigation. The plan keeps arbitrary same-user/native read/egress and original buffer limits visible, and never calls a shell profile or masked custom editor a universal security boundary.

Next: after user frees C: to at least 20 GiB, reread this ledger and the plan, complete P00-P03 with fresh receipts, then F01 and every later required card one at a time. Do not issue an interim rating. At original L6, write HUMAN-ACTIONS and stop; resume L7 only from the supplied exact-object independent/human evidence. A mandatory feature's unresolved failure stops the serial queue at that feature, not a silent scope downgrade.

## STEP RECEIPT P00-USER-WAIVER — continuation authorized

Latest user message, preserved verbatim: **"20 gb free nhi hai isko skip kro abhi ke liya, or dusre continue kro"**. This explicitly waives only the 20 GB minimum-space gate for this run. Continue already authorized work in the saved serial order; no renewed space confirmation is required. Maintain every other permission, synthetic-only/network, evidence, one-feature-at-a-time and no-interim-rating restriction.

Current read-only measurement: **3,437,543,424 bytes available on C:**. This is not a 20 GB PASS. Gate disposition is **WAIVED BY USER**, historical measurement result **FAIL**, execution gate **OPEN**. Actual disk/I/O failures remain first-class results; do not delete files/evidence or introduce a replacement arbitrary free-space threshold.

The plan commit `aeb30c3844631a5afc9d15218ee8513b8e5e584f` was verified with 8 indexed file hashes, 9 committed byte objects, 0 unexpected committed paths and 0 differences in pre-existing project status. The existing dated candidate still hashes `7b590560325aa46c3519cbf6bf0300c7bf7783d910cbae7d89e4636010e61c2c`; it is not the new Lite artifact.

Read ledger FIRST, then plan. Start P01 source checkpoint/fsck/backup/inputs, P02 split, P03 frozen catalog/baseline; only then F01. No production feature is concurrently implemented. Test design and adversarial review are delegated at LOW independence. Retain the existing separate local broker/control token and advisory MCP functionality in Lite; names alone do not make them Full code.

New evidence directory: `evidence/20261013-l0-resume-88fb9432/`. Commands, outputs, changed-file hashes and stage receipts will be appended there in immutable per-attempt files. Existing reports/indexes remain historical snapshots.

## STEP RECEIPT P01 — source checkpoint and scoped preflight

Required preflight result: **PASS (scoped Git connectivity)**; disk **WAIVED BY USER**. Supplemental full blob checksum check: **INCOMPLETE / RUNNING**, not a checksum PASS. Exact master requirement says git fsck; it does not prescribe --full. This distinction was reviewed at LOW independence before reversible packaging continued. No behavior feature is marked complete.

Exact commands: checkpoint script evidence/20261013-l0-resume-88fb9432/checkpoint-source.ps1 (89 explicit inspected paths, checkpoint 915a5300a7745e4ffaeab80b5d08d3305e3772f9); npm --prefix packages/vscode-extension run typecheck (exit 0); git fsck --connectivity-only --no-reflogs --no-progress (exit 0, 149 raw output lines); git fsck --full --no-reflogs --no-progress (active session 59539; no final output yet); git bundle verify C:\Users\USER\soterai-backups\security-hardening.bundle (exit 0); git merge-base --is-ancestor e795827fba9b0bbd8d389bd92492cb38528cc54d HEAD (exit 0); git -c pack.threads=1 -c pack.windowMemory=32m bundle create C:\Users\USER\soterai-backups\soterai-lite-20261013-88fb9432.bundle --all ^e795827fba9b0bbd8d389bd92492cb38528cc54d (exit 0); git bundle verify that incremental bundle (exit 0).

Backup is a **pair**, not a standalone new bundle: base 1,632,545,875 bytes / cc2974fe3dcda234cb9a238e514b933758859c75ee534ae313ccd768032857c9; increment 782,533,513 bytes / 0187a0f025a1f80074c3d46c7a7b04f5ecb88d6b3f25695227103737512cb6eb. Hashes were freshly computed; header/prerequisite verification passed. Full pack reimport was NOT-RUN. Ignored secrets/caches/untracked evidence are not in the bundle and remain untouched.

Raw-output files and SHA-256:

- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/backup-pair.json: 4e3a3e78fb28c93fe4be4fe3fe7d701548389b5d46b8677c2959eb72a0875ff0
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/baseline-typecheck-01.txt: 421d4ac64e6579bddc28b2758b2ebbaea0bd98aa267aa7e896f2404ae7c7f70b
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/checkpoint-commit-01.txt: c81e299321b057ff6af10854b0f0ce38e0080ca7027e42689c985fd3b7ebaf5d
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/existing-backup-identity.json: 9f09ff238d66223fa54b18ccc15743cfd1233678c262aec63573911c70c10174
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/existing-backup-refs.txt: d88c4ef22ffbb1cfbb3cc06febfb4be3a2b1ee10f818e19b11ef81aa16156f9b
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/existing-backup-verify-01.txt: 2a655d3d5e81c5aeaa412a85a3a4f6a333f602f425f6f64c93dc06d32bc89e54
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/git-connectivity-01.txt: 2b7b4c543b5b133cc2617e5d316b2a3d48f7019b8c086ac51559e2bac237b720
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/incremental-backup-create-01.txt: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/incremental-backup-verify-01.txt: bfb49e7b69fa74a8d34d3f86878e6fde75d7086802376288393e8438ba0c916a

Changed source checkpoint hashes are in checkpoint-files.json. inputs.json records loopback-only tests, no downloads or external payload destinations. The stage index hashes this appended ledger and the current queue.

What remains unprotected: existing native/direct read, alias, inherited env, original buffer and independent egress gaps remain. Preflight changes no privacy boundary. Next: P02 compatible split/build/package inspection, then P03 exact new-object baseline and frozen catalog, then F01 alone. Full fsck is retained and will get a separate receipt when it exits.

P01 receipt-write attempt 01 was INCOMPLETE: Node JSON.parse rejected the PowerShell UTF-8 BOM in FEATURE-QUEUE.json. The ledger append had completed; queue/index had not. finish-p01.cjs strips the BOM and finishes only pending bookkeeping, without duplicating the receipt or rerunning checks. Early P02 build attempt 01 was INCOMPLETE with exact error `Error: spawn EPERM`; no raw log was written because the wrapper stopped on native stderr. The corrected wrapper captures native stderr; authorized escalated retry 02 passed and retained a separate immutable build directory. Two non-product inspection/edit failures are retained: path read `packages/vscode-extension/src/project-privacy/pathContainment.ts` did not exist (actual security/pathContainment.ts was read); PowerShell stripped node -e quote characters (SyntaxError); a partial-line patch failed to match record-p01.cjs and changed no file. These are not product PASS results.

## STEP RECEIPT P02 — compatible Lite/Full split

Result **PASS** for split/build/typecheck/unit/content inspection. New Lite VSIX: packages/soterai-lite/soterai-lite-0.7.0-p02-20261013.vsix, **1323847 bytes**, SHA-256 **cf163471b7a022d5a9f922a3f1fcc6bfd3b56a08ab14f1aebfdfb345c337bae1**, 14 entries / three runtime bundles; extension runtime **734b762b002b364af099e79b1bc206ce0ca87c20d3a93de3b93f0cd39cd5b506**. All runtime input graphs are recorded; zero controller/VM independent capability/tier2/test/fixture/evidence inputs. No historical verification JSON ships. VSCE's printed README/CHANGELOG sizes were inconsistent with archive bytes; actual ZIP counts/hashes, not printed estimates, determine this result.

Exact commands: node packages/soterai-lite/scripts/prepare-split.cjs; npm --prefix packages/core run typecheck; npm --prefix packages/soterai-lite run typecheck; node packages/soterai-lite/scripts/package.cjs soterai-lite-0.7.0-p02-20261013.vsix; powershell inspect-vsix.ps1; npm --prefix packages/soterai-lite test. Exact argv/time/exit/output-hash records are the matching *.txt.result.json files. Typechecks/package/unit exit0. Unit recount: 793tests/106suites, 790PASS/0FAIL/3SKIP. Those3 skips are not promoted to PASS.

Retained failures: initial child spawn EPERM; CLI package attempt01 FAIL unknown option --no-prepublish (corrected by immutable programmatic staging); package02 and test01 INCOMPLETE disk-full with no raw log; test02 FAIL61 files spawn EPERM/0 executed test passes. Authorized escalated test03 passed. Actual C: zero-byte write blockage was distinct from the waived20GB minimum. User authorized the new incremental backup's verified relocation to **D:\SoterAI-backups\soterai-lite-20261013-88fb9432.bundle**; original base stays C:. Old backup-pair.json remains historical; backup-relocation-01.json supersedes only the increment location.

Compatible canonical source remains packages/vscode-extension/src; new package entrypoints reuse it, host-free containment moved to packages/core with compatibility export. New core name @soterai/local-core avoids existing SDK @soterai/core collision. Lite preserves publisher/name/storage IDs; Full is dependency scaffold only. Root publication scripts now refuse local-candidate publication; historical release workflows remain unexecuted and require F31 updates. Core is private TypeScript source for bundlers, not a standalone plain-Node package.

Adversarial review LOW found partial-write/mixed-bundle risk; staged JSON writes, complete receipt hash binding and immutable packaging resolved it. Every failed build attempt is preserved. Packaging rollback keeps last proven artifact and saved denies; it restores no original secrets or weaker read route.

Changed file hashes are in p02-evidence-index.json (explicit source/raw allowlist; existing unknown artifacts excluded). What remains unprotected: native same-user reads/alias/env/buffers/history/independent uploads, untested actual-tool routes and human UX gaps. No coverage rating or feature is DONE by this packaging. Next P03: actual host baseline on the extracted new object,17-case comparison, pinned applicability, catalog/hash commit, then F01 test-first alone. Supplemental full fsck remains RUNNING/INCOMPLETE; connectivity result remains scoped.

## STEP RECEIPT P03 — exact-object baseline and catalog freeze

Result **PASS** for baseline execution/comparison/freeze, **UNVERIFIED** for all44 catalog checks/264 candidate-tool cells. Actual host1.141.0 / OS26300.8935, extension0.7.0 loaded SHA734b762b002b364af099e79b1bc206ce0ca87c20d3a93de3b93f0cd39cd5b506, VSIXcf163471b7a022d5a9f922a3f1fcc6bfd3b56a08ab14f1aebfdfb345c337bae1. Functional10PASS/0FAIL; existing17-case SecurityReview8BLOCKED_SCOPED/9LEAK_CONFIRMED;17comparisonrows/0changes. Harness success includes confirming unmanaged leaks and is not an all-surfaces privacy PASS. Prior 17-case evidence is retained and independently hashed for comparison.

Exact launch argv/time/exit/output files: p03-functional-launch-01.txt.result.json and p03-security-launch-01.txt.result.json. Both launch the existing harnesses with Code.exe in isolated scrubbed profiles, no original editor profile, no real credentials/provider traffic; -ExtensionRoot points to p02-vsix-extracted/extension. Security -UsePrebuilt -HostTestsPath avoids rebuilding/overwriting historical artifact. Host source build command node build-host-baseline.cjs succeeded. Scripted real-command modal responses do not prove independent owner presence. Raw observations:docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-functional/privacy-20261013T072914Z-0d426ab9/functional-results.json and docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-security/host-20261013T073045Z-3f95ffdd8e194667b6dba9be6f7c7335/live-host.json.

Freeze exact command: node docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/freeze-p03.cjs. Categories8/8/8/4/4/8/2/2; catalog SHA-256 **1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4**; item matrix maps U1-U10,L0-L7,F01-F32,userR1-R6. Definition/control assumptions are frozen before any upgrade. Results remain separate; no failed applicable route can become N/A to inflate coverage. Same-lineage test-design/adversarial review independence LOW.

Availability pinned: Cline4.1.23, Claude IDE2.1.296/CLI2.1.292, Codex IDEruntime0.162.0-alpha.17.2/CLI0.160.1,Gemini0.55.1 are unverified candidates, not supported PASS. Other installed native agents remain NOT COVERED. PowerShell7 absent; no authorized runtime download. Actual tool routes and hook error/timeout behavior require separate tests. Current host uses1.141, not cached1.104; prior receipts are not reassigned.

Changed files/hashes and raw-only allowlist: p03-evidence-index.json. What remains unprotected: all9 unmanaged baseline leaks, independent native processes/routes, untested third-party adapters, true human presence/usability/accessibility/platforms. Final rating PENDING. Next: commit this freeze; only after commit start F01 reliable restriction persistence, test-first, machine-scope flag soterai.lite.restrictionSave. F02 cannot start until F01 full acceptance is complete. Full supplemental fsck remains RUNNING/INCOMPLETE; do not retry or terminate it.
