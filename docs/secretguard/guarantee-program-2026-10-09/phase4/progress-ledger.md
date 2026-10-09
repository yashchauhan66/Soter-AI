# Phase 4 progress ledger

**INFERENCE — Resume rule.** Read this ledger first and do not redo finished batches. The FINAL MASTER prompt supersedes the former per-step pauses: S1 approves Phase2 copying; S2 approves local commits on security-hardening; S3 approves narrowly scoped broker ACL repair after inspection/backup; S4 approves the stated modal-only deny relaxation UX. Run checks, record raw results/hashes/limits/rollback and commit each batch, then continue autonomously. Push/publish/tag, normal profiles, firewall/drivers/accounts/VM/features and Tier3 implementation remain unapproved.

**INFERENCE — Current step.** B0 and B1 are complete as scoped hardening, with raw failures retained. A0 confidentiality remains FAIL. All thirty selected-architecture assertions remain UNTESTED. Next batch: B2 (S3 read-only inspection, ACL backup/repair, win32 validation).

**INFERENCE — Working branch.** security-hardening, created from release/n8n-0.8.7 at HEAD 973b8af6060aa967fc0ecad7d56251a2da41149a. Existing modified/untracked work was retained; no commit was created. A branch name does not isolate those existing changes from future staging, so no broad staging or reset is allowed.

## Next action and approval gates

**INFERENCE — Next action.** Continue B2 under S3; modify only the existing broker directory and token-file ACLs after backup, never parent ACLs or token values. Native host execution remains user-only.

**INFERENCE — Pending approvals.** Copy/local commits/scoped ACL repair/modal-only UX are now authorized by S1–S4. Tier3 decision and unapproved system/profile changes still require one precise question and a stop. S3 is limited to broker directory and its two token files; parents are inspection-only. Never read or print actual token values. Do not change firewall, drivers, accounts, VM/Windows features or normal profiles.

| Stage / step | Status | Next scope / evidence |
|---|---|---|
| A0 user execution and evidence capture | **INFERENCE: PASS bookkeeping; FAIL confidentiality** | User ran existing harness. Agent reviewed and archived evidence only. |
| A0 Phase 2 document copy | **INFERENCE: PASS byte-identical copy (S1)** | Five source/destination hashes verified against Phase3 source-notes; Temp originals retained. |
| B0 housekeeping | **INFERENCE: PASS command/record hygiene; confidentiality remains FAIL** | Exact Oct8 bytes recovered; unique/exclusive host output; rebuilt bundle identities and raw results archived. |
| B1 low-risk fixes | **INFERENCE: PASS scoped command/unit checks; full assertions UNTESTED** | Syntax repair compiled; Git launch hardened and Windows config behavior measured; pre-success coverage tested. |
| A1 existing baseline syntax repair | **INFERENCE: UNTESTED / not started** | Tiny source repair; no host execution; historical failure evidence retained. |
| A2 F16 safe-diff launch | **INFERENCE: STATIC-ONLY / not started** | Pin absolute Git, minimal environment, forced hooks/fsmonitor config; benign Windows global-config behavior verification; missing Git denies operation with useful message. |
| A3 Windows token ACLs and validation | **INFERENCE: INCOMPLETE / not started** | Read-only inspection first; approval gates actual permissions; win32 validation separately bounded. |
| A4 repository deny-add-only | **INFERENCE: UNTESTED / not started** | Propose user-level setting plus native modal, explicitly "not agent-proof"; await UX approval. |
| A5 honest one-click flow | **INFERENCE: UNTESTED / not started** | Covers / Does not cover before success; operational state separate from evidence. |
| A post-hardening comparison | **INFERENCE: UNTESTED / not started** | User reruns existing harness; compare with this immutable A0 archive. |
| B optional Tier-2-lite | **INFERENCE: UNTESTED implementation** | Proposal delivered in chat only. Hygiene; native processes / Windows-user WSL access outside coverage. |
| C Tier-3 feasibility | **INFERENCE: UNTESTED / not started** | No-code prerequisites/cost/UX checklist; stop for go/no-go. |
| D Tier-3 implementation | **INFERENCE: UNTESTED / not authorized** | P4-02–12 only after C approval and evidenced prerequisites; failed prerequisite is BLOCKED. |
| E independent verification handoff | **INFERENCE: UNTESTED / not started** | Builder prepares evidence and handoff; does not self-grade. |
| F final report | **INFERENCE: UNTESTED / not started** | Exact-configuration claims only; preserve tested and untested scope. |

## A0 raw result and archived evidence

**INFERENCE — User execution.** Reported run interval 2026-10-09T13:15:42.687Z to 13:15:55.904Z (Asia/Calcutta date: 2026-10-09), isolated lab soterai-security-review-8cdd88de301a4da184b55375f06e5cd6. VS Code 1.104.0 and extension 0.6.3. No live model/provider was contacted according to the retained evidence.

