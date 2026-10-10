# Evidence-based scorecard

**INFERENCE — 2026-10-11, Windows 26300.8935; headline 2/10 PROVISIONAL.** Scores follow the owner's rubric and are engineering judgments, not guarantee percentages. Prior S5 independence LOW; current-object independent review NOT_PERFORMED. [Real extra-round results](evidence/EXTRA-TST01-20261010/evaluation.json).

| Dimension | Score / arithmetic | Evidence and limit |
|---|---|---|
| D1 managed accidental-exposure reduction | **8/10**; raw8, passing-suite/current-host ceiling8 | Full suite passes; eight managed observations blocked, public/denied/retained controls verified. [Seventeen-case comparison](evidence/EXTRA-TST01-20261010/host-comparison.json). Unmarked diagnostic FAIL disclosed. 9+ requires stronger independence; no unmanaged path coverage. |
| D2 hostile same-user confidentiality, full T | **2/10**; min(raw2, reproducible same-user-leak cap3)=2 | Nine current leaks in existing host; no independent custody/presence/mandatory egress. The max4 alternative cannot override the tighter cap3; BlockP/Tier3 caps unavailable. |
| D3 Agent-account mode | **NOT RATED** | Pilot not run; no account/firewall/session changes or effective controls verified. |
| D4 honest coverage | **8/10**; raw8 −2×0 identified unsupported current canonical claims=8; max9 | Actual manual ALLOW/BLOCK controls pass; loaded hashes, leaks and gaps disclosed. Limited source/UI audit; published assets and trusted effective receipts remain untested. No exhaustive zero-overclaim assertion or G6 PASS. |
| D5 engineering/reproducibility | **9/10**; historical clean build3/3 + current full suites2/2 + flags/rollback2/2 + hashes1/1 + regression scope1/2=9 | [Controls](evidence/EXTRA-TST01-20261010/controls.log), [diff](evidence/EXTRA-TST01-20261010/repair.diff), both loaded identities. Product bytes match prior clean build; no fresh install repeated. One point withheld for unexecuted real lifecycle/agent regressions and missing higher independence; skips are not passes. |

**INFERENCE — Headline.** min(D2=2,D4=8)=**2/10 PROVISIONAL**. D1/D5 improvements cannot raise confidentiality. D3 has no numeric proxy.

**INFERENCE — Remaining ceiling.** Exact-object independent review, deployed independent authority/consent/custody/mandatory egress, applicable A01–A30 and real-agent evidence are required for stronger claims. The test-only repair and diagnostic host runs do not implement those boundaries. Full claim BLOCKED, deployment DEFERRED.

**FACT — Historical hash qualification.** Indexing found pre-existing raw-hash mismatches in three S0 records and referenced historical files (see validation for exact paths). This isolated checkout matches their fa4ff283 Git blobs byte-for-byte; the old manifest hashes match CRLF reconstructions of those LF blobs. No historical file was changed in this repair. The prior raw working-tree hash manifest and committed-source checkout differ for those recorded files; this is disclosed rather than called a byte-exact preservation pass. [Validation](evidence/EXTRA-TST01-20261010/preservation-validation.json) pins both hashes and the proof. A0, original reviewer and all remaining immutable indexed bytes match; current hashes are local identities, not independent witness evidence.
