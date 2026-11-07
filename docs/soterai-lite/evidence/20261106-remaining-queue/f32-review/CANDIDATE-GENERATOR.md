# Current-candidate F32 generator

Run after the new candidate, source proof, full-suite acceptance, and package qualification exist:

```powershell
node docs/soterai-lite/evidence/20261106-remaining-queue/f32-review/prepare-candidate-successor.cjs C:/absolute/path/f32-candidate-config.json
```

The command writes new successor files and verifies their static admission. It never starts Code, a child process, or a native lifecycle run. Importing the generator is inert.

Configuration:

```json
{
  "sourceParent": "40-character lowercase base HEAD hash",
  "sourceProof": {"path":"C:\\absolute\\proof.json","bytes":123,"sha256":"64-character lowercase hash"},
  "fullAcceptance": {"path":"C:\\absolute\\full.json","bytes":123,"sha256":"64-character lowercase hash"},
  "finalQualification": {"path":"C:\\absolute\\qualification.json","bytes":123,"sha256":"64-character lowercase hash"},
  "currentVsix": {"path":"C:\\absolute\\candidate.vsix","bytes":123,"sha256":"64-character lowercase hash"},
  "trustDiagnostics": true
}
```

`runRoot`, `debugPorts` (eight unique ports), and `configuredBrokerPort` are optional. Defaults create a fresh `D:\SoterAI-Lite-test-profiles\f32-installed-<timestamp>-<nonce>` and use ports 54731–54738 plus 54739. The existing exact VS Code 1.145.1 vendor receipt and genuine old 0.6.3 VSIX remain fixed.

Input schemas retain the existing F32 contracts:

- Source proof: `FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE`, matching `sourceParent`, `fileCount`, `files`, `scopedSource`.
- Full acceptance: `PASS_F32_CURRENT_ALL_FROZEN_TEST_FILES`, matching `sourceProofSha256`, `fileCount`, `counts`, and `shards[{name,files,counts}]`. Each shard's owned-close receipt and stdout/stderr must be adjacent to the full acceptance under `<name>-owned-close.json` / `<name>-stdout.bin` / `<name>-stderr.bin`.
- Final qualification: `feature:F32`, status `FINAL_SOURCE_FULL_COMPILER_VSIX_CONTENT_BACKEND_REVIEWED_NATIVE_PENDING`; matching `sourceProofSha256`, `fullAcceptanceSha256`, `vsix`, and `currentVendorReceiptSha256`; checks `compiler`, `content`, `backend` all `PASS_EXACT_CURRENT`; `ownedCloseReceipts`; exact `payload.{manifestSha256,runtimes,payloadUncompressedBytes,targetPlatform}`.

The provided qualification's notification hash is replaced in a **new derivative qualification**, retaining the supplied qualification as a pinned input. The fresh notification receipt requires the exact R21 PASS line in the new accepted lifecycle-command test shard. A skip does not qualify. Expected installed size is derived from the new VSIX and the already measured current-vendor serialization contract; it is labeled derived, and the lifecycle's real CLI install/manifest checks still verify the actual result.

Outputs are new direct-child files in the original F32 evidence directory: runner08, GUI08, observer07, old-observer06, renderer07, `notification-return-qualification-02.json`, `candidate-installer-size-contract-01.json`, `current-candidate-qualification-01.json`, proposal09, and extra08 authorization/admission. Existing paths cause refusal. A successful static result is recorded here as `candidate-preparation-result.json`.

Historical normal rounds 01–03 no longer require their source proof or current VSIX to equal the new candidate. Their own pinned source-proof descriptors, old archive bytes, admissions, and failure/close records remain mandatory. Native07's consumed admission, observed trust failure, actual Code exit 0, renderer exit 1, and both stream sets are also verified. The source parent is now explicitly bound by the new admission.

The three ACK successors are integrated. Optional trust diagnostics add UTC timestamps and fail fast when a fresh workspace becomes trusted before witnessed keyboard intent. Intent alone does not satisfy trust; the original actual keyboard receipt and public trust state remain required. No added metadata contributes to the 44 assertions or 59 observations. The complete eight-phase acceptance section stays byte exact.

Verification completed: generator syntax and all five generated scripts parsed; 11 candidate-generator controls passed. Existing ACK controls separately passed 18 tests. The new candidate itself has not been admitted until the root supplies the four real artifact facts and runs this generator.

```powershell
node --experimental-test-isolation=none --test docs/soterai-lite/evidence/20261106-remaining-queue/f32-review/candidate-successor-controls.test.cjs
```