```text
{"syntheticReview":"completed","scopedBlocks":7,"confirmedLeaks":10}
Extension host with pid 4568 exited with code: 0, signal: unknown.
updateWindowsJumpList#setJumpList unexpected result: error
Git installation not found.
```

| Archived file | SHA-256 |
|---|---|
| [baseline.stdout.txt](evidence/A0-20261009T131542Z/baseline.stdout.txt) | `2d96518ba45d9c87ad77c455c7f7a26f0fcdcdcac6c484877c1074efcf5417bd` |
| [live-host.json](evidence/A0-20261009T131542Z/live-host.json) | `4b500b62bdb9acb4c969ea4b083495f34b6307a7d9982d34bfb4bb67be8767b2` |
| [baseline-record.json](evidence/A0-20261009T131542Z/baseline-record.json) | `788a34e3cbd3c40a2653f50bfd399564130455950b74db3ff5dfbbb6ad855600` |

**INFERENCE — Hash provenance.** Evidence records extension bundle 81b84b4efd02d30f397d39978be59ba10664982f8e6f3a9173dd35568ba3bb09 and host harness 5fa842010e3d7cea7725f8953ddcf63c17773d00efc33ee922df8f56404b1eea, matching Phase 1 frozen identities and post-run bytes. Code.exe post-run digest is a1a616d807909cb836f3ac920c5ccdae3c5bd7c4cc955480c9ce70da2614da08. Remaining source/launcher identities are in baseline-record.json. Measurements after execution do not establish the initial state of every runtime dependency.

**INFERENCE — Evidence limitations.** The launcher loaded the live working-tree extension path, not the dedicated frozen snapshot launcher; preserve that earlier launcher's NOT_RUN disposition. The legacy JSON lacks a unique run ID and complete OS/policy/grant/runtime identity. Its shared historical output was overwritten by the user's launcher; this archive preserves the current run without asserting recovery of prior raw bytes. Git-history observation exists despite the editor discovery warning, but followed removal of the repo deny. The environment/output observation concerns an injected synthetic child, not the broker. Loopback transport does not certify OS-wide egress enforcement.

**INFERENCE — Changed scope / rollback.** This step adds evidence/documentation only and changes the working branch. It creates no security behavior or flag, no probe and no host execution. Keep the archive and snapshot; correct an erroneous classification with a new record rather than replacing raw evidence. No permission, custody or enforcement setting requires rollback.

## Phase 2 copy — completed under S1

**INFERENCE — Source and destination.** Copied these five files from C:/Users/USER/AppData/Local/Temp/SoterAI-Phase2-Defensive-Survey-20261009-f0d7d0e0 into phase2/, preserving bytes and verifying all source/destination hashes against Phase3 source-notes. Temp originals remain. Destination did not exist before this batch.

| File | Source SHA-256 |
|---|---|
| candidate-architectures.md | `c146b1d3b30c605129ec9e03c05f5e0b9bbc686568d6555d8f1005121d6d0b3b` |
| mechanism-matrix.md | `bd4929c335ce71c4018af7f85f013d319589da647104f40aea0f67b11f354d5a` |
| open-questions.md | `6070e2acadb2d40f1b47fb8e99cb53e4bdb8d9843673858d96ca3c571adfb173` |
| PHASE3_KICKOFF.md | `307264adf474c1b8129df64db2c73732dfe9da94e9d63dde719618f9137366d0` |
| research.md | `43f915cee3adeb56e628685e05539e207c3547778ec0af12bf91dc582ea4220e` |

## Unprotected scope and retained gaps

**INFERENCE — FAIL / UNTESTED / INCOMPLETE.** Observed baseline leaks remain unresolved. Original file/selection/alias access, same-user token/DPAPI authority, policy tampering, history, ordinary process/output paths and independent loopback disclosure are not fixed. F16 remains STATIC-ONLY. Control-token and directory/parent ACL evidence remains INCOMPLETE. Protected buffers/clipboard/display, independent consent, durable protected policy, mandatory networking, cleanup/revocation, containment and real-agent/platform coverage remain UNTESTED for the selected architecture.

**INFERENCE — Safety filter accounting.** No action in this A0 bookkeeping step was blocked. Preserve earlier dynamic-auth INCOMPLETE and its exact filter message in Phase 3 source notes; no retry or reformulation is authorized.

## B0 completion record

**INFERENCE — Correction to A0 historical recovery gap.** Exact Oct8 live-host.json bytes were recovered from Git blob 19c21101b8a78c454a7a73ed8469f273d1bf831b, reachable at the original path in tree c866bd958b32ba3c431d4c46a9584c196397743f. SHA-256 b84cd27912535e4081ee8a0dcd419cd301b0d276b1d6b34b25f97287235b286e matches the previously recorded digest. Archived at evidence/B0/recovered-oct8/live-host.json. A0 and original historical classifications are unchanged; the shared file remains the user-run A0 artifact.

