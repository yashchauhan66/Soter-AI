# SoterAI Lite: exact resume state and remaining execution plan

Prepared 16 October 2026 at the user's request to continue in a shorter new chat. This document is a handoff, not a completion report. Preserve the existing working tree. **F01-F09 are DONE for their scoped contracts; F10 is ACTIVE/INCOMPLETE; F11-F32 and V01-V05 remain pending.** No final rating yet.

## 1. Start here: read in this order

1. `docs/soterai-lite/ledger.md` FIRST, especially its last receipts. Read it first again after every context compaction.
2. This handoff, then `docs/soterai-lite/MASTER-PROMPT-20261016.txt` (an exact byte copy of the user's original attachment; SHA256 `2ea0c90b1fe3bdd591e5ae24470dcd8804abfff7a75741ec1f5a1aae7e4679ae`). The original remains `C:\Users\USER\.codex\attachments\faaf064d-68fb-4208-b56a-5f26be1f6cc0\Pasted text.txt`.
3. `docs/soterai-lite/IMPLEMENTATION-PLAN.md`, `FEATURE-QUEUE.json`, `inputs.json`, frozen `LITE-CATALOG.json`, `ITEM-MATRIX.md` and the existing installed-tool inventory `evidence/20261013-l0-resume-88fb9432/installed-tool-and-workspace-inventory.json`.
4. F10 evidence directory `docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/`: designs01-05, both source-review notes, fixture correction/retention notes, and `handoff-checkpoint-01.json`.
5. Inspect the specific current source/test files before editing. Follow any applicable repository instructions. Do not reread every historical raw host directory or the entire chat.

The old plan contains historical initial-state prose (for example its final P01/F01 resume paragraph and catalog draft wording). Current queue, ledger and exact evidence override those historical descriptions. `runtimeFeatureFlags` in queue is an old preparation note; actual F01-F09 flags are implemented. Do not restart preparation or F01.

## 2. User instructions, permissions and boundaries that persist

- Workspace: `C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard`; PowerShell; branch `soterai-lite`.
- **One feature fully implemented, tested, exact artifact/native affected checks, scoped local commit and byte verification before the next.** Production concurrency=1. Test authoring/read-only reviews can run in parallel; same-lineage evidence is LOW independence.
- User explicitly waived the 20 GB free-space threshold. Do not ask for it again. Actual ENOSPC is a real failure, not permission to delete evidence or user data.
- Already authorized: local implementation, synthetic tests/builds, existing host harnesses, unique local VSIX files, isolated synthetic editor profiles, scoped local commits. Continue autonomously; do not repeatedly ask for these permissions. Use the environment's required escalation mechanism for protected Git writes, GUI/child-process tests or D: writes.
- Not authorized: push/publish/tag; normal VS Code profile install/reload/settings; killing processes/updaters; Windows/firewall/drivers/accounts/VM changes; logins/tokens/real credentials; unapproved downloads. Full remains scaffold only; no Full/controller/VM/mTLS implementation in Lite.
- Synthetic fixtures only. Never scan/read this real workspace's actual secret files, account files, shell history or normal editor profile for verification. Network tests loopback only; `inputs.json` authorizes no external test payload or download. Researching official docs is not evidence of a tested tool route.
- Never overwrite/delete raw evidence. Use unique names and exclusive creation. Preserve failures/skips/cancellation/unexecuted controls. No `git add -A`, reset/clean or unrelated rollback. Close only an owned test window through the editor's closeWindow command, never process termination.
- A cooperative extension is not an OS boundary. Keep arbitrary native reads, independent uploads, other extensions' original buffers and hostile same-user access visibly limited. Do not promise perfect/unbypassable protection.
- Original L6 requires HUMAN-ACTIONS and STOP. Earlier genuine required-tool authentication/availability blockers must remain open, not be called DONE; never perform login or replace required actual-tool evidence with a mock to advance. Final ratings wait for the required completion/human gates.

## 3. Exact completed checkpoint

`HEAD = 24da9ce9907cd6082b7ce3a3e79136cd4c551508` (F09 verified transition). F09 source commit `7bfdc91279ab9f59811ba6918e388846c5ea2411`: 193 indexed/193 exact changed paths, zero mismatch. Transition: 6 indexed/6 exact paths, zero mismatch. F10 source is **uncommitted**; nothing was staged at handoff.

F01 reliable saved restrictions; F02 versioned additive defaults/presets; F03 drift/typed deliberate relaxation; F04 exact 60s one-time masked consent; F05 private CustomDocument masked editor/encrypted recovery; F06 opt-in vault migration/recovery; F07 registered raw/encoding matching; F08 completion-buffered UTF8/control output redaction; F09 reviewed app/task/lifecycle-debug injection are DONE for their documented scoped contracts. Their acceptance/source/byte-verification paths are in FEATURE-QUEUE.json. Preserve their behavior; shared changes require affected verification.

Last accepted F09 artifact:

- `packages/soterai-lite/soterai-lite-0.7.0-f09-20261015-attempt01.vsix`
- 1,377,965 bytes; SHA256 **`04157b046e5c01e111e5ef5830a4998c06085a85c14566af9bce5c9704c20bba`**.
- Runtime SHA256 `81ceabd72fff5bb673fdd579c4e15e7bc8c46e791e864ae03c08782bfeb7236e`.
- F09 focused150 PASS; full1464/1460 PASS/4 SKIP; typecheck04 PASS; native12 PASS; functional10 PASS; 17-case comparison unchanged: **8 BLOCKED_SCOPED / 9 LEAK_CONFIRMED**. LOW scripted/native evidence, not independent certification.
- Actual last tested editor was installed Code1.141.2. Inspect current executable/version before the next host run; do not update it or assume historical versions are current.
- Lite0.7.0 ID `soterai.soterai-ide-guard`; canonical manifest still0.6.3. Lite entry reexports canonical activation. Canonical contributes/activation/capabilities are staged by package.cjs; preserve existing release identity workflow.
- Frozen catalog44 checks SHA256 **`1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4`**. Catalog evaluation remains UNVERIFIED, not a score earned by implementing settings.

Fresh handoff checkpoint `evidence/20261015-f10-ps51-3f12ab64/handoff-checkpoint-01.json`, SHA256 **`0729e73c136faf6a93f5dc37016eb9c5fc01e65a197b01bb51cb53c649b206f4`**: hashes18 source/test files,11 run receipts, current Git metadata, exact accepted artifact/catalog/master copy. All11 recorded raw-output hashes matched their receipts when captured. Reverify relevant bytes if anything changed later.

## 4. F10 current implementation: preserve and finish

F10 is an actual finite PowerShell5.1 worker behind an ExtensionPty checked-command dispatcher. It is not arbitrary interactive PowerShell. Unsupported whole input refuses without shell fallback. Read/search/copy use F04, never native original-file cmdlets. ENV shows fresh minimal base names with masks only. Full grammar/bounds/APIs are frozen in designs01-05; do not reinvent them.

Current related production files:

| File | Implemented scope |
| --- | --- |
| `packages/core/src/PowerShell51Command.ts`, core `index.ts` | Whole-input parser, strict UTF8/control/token/path limits, frozen typed operations |
| `src/terminal/PowerShell51Worker.ts` | Pinned installed PS5.1; same fixed UTF16LE encoded script for every operation, literal JSON stdin, minimal fresh env, no profile/PATH/preloads, private completed F08 output, actual close+EOF ownership, natural cancellation/STOP_UNCONFIRMED |
| `src/terminal/ManagedOutputBinding.ts` | Canonical no-alias root/path/policy and safe empty-store bindings |
| `src/terminal/ManagedOutputFilter.ts` | Private complete F07 registry + F08; sticky revocation, short-value conservative masking, marker-collision withholding |
| `src/firewall/VaultManager.ts` addition | `createManagedOutputFilter(root,enabled)`; verified existing key/cipher, current-root+legacy registrations, other-root exclusion only after metadata validation, no source/recovery fallback/key creation |
| `src/firewall/VaultStorage.ts` addition | `hasRecoveryRecords`; missing cipher with retained recovery cannot become empty registry |
| `src/terminal/CheckedPowerShellSession.ts` | READ/SEARCH/head/tail/safe-new-file COPY/ENV/PUBLIC dispatch, bounded admission/busy, cancellation, final root/source/policy/destination checks; **GIT currently deliberately WITHHELD/pending** |
| `src/terminal/CheckedPowerShellProfile.ts` | Native private metadata diff/approval, exact selected workspace setting, durable PREPARED/APPLIED receipt, safe scoped restore; existing unrelated settings preserved |

All src paths in this table except core are under `packages/vscode-extension/`.

Latest verified facts, with exact source ordering:

- Parser31 + worker37 =68 PASS (`focused-after-01`). Three real finite installed PS5.1 cases: version5.1, literal Unicode including `$(Get-Date)` preserved as data, cancellation waits for natural close.
- `focused-after-02`:153 PASS = parser31+worker37+filter44+session20+profile21. `typecheck-01`:PASS on that earlier revision.
- A real session/private-filter positive control D20 originally failed: completed filter was mistaken for withdrawal by the worker guard. Fixed by keeping filter admission before launch and letting the filter own its private completion checks; worker's independent live guard remains valid after filter finalization.
- Review S10-01: final COPY awaited policy after closing its private registry guard. Failing baseline2 cases/1 PASS/1 FAIL. Fixed: last async destination check precedes `filter.finish`, with no await before guarded exclusive synchronous create/write.
- Review S10-02: malformed complete root/source bindings could be omitted as another project. Baseline9/1 PASS/8 FAIL. Fixed: metadata-only canonical local URI/authority/query/fragment/containment validation before other-root exclusion, no source reads.
- **Latest `filter-dispatch-review-after-01`:75 PASS**, covering filter44+binding review9+session20+copy review2, exit0, raw SHA256 `664f73b770b5c677be9c31b097597f1d3e2dcd4937b30893af3fe82c410d8166`.
- These75 are a subset, not a rerun of all current164 controls. **Final combined164 and compiler after the latest fixes/new fixtures have NOT run.** No F10 full suite/artifact/native/affected hosts/commit yet.
- Historical baselines/failures stay retained, including68 missing implementation failures and65 missing filter/profile failures. D17 fixture used unsupported sensitive-folder setup, corrected to supported folder-deny while preserving denial assertion. Initial profile fixture removed its own synthetic temporary directories; cleanup was removed, documented in fixture-retention-02, and future directories remain retained. Raw reports were retained.

Authored fixtures not yet exercised:

- `src/__tests__/powerShell51Terminal.test.ts`:22 frozen cases, SHA256 `663cec9db04c50471ead62d7e6549665083d0ab517efb0cdea89d1bca4eba8cc`; target `PowerShell51Terminal.ts` does not exist. Baseline NOT-RUN.
- `src/__tests__/checkedPowerShellCommands.test.ts`:exists, registration/controller target `terminal/commands.ts` does not exist. Author hit usage limit before final freeze/count/typecheck; **inspect completeness, assert declarations/loops, freeze it, then capture missing-module baseline**. Never infer a completed author turn or passing tests. Failure saved in agent-service-failure-02.txt.
- No active subagents or pending owned tool sessions at handoff. An expired exec handle was not reused as evidence; its completed raw receipt proves the latest75 PASS.

## 5. Exact next execution sequence to finish F10

**A. Reconcile and establish the remaining baselines.** Verify checkpoint/current diff; inspect authored PTY/commands fixtures and design05. Record PTY22 and commands failing baselines under new unique names, before implementation. Run current compiler with a new receipt if fixture changes need validation. Do not rerun old evidence scripts with used output names.

**B. Implement terminal UI and trusted wiring.** Build `PowerShell51Terminal.ts` and `terminal/commands.ts` to frozen design05. Hidden bounded input, no echo/history, whole-line rejection for invalid controls/overflow, one pending operation, CRLF once, Unicode backspace, help/clear, cancellation/revoke and actual-completion close. At most2 global pending commands, no unbounded approvals. No native env merge or arbitrary shell execution.

Return the private `{read,revoke,isEnabled}` bridge from `registerProjectPrivacyCommands`; reuse its existing managed-read-terminal closure. Pass it from activation to `registerFirewallCommands`' optional third argument, share that module's existing VaultManager, register F10 from there. Missing bridge means unavailable; do not invoke the public integration command as trusted fallback. Existing F04/F09 paths retain behavior. Add stopCheckedPowerShell to deactivation before shared teardown.

Contributed profile: id `soterai.ps51.checked`, name `SoterAI PowerShell 5.1 (checked commands)`. Native configure/open/run/restore/status commands are listed in design05. Run uses native hidden input box only; caller arguments cannot supply commands, reader, executable or env. Badge/help says “Managed checks — declared commands” with explicit bypass limits.

Implement bounded value-free persisted ownership at `soterai.lite.ps51.ownership.v1`: prepare READY before spawn; live/exit metadata only; at most64 strict rows, terminal history bounded32; startup recovered rows UNVERIFIED, no PID adoption/signaling. Corrupt/missing-unreadable admission metadata preserves bytes and withholds launches. Design05 adds internal session admitWorker/workerChanged hooks; recheck guard after awaited admission. Poll only owned live jobs for STOP_UNCONFIRMED, coalesce serialized persistence, shutdown cancels/flushes without killing or waiting forever. Write tests for new lifecycle hooks before changing them.

**C. Resolve the pending Git metadata operation before F10 acceptance.** Current GIT branch is WITHHELD. Do not call existing `createSafeGit().run` or its timeout/maxBuffer `execFile`: it can kill children. Reuse only candidate/env/argument hardening helpers. Freeze a separate design06/API and meaningful regressions BEFORE source.

Review advice (proposed, not implemented/frozen acceptance): expose explicitly **staged-only** metadata (`diff --cached --name-status` for status and `diff --cached --stat`) with `--no-renames --no-ext-diff --no-textconv --ignore-submodules=all --`; clearly disclose the reduced semantics instead of implying worktree status. Plain worktree status/diff may invoke configured clean/process filters. Existing pinned standard Git only, empty external config/hooks directory, minimal fresh env, hooks/fsmonitor/credential/external diff protections, no PATH fallback. Reject unsupported version and partial/promisor/alternates/external gitdir/worktree cases; disable lazy fetch only after verifying exact runtime support. No arbitrary executable/request override, fetch, network or history/body fallback. Integrate through the same finite fixed PS worker and F08, with no new kill path. Official-source advice is in source-review02; verify exact installed-version behavior. Missing capability is visibly unavailable; do not mark required Git behavior complete merely by always withholding it.

**D. Finish containment/race/lifecycle coverage and same-lineage review.** Existing initial junction controls pass. Add the specifically requested directory-swap-before-protocol guard regression with a public-directory positive control, without actually enumerating outside a project. Review final profile receipt handling, canceled/pending-worker ownership, final output release, config/key/root/policy drift, malformed records, global2 limit, flag withdrawal and no original TextDocuments. Retain paired failures before fixes where reachable. Existing two review findings are fixed by current75 PASS; review new wiring separately.

**E. Metadata, compiler, suite and exact package.** Add machine/restricted `soterai.lite.ps51Terminal` defaulttrue, canonical+Lite contributed profile and advanced command gates, BoundarySnapshot public settings binding, README actual machine-setting count/readiness docs. Current canonical count48; new flag is expected to make49, but compute rather than assume. Regenerate readiness through the existing generator. Run all F10 controls and required F01-F09 affected tests; compiler; full suite serially. Build uniquely named Lite VSIX, inspect entries/runtimes/source-input hashes/no forbidden files, compute its real hash. Do not reuse F09 artifact to claim F10 PASS.

**F. Actual hosts, acceptance and serial barrier.** Author a synthetic actual VS Code fixture for profile provider/PTY, actual PS5.1 positive command, F04 ordinary approval and env all-value masking, search/head/tail/copy, whole-input refusal, diff/undo, restart/recovered UNVERIFIED ownership, cancellation, withdrawal. Use exact extracted/loaded new runtime and isolated D: editor profile, no normal profile. Reuse existing affected functional10/security17 and affected F04/F09 flows on the same artifact; compare rows, preserve nine unmanaged leaks honestly. Scripted native API identity is LOW and does not prove human usability.

Save F10 acceptance/index/progress, append STEP RECEIPT, commit explicit related allowlist, verify every indexed/changed Git blob byte plus final physical artifact. Commit queue/ledger transition separately and byte-verify it. Carry F09 postcommit untracked receipts listed by its evidence directory into the scoped evidence index when appropriate. **Only after this barrier mark F10 DONE and activate F11.**

## 6. Remaining cards after F10, in the existing frozen order

For every row: inspect existing implementation first; implement only its missing scope behind its machine safety flag; meaningful failing regression; focused positive/negative/cancel/outage/withdrawal; matching package/affected actual route; ledger and scoped byte-verified commit. An absent optional runtime retains NOT_TESTED/NOT COVERED per the P03 applicability lock, never becomes DONE. Do not change frozen applicability to hide a failed required behavior.

| Order | Implementation action | Required acceptance emphasis |
| --- | --- | --- |
| F11 PS7 | Separate existing-runtime finite adapter using shared checked contract | Actual pinned PS7/version-specific quoting/encoding/consent/output/profile/restart; absent means NOT_TESTED, no download |
| F12 cmd | Separate finite declared grammar/profile, fresh env and same reader/redactor | type/set/find/copy, expansion/quotes/chains/refusal/undo; no claim batch macros veto all native commands |
| F13 Git Bash | Separate already-installed runtime adapter, reviewed hooks and declared safe grammar | Actual cat/head/tail/grep/rg/sed/awk/cp/env/Git where supported; absent routes visible, bash/zsh elsewhere NOT_TESTED |
| F14 broker lifecycle | Atomic free-port/session/window ownership and separate control auth, health/restart/shutdown | Occupied47321, bind races, two windows, stale/wrong auth/session/outage; no adoption of another window |
| F15a-h body decoders | JSON → gzip → Brotli → deflate → chunked → NDJSON/SSE → multipart → base64, separate subcard/flag/receipt each | Actual loopback bytes, public forwarding, secret refusal before first byte, malformed/ambiguous/nested/expansion/time/size limits; every required subcard passes before parent |
| F16 gateway policy | Wire complete F07/F15 inspection, per-tool fail-closed policy, F08 output, safe audit/self-test | Split messages/encodings/provider/entropy, backend failure/cancel, auth fields, no partial forward, positive collector; no implicit independent-client/WebSocket coverage |
| F17 safe-read MCP | Real transport + session-bound editor bridge to F04 | Actual standalone/editor path, names-only env, native approval/revoke, malformed/size/session/outage; caller-supplied raw/approval ignored |
| F18 Cline | Pin installed version, inspect official source/docs, reviewed config writer/backup/undo and proven safe-reader/gateway routes | Actual installed-tool route matrix in synthetic project; ignore file alone is not no-read proof; auth-dependent routes remain blocked |
| F19 Claude Code | Separate pinned version's official permissions/hooks/config, safe MCP/gateway only proven routes | Same actual-tool diff/backup/undo/drift/public/negative controls; no login or fake routing PASS |
| F20 other adapters | One card per frozen applicable installed tool/version | Verify each actual tool independently; unsupported NOT COVERED; no generic vendor equivalence |
| F21 hygiene/exposure | Consent-driven local findings/move-vault suggestions, safe examples, exposure metadata/rotation checklist | Synthetic detection/near-matches, reviewed fixes/undo/failure; no values in findings/ledger/UI/export; do not rotate real keys |
| F22a-h scanners | Source → Docker/K8s → Terraform/tfvars → registry configs → service-account JSON → CI → launch/tasks/settings → MCP configs | Each family separately: bounded parse, malformed/multiline/comments/near-matches, reviewed fixer roundtrip, no config execution/value preview |
| F23 Git history | Read-only bounded pinned-Git history scanner/guidance | Synthetic deleted/renamed/past secret locations, public commits/cancel/large history; no values printed/history rewrite |
| F24 artifacts/maps | Bounded dist/cache/source-map/copy discovery and reviewed publication guidance | Synthetic copies/renames/public assets, root/link containment, budget/skip reasons; no retroactive disclosure claim |
| F25 logs/tests/debug | Managed sink scanning and F08 integration, safe exposure/cleanup suggestions | Synthetic errors/stacks/structured/large output; other extensions/processes/old logs explicit limits |
| F26a-c opt-in hooks | pre-commit → pre-push → PSReadLine exclusion; coexistence/diff/backup/undo separately | Isolated synthetic repos/history only; actual configured hook public/negative controls, local fixture push only; no real history/network push |
| F27 self-hygiene | Central safe sinks, telemetry off/opt-in, bounded audit/memory lifetime | Canary success/exception/restart/export/purge; transient JS/native secret processing is honestly limited |
| F28 reliability | Parent path races, links, multi-root/window, budgets and safe degradation | Large synthetic repos/stress/property/cancel/startup/scan/stream measurements; no Developer Mode/OS change; privilege gap recorded |
| F29 Protection Center | One native sidebar: Protected/Activity/Coverage, Explorer locks/status, calm localized errors/undo | Actual UI flows, keyboard/high contrast/reduced motion, existing headless Edge/axe if available; human screen reader/usability later |
| F30 verify setup | Real isolated canary self-checks with exact config/artifact/last-verified binding | Actual button/public collector, stale/missing/mismatched evidence never green; per-surface/tool badges from real evidence |
| F31 release preparation | win32-x64 package/identity/license/icon/changelog/privacy/trust/activation/SBOM/audits, README from honest claims | Exact inventory/hash/size, no Full/source paths/fixtures/secrets/evidence; unavailable audit NOT_RUN, prepare publishing runbook only |
| F32 install lifecycle | Clean isolated profile using ONLY exact VSIX, default local activation, upgrade/policy, explicit restore-before-uninstall and owned shutdown | Measure steps/time under120s, admin0/extra installs0, restart/trust/disable/removal; optional vault/vendor reviews measured separately; no assumption uninstall code runs |

## 7. Final gates and final rating

1. **V01:** appropriate full unit/property/fuzz and actual hosts on exact final package; per-routable-tool loopback mock-provider request bodies with public collector positive controls; retain17-case historical comparison. No old-suite or mock-to-real promotion.
2. **V02:** startup/scan/stream/stress/multi-window budgets; evaluate every frozen catalog row per tool. STRONG needs design prevention, automated positive+negative checks and meaningful mutation sensitivity. Withdrawal-only availability failure is not confidentiality mutation proof. Two synthetic coding projects (Node/Express fake DB; Next.js fake API mocks), protection on/off completion/prompts/interruptions/time; real-agent trials requiring models/auth go to authorized human evidence, not invented results. At most3 eligible improvement rounds.
3. **V03:** complete FEATURE-SPLIT, ITEM-MATRIX, coverage-map, README-CLAIMS/README, user guide, release checklist, publishing runbook, evidence index, final-report/scorecard structures; rating still pending while required gates open.
4. **V04:** neutral reviewer kit tied to exact object; allowlisted product/artifact/licenses/synthetic fixtures and prompt/output format. Exclude builder ledger/scorecard/reports/notes; prove with file list, search and SHA256. Same-lineage review remains LOW.
5. **V05 = L6:** HUMAN-ACTIONS exact ordered checklist and STOP: tool logins and per-version real-agent smoke, required real-agent two-project benchmarks, five-user usability, real screen reader, optional symlink privilege decision, fresh different-vendor or human review of the exact artifact, platform/publish decisions. State exact L7 resume payload. Agent never logs in or publishes.
6. **L7 only after user resume/evidence:** ingest independent report verbatim+hash, triage valid/invalid-with-evidence/out-of-scope, fix valid findings one by one (max3 rounds), rebuild/retest/hosts/scoped commits; code change invalidates exact-object review until reviewed again. Ingest smoke/usability/accessibility. No required open finding can be called complete.

Final per-tool score = `(STRONG + 0.5*PARTIAL)/applicable*100`, including applicable UNVERIFIED/NONE in denominator. Overall micro-average only over supported applicable tool/check pairs; show each tool and lowest tool. Target80% is a goal, not a guaranteed outcome. N/A requires frozen reason; unsupported tools NOT COVERED. Show old ten-scenario and hostile same-user informational arithmetic; hostile same-user is out of Lite scope.

Final requirement caps: R1<=6, R2<=9, R3<=7, R4<=6 without human usability/screen-reader or<=8 with them, R5<=6, R6<=6 if current clean-profile ease unmeasured. Explain arithmetic. PROVISIONAL unless exact-object independent review>=MEDIUM and no valid finding open. Rehash final VSIX immediately before reporting. Original final answer: Hinglish, max14 lines, honest claim/config/tool/platform/independence/residual/remaining list. Do not issue an interim numeric rating.

## 8. Commands and evidence patterns to reuse safely

F10 helper: `docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/run-f10-check.ps1`. It writes a new `.txt` and `.txt.result.json` with exact argv/native exit/raw SHA and refuses evidence overwrites. Example from repo root (pick unused names):

```powershell
& 'docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/run-f10-check.ps1' -Name resume-typecheck-02 -Typecheck
& 'docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/run-f10-check.ps1' -Name resume-pty-commands-before-01 -Tests @('powerShell51Terminal.test.ts','checkedPowerShellCommands.test.ts')
```

Existing root helper: `docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1`. Test TEMP/TMP is `D:\SoterAI-Lite-test-profiles\f03-unit-temp`; existing isolated profile parent `D:\SoterAI-Lite-test-profiles`. D: writes/GUI/tests use required environment escalation. Do not replace `$HOME` or `$CODEX_HOME` variables.

Compiler: `node node_modules/typescript/bin/tsc -p packages/vscode-extension/tsconfig.json --noEmit`. Full suite cwd `packages/soterai-lite`: `node --import tsx --test --test-concurrency=1 ../vscode-extension/src/__tests__/**/*.test.ts`. Serial heavy runs only. Package: `node packages/soterai-lite/scripts/package.cjs <new-unique-vsix-path>`; inspect actual package. Rebuild guard-core dist first if changing source imported via its dist; F10 currently imports new core sources directly.

Reuse F09 scripts as **templates with new paths/names/hashes**, not reruns overwriting their evidence: `run-final-local-02.ps1`, `inspect-vsix-01.ps1`, `run-native-01.ps1`, `run-affected-hosts-01.ps1`, `f09-evidence-lib.cjs`, `commit-f09.ps1`, `verify-and-advance.cjs`. New F10 native host driver still needs authoring. Existing actual Code path `C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe`. Cached older Code is not proof for current editor.

Local Git staging uses exact allowlist and existing offline hook directory `docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks` with command-local `-c core.hooksPath=...`; byte staging can use `-c core.autocrlf=false`. Do not change persistent Git configuration. Save every raw command/exit/hash, verify committed blobs and no unexpected paths, then separately verify transition commit. Accepted artifact need not be a Git blob; retain/hash physical artifact and bind it explicitly in acceptance.

At handoff unrelated tracked changes include ML scores/scripts, JetBrains Gradle fileHashes, and extension phase2 results.jsonl. Other generated profiles/runtimes/scratch untracked files also exist. Preserve/exclude them; use checkpoint's tracked list and an explicit feature allowlist, not a clean-worktree assumption.

Already-completed backup/space work: D:\SoterAI-backups\security-hardening.bundle SHA256 cc2974fe3dcda234cb9a238e514b933758859c75ee534ae313ccd768032857c9; incremental soterai-lite-20261013-88fb9432.bundle SHA256 0187a0f025a1f80074c3d46c7a7b04f5ecb88d6b3f25695227103737512cb6eb6 depends on base. Verified C: duplicates were removed with user approval. Old12 synthetic profiles retained under D:\SoterAI-Lite-test-profiles\retained-profiles-20261014-ccadf7b398d94a87a203dd98fbb1c0ab. Do not redo these moves/cleanup. Full fsck remains resource-limited FAIL/full integrity UNVERIFIED; connectivity-only PASS, not proof of corruption or full integrity.

Keep new-chat context small: read this checkpoint once, then current design/source/test excerpts; give concise feature progress, keep raw output in files, append ledger and maintain a short updated resume note after each verified card. Continue authorized work from F10 instead of replanning completed stages.
