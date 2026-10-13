# P03 frozen item matrix

Date: 13 October 2026. State: **FROZEN BASELINE**. Test specification only; no production code, tests or model runs have been performed by this draft. Every catalog check and every candidate tool applicability/support column is **UNVERIFIED**. Numerical scores and interim ratings are absent.

This matrix follows the current [implementation plan](IMPLEMENTATION-PLAN.md) and links [LITE-CATALOG.json](LITE-CATALOG.json). Root must validate/freeze the final files and record their SHA-256 after the P02/new-bundle baseline, before F01 authoring/implementation. Planning allocations are not passing coverage.

The category minima total **42**, despite the original overall minimum wording of 40. This draft contains **44 unique checks**: file8, terminal/environment8, network8, Git/history4, editor/clipboard/UI4, config/CI/build8 (minimum6), logs/test/debug2, self-hygiene2. Definitions stay immutable after freeze; outcomes/evidence go into a separate catalog-hash-bound result file.

## Pinned candidate columns

| Candidate ID | Installed version supplied by root | Surface | Support/applicability today |
| --- | --- | --- | --- |
| clineIde | 4.1.23 | Cline VS Code extension | UNVERIFIED |
| claudeIde | 2.1.296 | Claude Code VS Code extension | UNVERIFIED |
| claudeCli | 2.1.292 | Claude Code CLI | UNVERIFIED |
| codexIde | 0.162.0-alpha.17.2 | Codex VS Code extension runtime | UNVERIFIED |
| codexCli | 0.160.1 | Codex CLI | UNVERIFIED |
| geminiCli | 0.55.1 | Gemini CLI | UNVERIFIED |

Inventory/version pinning does not establish authentication, actual-tool routing or support. IDE/CLI receipts remain separate. A mocked adapter, supplied-context response, merely installed extension or generic current documentation cannot turn an unverified candidate green. Actual-version mechanisms and assumed routes must be established in evidence. Unverified/failed applicable rows cannot become N/A to improve a later result.

## Original upgrades and stage requirements

