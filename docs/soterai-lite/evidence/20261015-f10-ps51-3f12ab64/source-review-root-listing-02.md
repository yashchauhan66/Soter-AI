# F10 root-listing review — fixture type correction and current receipts

Immutable follow-up to `source-review-root-listing-01.md`, same-lineage reviewer `/root/git_design`, independence LOW, 17 October 2026. Read existing files and calculated hashes only; no production/test edit, test/native process execution or escalation occurred. This separate note preserves the earlier review and all failed/earlier receipts.

Observed compiler09 diagnosed only the fake worker's nested cancellation-result status widening to string at fixture line44 (TS2345). The fixture now asserts that fixed literal as const. Independently removing just `status: "WITHHELD" as const` → `status: "WITHHELD"` from its current text in memory yields SHA256 `351b2780b012367c836bc30cf0c954435dbe9d5ffd852e7bc2668238bc8435d1`, exactly the original frozen fixture hash. This proves the only fixture byte change is the recorded type assertion; cases, assertions and runtime behavior are unchanged. No file was rewritten for this comparison. `root-listing-fixture-correction-01.md` records the correction and pipeline stop; its SHA256 is `1f8ec54014e3610baaf36e51171c1851b26477ef8f01fd284374a464d240c467`.

Current source/input bindings:

| Input | SHA256 |
| --- | --- |
| `packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts` | `81f5e1c43056649d99446893a5d0ef7826e59796ce58c89046d54d22b745d396` |
| `packages/vscode-extension/src/__tests__/checkedPowerShellRootListing.test.ts` | `91e01cdb058dc39b43401894c914398ecd1ec046793d4b5973ba887fba1983ab` |
| `docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/root-listing-contract-01.md` | `add31513d0cb089f00d29e09c434372c214f76483bf4e93851c57be68e8899c8` |

The production and contract hashes are unchanged from review01, so its narrow source conclusion still applies: no scoped blocker identified in the root-only metadata policy target correction.

Observed fresh `final-focused-06.txt`: **418 tests, 22 suites, 418 PASS, zero FAIL/cancel/SKIP**, runner exit0 at `2026-10-17T02:36:08.0794639Z`. All five RL root-listing controls and both PR publication-binding controls are explicitly ok. Fresh raw SHA256 `d9c34bb6431a8b99fcd950e6550b2f2aa91ee8f03aea592f1c4dc4c807afc504` matches `final-focused-06.txt.result.json`, whose exact argv includes the current corrected fixture.

Observed fresh `typecheck-10.txt.result.json`: Node `node_modules/typescript/bin/tsc -p packages/vscode-extension/tsconfig.json --noEmit`, exit0 at `2026-10-17T02:36:22.3205301Z`. Raw output is empty; fresh SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` matches the receipt. Earlier 418-test focused05 success is not treated as compiler acceptance; compiler09 remains failed historical evidence.

Current scoped disposition: the unchanged production review is bound to the corrected fixture, and the new focused/compiler gates PASS on those bytes. Full05, package04/exact artifact inspection, native04/affected hosts and local commit/byte-verification remain separate root gates. No native, independent/human, catalog, external-tool or rating promotion follows from this note.
