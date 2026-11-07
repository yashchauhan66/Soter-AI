# F26a affected-native current03 author contract

Status: **PREPARED_NOT_BOUND / NOT_EXECUTED**. This note records evidence-only
successor authoring. No generator mode, launcher, native gate, Git command,
compiler, build, source fixture, queue, or ledger was executed or changed by this
authoring step. The earlier actual native02 failure remains a failure.

New author inputs are `prepare-affected-current-03.cjs` and
`affected-native-binding-03.template.ps1`. The generator checks the sealed
`affected-pipe-ownership-correction-02.json` and all original01, before-snapshot,
and pipe-safe02 facts. Both modes refuse existing output paths. The preparation
mode only writes 25 new unbound03 launcher/control templates and their manifest;
the separately authored guard makes 26 templates. The materialization mode only
writes 26 new bound03 PowerShell helpers and a materialization receipt.

Root may review and then run, from the repository root:

```powershell
node docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/prepare-affected-current-03.cjs --prepare
node docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/prepare-affected-current-03.cjs --materialize
```

Neither mode launches behavior gates. Root must independently parse all 26 actual
PowerShell outputs and retain their exact pre-execution snapshot before any
native launch. The author syntax receipt covers the generator and guard template
only; it does not claim that generated outputs have been materialized or parsed.

The current binding is the exact existing `native-current-binding-03.json`
(SHA256 `df37214d1c6af39677175f4cd8245d6cfa314488aed520110e73fa2f582bb612`).
It must retain status `NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED`, current
`native-source-inputs-03.json` with 989 members, historical `full-inputs-02.json`
and `full-tests-02.txt.result.json`, fresh `compiler-14.txt.result.json`, fresh
`native-driver-provenance-03.json`, `native-fixture-equivalence-03.json`, and
`host-current-binding-02.ps1` facts. The unchanged sealed VSIX remains
`packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix`, SHA256
`bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91`.

The independent admission checks require exactly the one corrected
`litePreCommitGuard.host.ts` literal (`ExpectedError` to `CodeExpectedError`),
988 other full-freeze members unchanged, fresh compiler14/build03 actual exit0
and exact raw receipts, all 21 current03 driver outputs, and exact byte equality
for all 20 affected outputs against02. The owner-hook output must instead be
freshly distinct. The new helpers use `prebuilt-native-hosts-03`, the new03
affected guard, and host02. Functional10 and security17 retain exact sealed
driver bytes only; their previous results provide no current native acceptance.

All 25 launch/control outputs derive from the exact reviewed pipe-safe02 bytes.
The only transformations are the unbound admission token, affected/host binding
references, current prebuilt directory, and successor control references. The
shared `native-pipe-ownership-02.ps1`, exact timeout expressions, counts, and
behavior assertions remain unchanged. In particular, a late naturally closed
child does not clear a sticky timeout failure. No additional timeout, process
signal, reader cancellation, or premature disposal is introduced.

Full02 keeps its historical attribution; current fixture-only equivalence is
explicit. No new full execution, native result, acceptance, source commit, or
transition proof is claimed by this preparation.