| Original item | Required scope | Work cards | Catalog IDs | Acceptance boundary |
| --- | --- | --- | --- | --- |
| U1 | Custom masked env/sensitive editor; owner reveal; association diff/undo; plaintext-open warning | F05,F06,F27 | LS-03,LS-29,LS-30,LS-32,LS-43 | Actual CustomDocument/TextDocument distinction; owner-only reveal is not an independent-agent secrecy boundary. |
| U2 | Optional vault migration, placeholders, OS store, app/task/debug injection, example and full recovery | F06,F09,F07,F08 | LS-03,LS-11,LS-15,LS-30,LS-37,LS-38,LS-41 | Migration/runtime are separate sequential cards; fake app and fake credentials only; native process inspection remains uncovered. |
| U3 | PS5.1/PS7/Git Bash/cmd profiles; protected reads/env/Git/detectable interpreters; encoded/chunked/ANSI output | F04,F07,F08,F10,F11,F12,F13,F26 | LS-09,LS-10,LS-11,LS-12,LS-13,LS-14,LS-16,LS-25,LS-28 | Declared checked-command grammar only; shell creation/hooks do not establish universal command interception. |
| U4 | Exact-version detection/docs, vendor controls, safe-read MCP, reviewed config diff/backup/undo, truthful badges | F17,F18,F19,F20,F30,F32 | LS-01,LS-02,LS-03,LS-04,LS-05,LS-16,LS-23,LS-24,LS-38 | Cline, Claude IDE/CLI, Codex IDE/CLI and Gemini stay separate unverified candidates until actual-route evidence. |
| U5 | Gateway decoders, encodings/patterns/entropy, split messages, fail-closed policy/budgets, ports/windows, audit/self-test | F07,F08,F14,F15,F16,F30 | LS-17,LS-18,LS-19,LS-20,LS-21,LS-22,LS-23,LS-24,LS-43 | Real loopback byte path and positive receiver oracle; no independent-egress mediation claim. |
| U6 | Workspace hygiene/move/vault suggestions, example, exposure ledger and rotation checklist | F06,F21,F22,F23,F24,F25 | LS-08,LS-21,LS-26,LS-33,LS-34,LS-35,LS-36,LS-37,LS-38,LS-39,LS-42 | Agent verification uses fixtures; no real project secrets scanned. Checklist is not proof rotation occurred. |
| U7 | Source/history/config/CI/artifact/maps/log scanners; reviewed fixes; optional Git and PSReadLine hooks | F22,F23,F24,F25,F26 | LS-25,LS-26,LS-27,LS-28,LS-33,LS-34,LS-35,LS-36,LS-37,LS-38,LS-39,LS-41,LS-42 | Separate family/hook subcards; history read-only; pre-push uses local fixture; no automatic destructive fixes. |
| U8 | 200+ stack/default patterns, additive team policy, import/export, owner relaxation, drift, versions/downgrade | F01,F02,F03,F04,F28,F30,F32 | LS-01,LS-02,LS-03,LS-04,LS-06,LS-07,LS-38,LS-40 | Pattern count/dedup and public near-matches; failure/cancel/replay cannot relax existing stronger denies. |
| U9 | Owned logs/crash metadata/telemetry/memory-copy hygiene and value-free audit | F07,F08,F14,F16,F17,F27,F31 | LS-30,LS-41,LS-42,LS-43,LS-44 | Telemetry off by default; transient processing memory and arbitrary native crash dumps are not certified secret-free. |
| U10 | Large-repo/startup budgets, fail-closed graceful degradation, symlink/junction/parent-race handling | F01,F04,F14,F28 | LS-07,LS-13,LS-16,LS-22,LS-40,LS-44 | Set budgets before fixtures; record capability-dependent skips, do not treat them as PASS. |
| L2 | One sidebar Protected items/Activity/Coverage; exact consent; Explorer/status/undo; under-2min onboarding; axe/keyboard/contrast/motion/localization; self-test | F04,F29,F30,F32 | LS-01,LS-04,LS-16,LS-24,LS-29,LS-30,LS-31,LS-32,LS-40,LS-44 | Raw per-surface results/last-verified identity only during development; no interim rating. Five-user and native screen-reader gates remain human. |
| L0 / P00-P03 | Waiver receipt, scoped preserve/fsck/backup, split, inspected new baseline VSIX, frozen catalog and matrix | P00,P01,P02,P03 | LS-40,LS-44; baseline observations for LS-01..LS-44 | This draft does not freeze IDs/statuses or replace old evidence. Root freezes only after P02 baseline/route assumptions. |
| L3 / V01-V02 | Full/property/fuzz/mutation checks, actual hosts/shells/tool loopback, retained17 baseline, budgets/stress, two fake development benchmarks | V01,V02 | LS-01..LS-44 | Compare Node/Express fake DB and Next.js fake APIs protection on/off; mocks are not authenticated model evidence; retain maximum-three-round policy. |
| L4 | win32-x64 content/license/icon/changelog/privacy/trust/virtual-workspace/SBOM/audit; only-VSIX clean-profile onboarding/upgrade/restore; owner publishing runbook | F31,F32 | LS-16,LS-32,LS-38,LS-40,LS-43,LS-44 | Default onboarding under120seconds/admin0/extra installs0. Linux/macOS/remote NOT_TESTED. Prepare pre-release/OpenVSX procedure; never publish. |
| L5 / V04 | Neutral reviewer prompt, exact-object verifier kit, synthetic dynamic fixture, findings format, excluded builder material and hash/file proof | V04 | LS-44; independent recheck of all claimed LS rows | Packet excludes ledger/scorecard/final reports/builder notes. Same-lineage review remains LOW independence. |
| L6 / V05 | HUMAN-ACTIONS then STOP: login/smoke, real benchmarks, five users, screen reader, optional symlink privilege, fresh independent review, platform/publish decisions | V05 | LS-05,LS-07,LS-24,LS-29,LS-30,LS-32,LS-44; affected supported-tool rows | Exact artifact/catalog identities and evidence paths in resume payload; no final rating while required acceptance is pending. |
| L7 | Verbatim independent-report hash/triage, serial fixes/regressions/rebuild/host/local commit, supplied smoke/usability results, honest final identity | L7 | Every finding's linked LS IDs; LS-24,LS-32,LS-44 | Changed object is NOT independently reviewed unless reviewed again; required open findings block complete verdict; no rewritten reviewer grades. |

