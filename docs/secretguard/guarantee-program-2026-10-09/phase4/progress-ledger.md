# Phase 4 progress ledger

**INFERENCE — Resume rule.** Read this ledger first and do not redo finished batches. The FINAL MASTER prompt supersedes the former per-step pauses: S1 approves Phase2 copying; S2 approves local commits on security-hardening; S3 approves narrowly scoped broker ACL repair after inspection/backup; S4 approves the stated modal-only deny relaxation UX. Run checks, record raw results/hashes/limits/rollback and commit each batch, then continue autonomously. Push/publish/tag, normal profiles, firewall/drivers/accounts/VM/features and Tier3 implementation remain unapproved.

**INFERENCE — Current step.** B0–B3 are complete as scoped hardening, with failures retained. B2 control-token inspection remains INCOMPLETE (absent file). A0 confidentiality remains FAIL. All thirty selected-architecture assertions remain UNTESTED. Next batch: B4 optional public scaffold, then B5 feasibility/B6 handoff/B7 report. No Tier3 deployment.

**INFERENCE — Working branch.** security-hardening, created from release/n8n-0.8.7 at HEAD 973b8af6060aa967fc0ecad7d56251a2da41149a. Existing modified/untracked work was retained; no commit was created. A branch name does not isolate those existing changes from future staging, so no broad staging or reset is allowed.

## Next action and approval gates

**INFERENCE — Next action.** Complete the B4 scaffold checks, then B5–B7. Ordinary editor modal consent is explicitly not agent-proof. Native host execution remains user-only.

**INFERENCE — Pending approvals.** Copy/local commits/scoped ACL repair/modal-only UX are now authorized by S1–S4. Tier3 decision and unapproved system/profile changes still require one precise question and a stop. S3 is limited to broker directory and its two token files; parents are inspection-only. Never read or print actual token values. Do not change firewall, drivers, accounts, VM/Windows features or normal profiles.

| Stage / step | Status | Next scope / evidence |
|---|---|---|
| A0 user execution and evidence capture | **INFERENCE: PASS bookkeeping; FAIL confidentiality** | User ran existing harness. Agent reviewed and archived evidence only. |
| A0 Phase 2 document copy | **INFERENCE: PASS byte-identical copy (S1)** | Five source/destination hashes verified against Phase3 source-notes; Temp originals retained. |
| B0 housekeeping | **INFERENCE: PASS command/record hygiene; confidentiality remains FAIL** | Exact Oct8 bytes recovered; unique/exclusive host output; rebuilt bundle identities and raw results archived. |
| B1 low-risk fixes | **INFERENCE: PASS scoped command/unit checks; full assertions UNTESTED** | Syntax repair compiled; Git launch hardened and Windows config behavior measured; pre-success coverage tested. |
| B2 Windows ACLs | **INFERENCE: PASS metadata/unit checks; control-token INCOMPLETE; same-user protection UNTESTED** | Scoped ACL repair backed up; real product metadata validator passed for existing objects; synthetic loopback broker suite passed. |
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

## B2 completion record

**INFERENCE — Commit provenance.** B1 local commit abebae10. B2 modifies auth.ts and auth-storage.test.ts, adds WindowsAcl.ts and windows-acl.test.ts, and archives ACL metadata/backups/checks. Relevant pre-existing auth mechanics are retained. No real token value was opened or printed.

**INFERENCE — ACL inspection and change.** evidence/B2/acl-before.json and acl-after.json include directory, auth-token, missing control-auth-token and two parents. Owner USER SID S-1-5-21-576938901-594400856-1755335594-1001; inherited CodexSandboxUsers SID ending 1007 had read/execute. Saved broker.acl-backup SHA256 f5ae7a6287d4e992b009298a57f904e165a41afdb0895789cf8709893309e153 and auth-token.acl-backup SHA256 49c2411ac00a5c2fa35822cfbe40112b7d26c9812294d0a3444922b69690d823 before changes. Applied /inheritance:d then /remove *group-SID to the two existing objects only. Directory/file now have protected, explicit owner/SYSTEM/Administrators ACEs. Parent SDDL equality passed. control-auth-token remains absent and INCOMPLETE; no file was created. Initial parent account-name translation failed for an app capability SID; retained initial JSON and recorded complete SID metadata with unresolved-name fallback.

**INFERENCE — Runtime validation.** Windows file authentication now checks private, protected current-user ownership and whitelisted explicit ACEs before opening and again before reading token contents; validates immediate-parent foreign write authority. New exclusively created empty token files are protected/validated before writing. Missing/unsafe permissions or inspector errors fail closed. Pinned System32 PowerShell runs a fixed encoded metadata script; never interpolates a token/path into script text. SOTERAI_BROKER_WIN32_ACL_VALIDATE=0 disables Windows file authentication, not validation. Existing insecure custom directories now require deliberate enrollment; no automatic ACL edits to parents or existing external files. Product validateWindowsPrivatePath passed read-only on broker directory, auth-token and immediate parent (runtime-acl-validation.json).

