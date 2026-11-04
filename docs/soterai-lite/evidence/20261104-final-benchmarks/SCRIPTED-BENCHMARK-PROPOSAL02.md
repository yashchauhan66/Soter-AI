# V02 scripted benchmark fixture correction02

4 November2026. Supersedes only the diagnostic-output oracle in proposed01; all raw failed evidence remains. The first actual owned component run completed Node off, then failed Node on. `component-boundary-diagnostics-01.json` executes the actual frozen pure source components and identifies context MATCHED/withheld, fallback CLEAN/forwarded and secret-bearing output COMPLETE/redacted/secret-absent/marker-present. The original fixture incorrectly required the useful public prefix to survive in that same secret-bearing output channel. The actual `StreamingOutputRedactor.finish` contract replaces each nonempty channel with `[REDACTED_SECRET_OUTPUT]` when any inspected view matches. No product source changes are needed or authorized here.

Driver02 keeps the original synthetic secret oracle and requires that exact whole-channel marker on the on path. It explicitly records surrounding public context withheld for that mixed channel. A separate actual completed public-only operation must retain every useful output byte and remain unredacted. The off path must still retain the mixed public prefix and expose the deliberate synthetic value, proving on/off sensitivity. This is an additional truthful positive control, not a claim that secret-bearing logs retain their surrounding public text.

All other source/artifact pins, four cases, deterministic coding tasks, on/off scripted metrics, fakeDB/fakeAPI data, private-field oracles, no servers/network/models, existing dependencies, retained before/after files and original proposal01 boundaries remain. Exact Express integration remains NOT_RUN_DEPENDENCY_UNAVAILABLE; Node handler execution is not renamed Express. Actual NextRequest/NextResponse execution remains separate from a Next server/build claim. Real-agent two-project trials remain human work. A failure now records only this fixed fixture's numeric line/column, excluding assertion text, raw results, tokens or stack content.

Reviewed root invocation through the same owned180-second wrapper:

```powershell
node docs/soterai-lite/evidence/20261104-final-benchmarks/run-scripted-benchmarks-proposed-02.cjs --run e0b7677479089dfdfe7a2d64baa0ce7f66e4a9600c1094fcde96152101829f24
```

No native/model/CLI/host round or network authority is involved. Existing failed benchmark01 is not regraded or reused as a completed on/off project result. Only a new actual owned component run can establish corrected dry-run completion.