## Every implementation card

Each row follows the one-active-feature rule. F15 decoder subcards, F20 tool subcards, F22 family subcards and F26 hook/history subcards complete separately. A card's linked checks identify the surfaces it can affect; the row does not promise that every whole-catalog check becomes STRONG after that card. Shared changes reopen affected earlier verification.

| Card | Feature | Linked catalog IDs |
| --- | --- | --- |
| F01 | Reliable saved restrictions and truthful results | LS-01, LS-02, LS-03, LS-04, LS-06, LS-07, LS-31, LS-32, LS-37, LS-40 |
| F02 | Versioned policy/defaults | LS-02, LS-05, LS-07, LS-34, LS-35, LS-36, LS-37, LS-38, LS-40 |
| F03 | Policy drift and explicit relaxation | LS-04, LS-32, LS-38, LS-40 |
| F04 | One-time safe-read consent | LS-01, LS-03, LS-04, LS-06, LS-07, LS-08, LS-09, LS-10, LS-31, LS-32, LS-34, LS-35, LS-36, LS-37 |
| F05 | Secure masked env editor | LS-03, LS-29, LS-30 |
| F06 | Vault migration/recovery | LS-03, LS-15, LS-30, LS-37 |
| F07 | Registered-value matching | LS-13, LS-14, LS-15, LS-17, LS-18, LS-19, LS-20, LS-21, LS-25, LS-31, LS-39, LS-41, LS-42, LS-43 |
| F08 | Streaming output redactor | LS-09, LS-10, LS-13, LS-14, LS-15, LS-19, LS-25, LS-31, LS-41, LS-42, LS-43 |
| F09 | Vault run/task/debug | LS-11, LS-13, LS-15, LS-38, LS-41 |
| F10 | PowerShell 5.1 managed profile | LS-09, LS-10, LS-11, LS-12, LS-13, LS-16, LS-25, LS-28 |
| F11 | PowerShell 7 managed profile | LS-09, LS-10, LS-11, LS-12, LS-13, LS-16, LS-25, LS-28 |
| F12 | cmd managed profile | LS-09, LS-10, LS-11, LS-12, LS-13, LS-16, LS-25 |
| F13 | Git Bash managed profile | LS-09, LS-10, LS-11, LS-12, LS-13, LS-16, LS-25, LS-28 |
| F14 | Broker lifecycle/window ownership | LS-16, LS-22, LS-23, LS-43, LS-44 |
| F15 | Gateway decoders (a-h separate subcards) | LS-17, LS-18, LS-19, LS-20, LS-22 |
| F16 | Gateway per-tool policy/self-test | LS-17, LS-18, LS-19, LS-20, LS-21, LS-22, LS-23, LS-24, LS-43 |
| F17 | Reviewed safe-read MCP | LS-01, LS-02, LS-03, LS-04, LS-05, LS-07, LS-24, LS-38, LS-43 |
| F18 | Cline pinned adapter | LS-01, LS-02, LS-03, LS-05, LS-11, LS-17, LS-20, LS-23, LS-24, LS-29, LS-38 |
| F19 | Claude Code pinned adapters | LS-01, LS-02, LS-03, LS-05, LS-11, LS-17, LS-20, LS-23, LS-24, LS-29, LS-38 |
| F20 | Other pinned adapters individually | LS-01, LS-02, LS-03, LS-05, LS-11, LS-17, LS-20, LS-23, LS-24, LS-29, LS-38 |
| F21 | Secrets hygiene/exposure ledger | LS-08, LS-21, LS-26, LS-27, LS-33, LS-34, LS-35, LS-36, LS-37, LS-39, LS-42 |
| F22 | Config scanner families individually | LS-27, LS-33, LS-34, LS-35, LS-36, LS-37, LS-38 |
| F23 | Read-only Git history scanner | LS-25, LS-26 |
| F24 | Build/artifact/source-map scanner | LS-08, LS-33, LS-39 |
| F25 | Logs/test/debug protection | LS-13, LS-14, LS-41, LS-42 |
| F26 | Pre-commit/pre-push/history opt-ins individually | LS-27, LS-28 |
| F27 | Extension self-hygiene | LS-30, LS-31, LS-41, LS-42, LS-43, LS-44 |
| F28 | Path races/performance/degradation | LS-02, LS-06, LS-07, LS-08, LS-16, LS-22, LS-39, LS-40 |
| F29 | Protection Center | LS-08, LS-32 |
| F30 | Verify my setup | LS-05, LS-24, LS-32, LS-40, LS-44 |
| F31 | Marketplace package preparation | LS-44 |
| F32 | Install/upgrade/removal lifecycle | LS-16, LS-23, LS-32, LS-40, LS-44 |

