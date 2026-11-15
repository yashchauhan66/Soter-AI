# Secret-protection roadmap: P0 implementation

Date: 12 November 2026. This records the first implementation slice of the approved [roadmap](ROADMAP-2026-11-12.md). It does not mark the whole roadmap or release acceptance complete.

**Implemented and verified:** recognized prefixed credential redaction; final outbound secret validation; safe handling of overlapping matches and JSON tool arguments; receipt-bound Lite packaging/CI/provenance; packaged broker regression smoke.

## Changes

- The redactor uses the detector's accepted password/API-assignment spans and its false-positive handling. Keys and quotes are preserved when the value can be safely replaced. Overlapping value spans are merged before replacement.
- The broker's safe-copy check includes recognized assignments. These do not silently become safe merely because their scoring category is warning-level.
- The exact final serialized provider body is checked before `fetch`, including bounded nested JSON in argument/metadata strings. Residual sensitive material or exhausted inspection refuses the request. Metadata that cannot be safely transformed is withheld.
- Enterprise approval does not bypass redaction. A formerly valid tool-argument JSON document that becomes invalid during redaction is withheld.
- Generated redaction markers are recognized exactly; marker prefixes/suffixes do not exempt a larger sensitive value. Registered-secret enforcement remains separate.
- Lite bundles local guard/protocol/common source directly rather than potentially stale local `dist` exports.
- Immutable package receipts bind identity, version, output path, bytes, SHA-256 and build/inventory references. A create-only pointer identifies the receipt. The resolver rechecks the receipt, actual VSIX, staged manifest and recomputed final inventory before emitting CI outputs.
- Both release workflows use that resolver; legacy artifact glob/version selection is removed. Signing revalidates the transferred artifact and checks it again after signing. Packaged-broker smoke is included in CI.
- The installed vsce tool has no `sign` command. The workflow now produces a detached SHA-256 CMS signature through a PowerShell signer with an in-memory certificate import, then retains the official `vsce verify-signature` gate. No PFX file or command-line certificate password is created by the new signer. Organization certificate trust was not tested here.

## Fresh verification

| Check | Actual result |
| --- | --- |
| Initial new regression suite | 21 failures before the fix; evidence retained |
| Additional overlap/argument review cases | Two reproduced failures before the follow-up fix |
| Focused final security cases | 31 passed, zero failed |
| Full extension source suite | 5,086 passed, zero failed, four skipped; 5,090 total |
| Core plus broker suites | 673 passed, zero failed, one skipped; 674 total |
| Lite package/receipt suites | 87 passed, zero failed |
| Lite TypeScript | Passed |
| Workflow YAML and script syntax | Parsed; no duplicate step IDs |
| Actual broker extracted from the new VSIX | Six loopback scenarios passed; child shut down cleanly |
| Synthetic certificate signing | CMS integrity verified; altered manifest rejected; no certificate store import |
| Existing audit probe re-run | The reproduced unregistered password no longer reaches the mock provider unredacted |

These counts describe separate executed suites and are not a unique coverage count or security percentage. Native symlink cases retain explicit skips. The full source suite needed execution outside the filesystem sandbox because existing tests use `D:\SoterAI-Lite-test-profiles`; its earlier 338 permission failures were not product passes. Earlier timing and stale-dist failures were investigated; shared declarations were rebuilt and the successful full rerun used concurrency two. No timeout or security assertion was weakened.

The new candidate is [soterai-lite-0.7.0-roadmap-p0-20261112-attempt02.vsix](../../packages/soterai-lite/soterai-lite-0.7.0-roadmap-p0-20261112-attempt02.vsix), **1,659,263 bytes**.

SHA-256: `473e8e0beb500af9fd3e82258e15bae222040ba62492ee5a6555f76d7c635b1d`.

The extracted broker verified raw password removal in developer and strict modes, refusal of nested secret metadata, enterprise refusal before approval, continued redaction after enterprise approval, and a useful unmodified public request. It used only synthetic credentials and a local collector. It did not contact a real AI provider.

Evidence: [focused security tests](evidence/20261112-roadmap-p0/review-green-02.tap), [full extension suite](evidence/20261112-roadmap-p0/extension-full-03.tap), [core/broker suite](evidence/20261112-roadmap-p0/core-broker-final-01.tap), [release tests](evidence/20261112-roadmap-p0/release-final-03.tap), [packaged broker](evidence/20261112-roadmap-p0/bundle-smoke-03/result.json), [signing integrity test](evidence/20261112-roadmap-p0/signing-synthetic-01/result.json), [post-fix audit probe](evidence/20261112-roadmap-p0/audit-probe-after-fix.json), [candidate pointer](evidence/20261112-roadmap-p0/candidate-pointer-02.json).

## Remaining acceptance and roadmap work

- The default installed VS Code extension was not replaced. No Marketplace/Open VSX publication or production deployment occurred.
- The new VSIX's broker was exercised, but the complete installed IDE UI, the 0.6.2 upgrade/recovery path, real-provider behavior and independent human acceptance were not rerun for this artifact. Its status remains `PACKAGED_NOT_HOST_VERIFIED`, `releaseReady:false`.
- Hosted CI and real organization certificate verification remain unexecuted. Synthetic CMS validation is not a trusted release-signature claim.
- P1 onboarding, supported app workflows and coverage UX remain next. P2 isolation/operation broker, P3 shared CI/deploy product enforcement and P4 independent pilot remain outstanding.
- Reversed/unknown transformations, separate-request fragments, arbitrary original-file reads and independent uploads remain outside the current protection guarantees. The P0 fix does not establish an OS isolation boundary.

## Cleanup instruction

The user cancelled project cleanup and instructed that no files be deleted. No old project report, source or source-test cleanup was performed. The generated cleanup inventory is reference-only and is marked cancelled. During the earlier disk-full interruption, only this task's synthetic temporary fixtures, an empty failed build attempt and a duplicate intermediate task log were cleaned; existing project work and historical evidence were preserved. No further project cleanup is authorized.

## Reproduce the candidate checks

From the repository root:

```powershell
node packages/soterai-lite/scripts/release-artifact.cjs resolve --pointer docs/soterai-lite/evidence/20261112-roadmap-p0/candidate-pointer-02.json
node packages/soterai-lite/scripts/smoke-broker.cjs --pointer docs/soterai-lite/evidence/20261112-roadmap-p0/candidate-pointer-02.json --evidence-out docs/soterai-lite/evidence/20261112-roadmap-p0/new-unique-smoke-directory
```

Use a new evidence directory for each smoke run. The helper does not overwrite or delete prior runs. The resolver intentionally fails if the source/assets/receipts associated with the candidate have changed; create and verify a new candidate instead of weakening those checks.