**INFERENCE — Raw checks.** checks-1 broker typecheck/build and 132 tests (131 pass/0 fail/1 skip) completed; check runner stopped on PowerShell NativeCommandError handling of build stderr. checks-2 preserves the complete rerun: both typechecks/builds exit0; broker 132/131 pass/0 fail/1 skip; extension 561/559 pass/0 fail/2 skip. Existing synthetic authenticated loopback requests remain successful; file-mechanics fixtures inject metadata to avoid ACL edits outside S3. Metadata rejection tests are separate. Normal-profile/installed-broker authentication using real tokens was not attempted and remains UNTESTED. No break was observed; saved restoration backup retained.

**INFERENCE — Failed orchestration retained.** The prior repair command failed to parse before executing: "Missing ')' in method call." / "Unexpected token '.ToString' in expression or statement." Corrected the PowerShell catch expression, then applied S3. A Node -e metadata invocation lost quotes under Windows argument passing and failed with "SyntaxError: Unexpected token '.'" before inspecting anything; the stdin invocation succeeded. These are command failures, not confidentiality results or safety-filter blocks.

**INFERENCE — Limits/rollback.** Owner full control remains; hostile same-user processes may still read/change/replace credentials and race path checks. DPAPI/SecretStorage is not independently isolated. Parent permissions stay unchanged; metadata checks do not establish an atomic Windows handle ACL boundary. No G1-G6 assertion gains architecture PASS. ACL rollback is emergency /restore of the two saved descriptors only if operation breaks, with group exposure explicitly INCOMPLETE; runtime flag-off withdraws file authentication and must not load the old win32-skipping binary. No host/native probe ran.
## B3 completion record — 2026-10-10 client date

**INFERENCE — Commit provenance.** B2 local commit cd98ad80. B3 keeps repository-contributed accepted globs and manual denies in serialized workspace state. Public save/update APIs union rather than replace; deleting/weaker .aiignore/project policy does not remove an already accepted deny. Defaults remain mandatory. Invalid/oversized state fails closed. PolicyStore.save unions protected paths, removeProtected and legacy removeFile APIs withdraw removal. Native review selects one rule, shows its scope and the exact not-agent-proof label, and privately removes only that selected entry after affirmative modal result. Repository entry still present re-adds its deny. Flag addOnlyPolicy off withdraws sharing/mutation without clearing accepted state. This is state hygiene under USER, not durable independently protected policy.

**INFERENCE — Standalone repairs.** Ordinary broker approval displays exact session/hash, one use and legacy five-minute consumption expiry; cached broad-session approvals are withdrawn at registration. Labelled native confirmation is required for protection-disable commands and legacy workspace-mark removal; scopedConfirmation off withdraws these actions. Healthy live Safe Mode replaces persisted desired state in both service and panel. Policy status validates bytes without silently creating a file. RuntimeEvidence off removes operational claims. Configuration URL text supplies zero independently verified routes; unknown evidence cannot be reported as a detected bypass. Broker preview ignores caller sandbox strength and reports platformEnforcement UNTESTED/previewOnly; SOTERAI_BROKER_TRUSTED_SANDBOX_CLAIMS=0 withdraws that preview (503).

**INFERENCE — Reference retention.** New nonsecret ID inventory is persisted before SecretStorage values, serializes per-instance storage operations, purges inventoried leftovers at activation without value reads, deletes expired backing values, validates positive finite <=24h TTL and denies late/concurrently withdrawn creation. Feature secretInventory off withdraws creation/reads while cleanup remains available. Deactivation revokes local capabilities and attempts cleanup before broker shutdown. Failure retains recovery IDs and reports INCOMPLETE; unindexed legacy values cannot be enumerated. No actual SecretStorage or user credentials were accessed by checks.

**INFERENCE — Classification.** issue-disposition.md/json account for all37 unchanged Phase0 IDs: 8 FIXED-NOW for narrow named mechanics, 3 TIER-2-LITE hygiene allocations, 25 TIER-3 authority/verification allocations, 1 WON'T-FIX universal private-prose recognition. All original full-T issues remain OPEN; S5-unmarked retains FAIL. All A01-A30 remain architecture UNTESTED; all63 real-agent matrix cells NOT_TESTED. FIXED-NOW is not full guarantee closure.