## F01 regression and host traceability

These are proposed acceptance IDs from the read-only F01 design, **not existing passed tests**. Author only after catalog freeze. The key failing-save regression uses the existing stub memento's update rejection for RULES_KEY, checks unchanged prior storage and explicit FAILED, and proves that the privacy wrapper cannot transform swallowed errors into REQUEST_HANDLED/completed feedback.

| Check | Proposed F01 test IDs |
| --- | --- |
| LS-01 | F01-U01, F01-U02, F01-U03, F01-U04, F01-U08, F01-U09, F01-U10, F01-U11, F01-U13, F01-U14, F01-U15, F01-U16, F01-H01, F01-H02, F01-H04, F01-H05 |
| LS-02 | F01-U05, F01-U04, F01-U06, F01-U07, F01-U10, F01-U13, F01-H03 |
| LS-03 | F01-U04, F01-U05, F01-U11, F01-U12, F01-U13, F01-U14, F01-H05 |
| LS-04 | F01-U06, F01-U08, F01-U09, F01-U14 |
| LS-06 | F01-U04, F01-U05, F01-U08, F01-U13, F01-H03 |
| LS-07 | F01-U07, F01-U10, F01-U13 |
| LS-31 | F01-U05, F01-U13, F01-H03 |
| LS-32 | F01-U01, F01-U02, F01-U06, F01-U15, F01-H01, F01-H02, F01-H05 |
| LS-37 | F01-U04, F01-U05, F01-U11, F01-U12, F01-U13 |
| LS-40 | F01-U04, F01-U07, F01-U10, F01-U11, F01-U12, F01-U13, F01-U14 |

F01-U01..U16 cover truthful ordinary/direct outcomes, failed saves, retained stronger records, file/folder/glob/region writes, cancellations/path/policy errors, awaited completion, queue recovery, idempotence/limits, reload, safe flag withdrawal, actual dashboard command outcome and ambiguous post-commit failure. H01..H05 use an exact installed VSIX for ordinary result/inventory, selected nonexistent synthetic path, native folder/glob/region behavior, a second-launch persistence receipt and flag/cancel/sensitive regression.

The current production activate returns no test-accessible memento. A registered-command missing-path failure is an actual-host error-path control; it is **not** a native disk-storage-failure test. Memento rejection in the existing VS Code stub is a component test. Do not blur those results or ship an unrestricted failure-injection command.

## User-demand traceability

