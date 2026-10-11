# Release and claim gate

**FACT — Superseding Gemini Phase 5 status, 2026-10-11.** Stages G1–G6 completed. Five typechecks/builds and 1338/1341 tests PASS (3 skipped, 0 failed). NativeBaseline R01 cleanly re-run in Stage G1 on free dynamic port with broker auto-start disabled (exit code 0; 1 IDENTITY_VERIFIED, 6 PUBLIC_CONTROL_PASS, 9 BLOCKED_SCOPED, 9 LEAK_CONFIRMED, 1 NOT_REPRODUCED; port collision resolved). Loaded extension bundle `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b` cryptographically verified. Independent review performed on exact final candidate object (Stages G3/G4; rated LOW independence due to same-lineage in-session execution; 0 code changes needed). Block P skipped per protocol (Stage G5). S5-unmarked diagnostic FAIL, 30 full architecture criteria UNTESTED, 62 of 63 matrix cells NOT_TESTED. Candidate release **WITHHELD**, full G1–G6 claim **BLOCKED**, deployment **DEFERRED**. Headline score: **2/10 PROVISIONAL**.

| Gate | Current result | Required disposition |
|---|---|---|
| Five target typechecks/builds | PASS; root/clean byte-match | Cite exact source and artifact hashes; this is build evidence |
| Complete unit/integration suites | PASS: 1,338 pass / 0 fail / 3 skips | TST-01 repaired; preserve old failure, skips and separate diagnostic FAIL |
| Existing isolated host checks | SecurityReview harness PASS; NativeBaseline harness PASS (R01 resolved in G1 on free port); confidentiality FAIL (9 leaks) | Actual loaded hash pinned; 8/9 managed blocks, 9 leaks; no universal protection claim |
| Historical negative controls | A0 confidentiality FAIL; S5-unmarked current FAIL | Preserve both, disclose independent direct-access paths and unmarked semantics |
| Restricted reviewer | LOW on exact candidate object `ca6a3e02...` (performed in-session per directive) | Verbatim report preserved; LOW independence caps headline score |
| Full architecture A01–A30 | 30 UNTESTED | No full default-deny, independent presence, durable denial, mandatory egress, inaccessible at-rest secrets or trusted-effective-coverage claim |
| Real-agent/platform/editor matrix | 62 of 63 NOT_TESTED | No certification of named agents, Cursor fork versions, remote/container placement or other OS builds |
| Broker controller credential | Synthetic handling PASS; real controller provisioning/startup isolated | Do not claim real controller provisioning/startup tested |
| Pilot/Tier3/container runtime | Not run/deployed (Block P skipped per protocol) | No account isolation or container/OS allowlist success claim |
| Package/artwork | Static exclusion/reference regressions PASS; local layout not a VSIX | Retired media/marketplace and screenshots excluded; no new package installation/publication evidence |

**INFERENCE — Permitted README/marketplace language.** Describe local heuristic detection, named managed preview/exclusion, routed broker filtering and scoped capability checks with evidence and their limitations. Ordinary modals are labelled not agent-proof. Explain Covers / Does not cover before scoped setup results. Use PASS only for its exact executed component; use STATIC-ONLY, INCOMPLETE and UNTESTED for missing boundaries. The allowed-claims.txt sentence defines its47 evidence dispositions and excludes unit/diagnostic/historical result counts.

**INFERENCE — Prohibited claims.** No all-agent confidentiality, invisible secrets, universal safe-to-send verdict, global blocked transmission from a manual checker, fully enforced/verified routing from configuration, zero known gaps, inaccessible same-user vault, host-loaded candidate without receipt, independent verification of the revised extension, or agent/account/container support certification. Do not re-use old screenshots/GIF as current enforcement evidence; existing remote published assets remain unreviewed and unmodified.

**INFERENCE — Rollback/release response.** Withdraw the release and disable the affected guarded operation if needed. Preserve accepted deny state, secure broker DACLs and all evidence. Never load a weaker old binary, use legacy Git/auth/policy paths, reinstate unsupported artwork, weaken the suite gate or restore group token read to obtain a success state. No system state was changed by S6/S7, so no system restore operation is required.