**INFERENCE — Raw checks and failures.** Initial standalone typecheck reported missing folder-pick stub/heterogeneous mock typing and unused sandbox parser; fixed adapter/type declarations and removed unused parser. checks-1: both typechecks/builds passed, broker133 total/132pass/0fail/1skip; extension583 total/580pass/1fail/2skip (fragile1ms fixture). Changed only fixture lifetime to200ms with220ms expiry observation; product still rejects already-expired creation. checks-2 retained readiness-doc drift failure after restricted-settings additions. Regenerated existing readiness file. checks-3 passed; then tightened unknown-route/bypass reporting and explicit legacy expiry text. checks-4 extension typecheck/build/test exit0:584 total/582pass/0fail/2skip. Broker code unchanged since its successful checks-2 typecheck/build/test:133/132pass/0fail/1skip. These extension counts include seven pure B4 scaffold tests present concurrently; B4 files are committed separately. No native host ran. Diagnostic findings retain S5-unmarked FAIL and SKIP rows independently of unit runner exit0.

**INFERENCE — Changed files/hash/rollback.** B3/SHA256SUMS.txt identifies every staged product/test/document file and raw check artifact as of this batch. Relevant pre-existing content in touched dirty files is preserved; unrelated files remain unstaged. Rollback turns individual flags off to withdraw affected sharing, approvals, retention operations or status claims; never reinstall the previous weaker path or clear accepted denial. Source-level rollback without enrollment compatibility is not a safe automatic action.

**INFERENCE — What remains unprotected.** Ordinary VS Code APIs cannot independently prove a direct human gesture or prevent same-user dialog automation, config/state/storage/credential tampering or direct native file/history/process/clipboard/display/network access. One broker session is caller supplied, not enrolled OS agent identity. Five-minute legacy once grants differ from the proposed Phase3 sixty-second contract; no G2 claim is inherited. Cross-window inventory concurrency, legacy orphan discovery, atomic Windows ACL races and runtime container/OS enforcement remain INCOMPLETE/UNTESTED. Current build uses retained pre-existing working-tree dependencies; clean-checkout reproducibility from local commits alone is UNTESTED and final handoff must pin the working-tree/source and bundle identities.
## B4 completion record — 2026-10-10

**INFERENCE — Commit provenance.** B3 local commit add867a5. B4 adds tier2-lite/PublicWorkspace.ts, DevcontainerTemplate.ts and seven pure/synthetic unit tests, plus tier2-lite.md. Default-off input flag enabled must be exactly true before source reads. Generator returns an in-memory plan only; there is no command/launcher/disk exporter installed into VS Code. Explicit public file list + deny checker, bounded no-link/hardlink reads, prohibited hidden/history/home/cache/recovery/credential paths, rechecks after reads and opaque value-free placeholders are implemented. Reviewed image digest, nonroot/cap-drop/no-privilege/no-host-bind/offline template policy and exact limitation label are generated.

**INFERENCE — INCOMPLETE optional runtime mode.** Git-config/helper settings and no socket/agent environment are declared intent, not effective attach evidence. No official dedicated SSH/GPG forwarding-disable settings were established; none were invented. Credential forwarding at attach is INCOMPLETE, runtime/image compatibility/networking UNTESTED. Future online mode is unavailable without an externally owned enforcer. No WSL/Docker/VM/profile/OS/network launch or change occurred. The repo-only scaffold is reviewable; a complete deployed Tier2-lite mode was not implemented or certified. Native agents remain OUTSIDE COVERAGE; WSL is not a boundary against Windows USER.

**INFERENCE — Raw tests.** Targeted scaffold checks:7/7 pass. checks-1 typechecks/builds exit0, but default worker test runs failed from resource exhaustion: broker73 total/66pass/7fail; extension264 total/241pass/21fail/2skip. Retained exact messages include "fatal error: out of memory allocating heap arena map", "fatal error: runtime: cannot allocate memory", "Error: The service was stopped" and "Error: spawn UNKNOWN". Reran the same existing suites via node --import tsx --test --test-concurrency=2 (two file workers), without new scenarios: checks-2 broker133/132pass/0fail/1skip; extension584/582pass/0fail/2skip; both exit0. Diagnostic S5-unmarked FAIL remains. No host run.

**INFERENCE — Hashes/rollback/limits.** evidence/B4/SHA256SUMS.txt pins source, tests, docs and raw logs. Off withdraws generation; no rollback introduces online/native execution or credentials. Source originals/history, same-user tokens/DPAPI, buffers/tabs/clipboard/display/processes, prior copies and mandatory host egress remain exposed. All architecture assertions and real-agent/runtime cells remain UNTESTED/NOT_TESTED. Public misclassification, cross-process races and effective editor attach are outside this scaffold's evidence.