| User requirement | Main catalog IDs | Limit that remains visible |
| --- | --- | --- |
| R1 secrets not readable by AI | LS-03, LS-05, LS-07, LS-10, LS-11, LS-15, LS-17..LS-24, LS-29, LS-30, LS-37, LS-43 | Managed/cooperative routes only; arbitrary same-user originals/processes/other buffers remain outside Lite |
| R2 owner can easily restrict project files | LS-01, LS-02, LS-04, LS-06, LS-32, LS-40 | Confirmed persistence, explicit failure and retained deny are required; repository storage is not independent custody |
| R3 terminal approval plus sensitive masking | LS-03, LS-04, LS-09..LS-16, LS-25 | Declared checked grammar and actual available shell only; approval never releases original sensitive values |
| R4 professional usable UX | LS-29..LS-32, LS-44 | Actual host and browser checks differ; five-user usability and native screen reader are separate human evidence |
| R5 leak surfaces inside project | LS-01..LS-44 | Detection/scanning does not revoke history/past copies or mediate independent uploads |
| R6 download/install ease | LS-16, LS-32, LS-44 | Only exact tested VSIX; clean-profile default startup under120seconds/admin0/extra installs0; reviewed optional routing/vault workflow cost remains explicit |

## Evidence and safe mutation protocol

For each declared supported tool/check retain: catalog identity, feature/test ID, synthetic fixture identity, actual pinned tool/version, source/diff identity, current VSIX SHA, packaged runtime SHA, loaded host SHA, redacted configuration fingerprint, exact command/time/exit and hashed raw results. Keep positive public behavior, negative confidentiality, cancellation/failure, safe rollback and feature dependency distinct. Keep retries/failures immutable.

Feature-off **withdraws the managed operation and preserves denies**, never restores originals. A combined functional test may fail only because public availability is withdrawn; label that mutation AVAILABILITY_ONLY. It alone does not demonstrate prevention sensitivity. A separate synthetic canary intentionally delivered by the loopback harness proves the receiver oracle can detect leakage. STRONG still requires prevention by design, positive/negative controls and honest item-linked mutation evidence. Use PARTIAL/UNVERIFIED when evidence is insufficient; no forced target.

Required skips remain NOT_TESTED/UNVERIFIED. Optional unavailable platform decisions need recorded reasons and visible limits; a failed supported route may not be removed from applicability. No interim scores are calculated here. Final supported-only arithmetic and prerequisite human gates remain in the implementation plan.

## Informational native controls

The catalog contains separate HS-01..HS-10 observations for native original/key reads, aliases, unrelated terminal/interpreter/env/process reads, native Git history, independent loopback uploads, other buffers/clipboard, same-user policy/consent changes and unknown prose/cipher/prior-exposure/memory. These are **informational out-of-Lite-scope controls**, not additional LS checks or support evidence.

Retain original SecurityReview/native failures when rerunning the new bundle. Out-of-scope labels do not authorize turning a failed applicable cooperative check into N/A, discarding a leak, or inflating a later numerator. Synthetic loopback controls never access this workspace's real secret files.

## Remaining freeze and handoff gates

P03 is not complete merely because these drafts exist. Root must validate definitions/counts, resolve pinned route assumptions honestly, retain exact new-bundle baseline, write final LITE-CATALOG.json/ITEM-MATRIX.md, record hashes and commit the freeze before F01. No test case has been executed for this draft.

At original L6 write HUMAN-ACTIONS and STOP. External report path is docs/soterai-lite/independent-review-report/. Exact artifact/catalog, smoke/benchmark/usability/screen-reader/review paths and platform/publish decisions must accompany resume. Final ratings remain pending until required implementation/integration/human gates; a changed reviewed object is not independently reviewed without new matching evidence.


Freeze executed by freeze-p03.cjs after the exact-object baseline. Historical drafting instructions above describe authoring gates; the final catalog hash and commit receipt determine the current freeze. No behavior feature or supported tool is verified by this freeze.
