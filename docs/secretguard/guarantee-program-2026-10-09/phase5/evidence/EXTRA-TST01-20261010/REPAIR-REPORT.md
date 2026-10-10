# One additional TST-01 and host repair round

**FACT — 2026-10-10T18:22:19.1917058Z, Windows 26300.8935.** Explicit owner authorization grants one extra test-only round. Main checkout remains on release/n8n-0.8.8; this isolated security checkout starts at fa4ff283fc781e55c454ad01924b9c4c96ae6479. Product source and bundle bytes are unchanged. [Exact repair diff](repair.diff) replaces the nonexistent showDecision lookup with presentDecision and explicitly asserts ALLOW/BLOCK/notification controls. [Three pre-harness controls](controls.log) PASS before the harness logging refinement.

**FACT — Repository expectation history.** [Old source Git blob](old-securityReview.host.git-blob.ts.txt), extracted from bf5e563ba73a5afeb6a2ef72d29cfbac93b42ce1, retains the old assertion requiring a leak after emptying .aiignore. S6 had already replaced that assertion with observed-canary reporting; this extra round adds explicit retained-deny identity and control receipts only. Accepted-deny deletion/replacement/fresh-snapshot control and public-versus-denied gathering control PASS before this change. In the actual host, public-before-enrollment=true, denied-after-enrollment=true, retained-after-removal=true. No force-pass or removal of a test gate: a leaked canary still records LEAK_CONFIRMED. A0 JSON hash remains 4b500b62bdb9acb4c969ea4b083495f34b6307a7d9982d34bfb4bb67be8767b2. Historical A0, failed S4/S6 and original reviewer grades are unchanged.

**FACT — Path repair by invocation.** Output root is C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\.tmp\s5cc-eb9ac581\.tmp\r4; the existing wrapper/preparer are unmodified. Native working directory C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\.tmp\s5cc-eb9ac581\.tmp\n4\verify-20261010T182729Z-2b878662519a4921af6cb37353b3d48e\native-baseline-runs\host-4f62283c37bb38c886c1c94f\workspace has 199 characters and launched successfully. Raw original is preserved; [archive](raw/) retains original absolute locations rather than pretending another execution. No process close/kill, normal-profile installation, new scenario or product behaviour change.

**FACT — Suites.** 1341 tests: 1338 PASS / 0 FAIL / 3 skipped, five typechecks/builds PASS. Three separate targeted controls are not added to this full-suite denominator. S5-unmarked diagnostic remains FAIL and H2a/H2e remain SKIP; those diagnostic dispositions are separate from expected-result suite success. [Raw summary](raw/summary.json) and [evaluation](evaluation.json).

**FACT — Actual loaded extension SHA-256.** SecurityReview and NativeBaseline both read back ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b; VS Code 1.104.0, extension 0.6.3. SecurityReview harness PASS; NativeBaseline harness FAIL with R01 INCOMPLETE; confidentiality FAIL. No final-object independent review or real-agent/model invocation.

| Existing case | A0 | Current | Disposition |
|---|---|---|---|
| .env redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| .env direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| nested/private.txt redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| nested/private.txt direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| private.pem redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| private.pem direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| selected.txt redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| selected.txt direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| hardlink direct read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| hardlink redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| junction direct read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| junction redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| repository deny rule | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| agent edits repository deny policy | LEAK_CONFIRMED | BLOCKED_SCOPED | PASS; CHANGED |
| runtime environment and command output | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| Git object after working-tree replacement | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| encoded chunked exfiltration | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |

**FACT — NativeBaseline is a separate existing diagnostic set.** {"IDENTITY_VERIFIED":1,"PUBLIC_CONTROL_PASS":6,"BLOCKED_SCOPED":9,"LEAK_CONFIRMED":9,"ERROR":1}. Do not merge these into the seventeen A0 SecurityReview cases.

