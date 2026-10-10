# Release and claim gate

**FACT — Superseding extra-round status, 2026-10-11.** One explicitly granted test-only repair round fixes TST-01; five typechecks/builds and 1338/1341 tests PASS (3 skipped, zero failed). Both existing hosts ran (SecurityReview harness PASS; NativeBaseline harness FAIL/R01 INCOMPLETE) with actual loaded extension ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b; SecurityReview eight scoped blocks/nine leaks, NativeBaseline observations recorded separately. [Current results](evidence/EXTRA-TST01-20261010/REPAIR-REPORT.md), [all17 A0 comparisons](evidence/EXTRA-TST01-20261010/host-comparison.json). Earlier S4/S6 failures and historical statements below retain their original time/scope and are superseded for current status only. S5-unmarked FAIL,30 full criteria UNTESTED,63 cells NOT_TESTED, exact-object review NOT_PERFORMED; full claim BLOCKED/deployment DEFERRED.

**FACT — 2026-10-10, Windows26300.8935.** Candidate release **WITHHELD**: full suite now PASS, both hosts complete with confidentiality FAIL; missing full architecture/exact-object review; full G1–G6 claim BLOCKED, deployment DEFERRED. No publishing permission is inferred from a local commit or this review layout.

| Gate | Current result | Required disposition |
|---|---|---|
| Five target typechecks/builds | PASS; root/clean byte-match | Cite exact source and artifact hashes; this is build evidence |
| Complete unit/integration suites | PASS:1,338 pass/0 fail/3 skips | TST-01 repaired; preserve old failure, skips and separate diagnostic FAIL |
| Existing isolated host checks | SecurityReview harness PASS; NativeBaseline harness FAIL/R01 INCOMPLETE; confidentiality FAIL | Actual loaded hash pinned; eight managed blocks/nine leaks; no universal protection claim |
| Historical negative controls | A0 confidentiality FAIL; S5-unmarked current FAIL | Preserve both, disclose independent direct-access paths and unmarked semantics |
| Restricted reviewer | LOW on old S2 object; final changed extension NOT_PERFORMED | Keep verbatim findings; require exact-object independent evidence for stronger claims |
| Full architecture A01–A30 |30 UNTESTED | No full default-deny, independent presence, durable denial, mandatory egress, inaccessible at-rest secrets or trusted-effective-coverage claim |
| Real-agent/platform/editor matrix |63 NOT_TESTED | No certification of named agents, Cursor fork versions, remote/container placement or other OS builds |
| Broker controller credential | Missing/INCOMPLETE; synthetic handling PASS | Do not claim real controller provisioning/startup tested |
| Pilot/Tier3/container runtime | Not run/deployed | No account isolation or container/OS allowlist success claim |
| Package/artwork | Static exclusion/reference regressions PASS; local layout not a VSIX | Retired media/marketplace and screenshots excluded; no new package installation/publication evidence |

**INFERENCE — Permitted README/marketplace language.** Describe local heuristic detection, named managed preview/exclusion, routed broker filtering and scoped capability checks with evidence and their limitations. Ordinary modals are labelled not agent-proof. Explain Covers / Does not cover before scoped setup results. Use PASS only for its exact executed component; use STATIC-ONLY, INCOMPLETE and UNTESTED for missing boundaries. The allowed-claims.txt sentence defines its47 evidence dispositions and excludes unit/diagnostic/historical result counts.

**INFERENCE — Prohibited claims.** No all-agent confidentiality, invisible secrets, universal safe-to-send verdict, global blocked transmission from a manual checker, fully enforced/verified routing from configuration, zero known gaps, inaccessible same-user vault, host-loaded candidate without receipt, independent verification of the revised extension, or agent/account/container support certification. Do not re-use old screenshots/GIF as current enforcement evidence; existing remote published assets remain unreviewed and unmodified.

**INFERENCE — Rollback/release response.** Withdraw the release and disable the affected guarded operation if needed. Preserve accepted deny state, secure broker DACLs and all evidence. Never load a weaker old binary, use legacy Git/auth/policy paths, reinstate unsupported artwork, weaken the suite gate or restore group token read to obtain a success state. No system state was changed by S6/S7, so no system restore operation is required.