**INFERENCE — B0 diff.** Added ReviewEvidence exclusive writer and two unit tests. Existing host launcher now rebuilds extension dist before compiling the existing harness, records prepared extension/harness/Code hashes, writes unique run folders and refuses output reuse. The unique-evidence flag disabled means no host operation, never legacy overwriting. Host source adds only run metadata and exclusive output; no new attack scenario. Five Phase2 documents copied unchanged.

**INFERENCE — Raw B0 checks.** evidence/B0/checks-1 contains typecheck/build/test logs and summary.json. Both typechecks and builds exited 0. Extension tests: 556 total, 554 pass, 0 fail, 2 skip. Broker tests: 128 total, 127 pass, 0 fail, 1 skip. Existing host compile exited 0, never executed. PowerShell launcher parse passed without execution. Diagnostic results.jsonl retains 28 PASS, 1 FAIL (S5-unmarked), 2 SKIP. These are test-command and harness observations, not independent security grading.

**INFERENCE — Loaded bundle identities.** B0 extension rebuild SHA-256 remains 81b84b4efd02d30f397d39978be59ba10664982f8e6f3a9173dd35568ba3bb09. Updated existing host compile SHA-256 is 488325093598687c1567c2d0f7f77977505ee7e0d3a6fc8571e7fe58a273b572. No updated host bundle was run. Changed-file hashes are recorded in evidence/B0/SHA256SUMS.txt.

**INFERENCE — B0 limits/rollback.** No confidentiality leak, independent authority, clipboard/display, mandatory egress or real-agent guarantee is fixed by evidence hygiene. Rollback disables host review or retains exclusive output; never restore a shared overwriting target. Keep both recovered historical bytes and A0. No normal profile/system settings changed.

**INFERENCE — Delegation resources.** Three read-only subagent turns ended INCOMPLETE due to this exact resource message: "You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 9:16 PM." Root completed available B0 review/checks. This was a resource error, not a safety-filter rejection; no bypass/rephrasing attempt occurred.

## B1 completion record

**INFERENCE — Commit provenance.** B0 local commit: 3199be3e. Its documentation byte-preservation .gitattributes SHA-256 is d0603ac3cab63089f7244db84653fc897259f89c0c895297beddf105e42f9010. Batch manifests describe bytes as of the batch; future changed versions are not expected to match an earlier manifest. Relevant pre-existing content in touched manifest/command/test files is retained; unrelated working changes are not staged.

**INFERENCE — B1 diff.** Added SafeGit with known absolute install discovery (no bare Git or VS Code API dependency), pinned executable per job, Git >=2.36 version gate, an explicit empty global config, minimal environment and forced hooks/fsmonitor settings. Flag hardening.safeDiffLaunch off disables diff sharing; unavailable Git produces a clear message with no fallback. Added native coverage disclosure before broker start/config success; flag hardening.coverageDisclosure off disables the setup flow. Operational results explicitly retain UNTESTED verification. Existing native-baseline source received one missing brace; compiled only, never run. Regenerated readiness metadata and corrected README setting count/authority wording.

**FACT — Git version rule; accessed 2026-10-09.** Git documents that 2.35.1 and earlier interpret boolean fsmonitor values as hook pathnames. The implementation conservatively requires >=2.36 before using false. https://git-scm.com/docs/git-config

**INFERENCE — Raw B1 results.** checks-1 retains initial extension typecheck FAIL (test assertion narrowed an array to never[]) and unit FAIL (temporary directory lock and generated documentation/count drift). Those defects were corrected; no failure was removed. checks-2: extension typecheck/build exit0, 561 tests /559 pass /0 fail /2 skip. Initial B1 broker typecheck/build exit0 and 128 tests /127 pass /0 fail /1 skip; broker code was unchanged during the extension recheck. Existing native baseline compile exit0, no execution. Final extension bundle SHA-256 b9dbbb1d4df8502b0c44fa82cbcbbad8ecadac2e7121e646f033d953443e9ea0. Raw Windows config controls in checks-2/diagnostic-results/windows-git-config.json show Git 2.53.0.windows.1, explicit empty file PASS; NUL returned empty on this exact configuration. Product uses the explicit empty file, not NUL. Full architecture and F16 dynamic authority-isolation remain UNTESTED/STATIC-ONLY beyond these benign config/unit checks.

**INFERENCE — Limits/rollback.** Same-user executable replacement, source/config mutation, direct originals/history, buffer/clipboard/display/process access and unrestricted native egress remain unprotected. Disabling either flag withdraws its operation, never invokes the old launcher or old blanket success display. Syntax repair has no new scenario; later user wrapper controls harness execution. Original failed source/logs remain in Phase1. No host run, actual tokens, normal profiles, system settings, external recipient or Tier3 deployment was used.