| ID | Operation | Actual result |
|---|---|---|
| IDENTITY | activate frozen supplied build | IDENTITY_VERIFIED |
| C01 | public preview positive control | PUBLIC_CONTROL_PASS |
| C02 | ordinary nested file before folder mark | PUBLIC_CONTROL_PASS |
| C03 | ordinary selection file before region mark | PUBLIC_CONTROL_PASS |
| P01 | marked preview .env | BLOCKED_SCOPED |
| L01 | marked original direct read .env | LEAK_CONFIRMED |
| P02 | marked preview nested/private.txt | BLOCKED_SCOPED |
| L02 | marked original direct read nested/private.txt | LEAK_CONFIRMED |
| P03 | marked preview private.pem | BLOCKED_SCOPED |
| L03 | marked original direct read private.pem | LEAK_CONFIRMED |
| P04 | marked preview selected.txt | BLOCKED_SCOPED |
| C04 | unmarked region remains useful | PUBLIC_CONTROL_PASS |
| L04 | marked original direct read selected.txt | LEAK_CONFIRMED |
| L05 | hardlink direct read | LEAK_CONFIRMED |
| P05 | hardlink scoped preview | BLOCKED_SCOPED |
| L06 | junction direct read | LEAK_CONFIRMED |
| P06 | junction scoped preview | BLOCKED_SCOPED |
| C05 | repo-rule public control | PUBLIC_CONTROL_PASS |
| P07 | repo deny active | BLOCKED_SCOPED |
| L07 | agent removes repo deny | BLOCKED_SCOPED |
| L08 | synthetic environment reaches child stdout | LEAK_CONFIRMED |
| C06 | history working-tree positive control | PUBLIC_CONTROL_PASS |
| P08 | history path manual deny active | BLOCKED_SCOPED |
| L09 | Git object under marked path | LEAK_CONFIRMED |
| L10 | receiver reconstructs protected value | LEAK_CONFIRMED |
| R01 | real native broker restart/runtime state | ERROR |

**INFERENCE — Limits/rollback.** 9 currently observed leaks remain outside the managed preview boundary; repo-deny retention is scoped and does not supply independent policy custody. Keep all30 full criteria UNTESTED and all63 real-agent cells NOT_TESTED; missing control-auth-token, same-user custody, clipboard/buffers/history/process/network and pilot gaps remain. Rollback withdraws the affected checks/release, preserves accepted denies/secure ACLs and evidence, and never restores the old required-leak expectation as a product permission. Revert only these two test-file edits if necessary; do not execute a weaker product. No extra engineering retry remains authorized. Full claim BLOCKED, deployment DEFERRED.

**FACT — Execution-input recovery and gate accounting.** First combined wrapper exit1 is preserved: SecurityReview completed, then NativeBaseline preparation reported ENOENT for the isolated checkout's absent phase0/evidence/baseline-final/inventory.json; [first summary](raw/summary.json) and exact [preparation error](raw/native-prepare.log). The existing original inventory was copied without regeneration, SHA-256 144a3244a5fd2a1aef01f9ca3fa9911c315abd3daf722fac064e017d05312918; [copy receipt](inventory-input-copy.json), [archived input](baseline-input.inventory.json). The native-only wrapper retained the full-suite gate and recorded the identical 1338 PASS/0 FAIL/3 skips before launch: [native summary](native-raw/summary.json), [native completion](native-completion.json). Suite totals count one complete run, not both gates added together. NativeBaseline finishes with one R01 ERROR: its synthetic broker could not start because loopback port47321 was occupied. R01 is INCOMPLETE and the native harness exit is1, not PASS. No process was closed/killed or port reassigned, and no additional test/product repair occurred. Native working directory length 199 characters; original outputs and failed preparation remain untouched.

**FACT — R01 exact runtime message.** http://127.0.0.1:47321 is already in use, so the local AI broker cannot start there. If another editor is already running SoterAI, give this one its own port with the "soterai.broker.port" setting. No restart/grant/coverage guarantee is inferred from this failed precondition. [Raw native result](native-raw/native-baseline-runs/host-4f62283c37bb38c886c1c94f/results.json) retains the ERROR; evidence disposition INCOMPLETE. [Archive scope](archive-scope.json) excludes generated profile credentials and workspace reparse fixtures; their originals remain untouched, and no credential contents are read for this archive.

**FACT — Historical hash qualification.** Indexing found pre-existing raw-hash mismatches in three S0 records and referenced historical files (see validation for exact paths). This isolated checkout matches their fa4ff283 Git blobs byte-for-byte; the old manifest hashes match CRLF reconstructions of those LF blobs. No historical file was changed in this repair. The prior raw working-tree hash manifest and committed-source checkout differ for those recorded files; this is disclosed rather than called a byte-exact preservation pass. [Validation](preservation-validation.json) pins both hashes and the proof. A0, original reviewer and all remaining immutable indexed bytes match; current hashes are local identities, not independent witness evidence.
