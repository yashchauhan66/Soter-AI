# Exact-object release checklist

Updated 6 November 2026. **Release NOT_READY; rating PENDING.** Candidate: [soterai-lite-0.7.0-resumed-20261106-attempt02.vsix](../../packages/soterai-lite/soterai-lite-0.7.0-resumed-20261106-attempt02.vsix), 1,742,104 bytes, SHA-256 `011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec`. Available native host: Windows 10.0.26300, Code 1.145.1. Current native acceptance must have its own exact-object receipt. Earlier Code 1.144.1/1.145.0 results remain historical.

| Gate | State and evidence |
| --- | --- |
| Source/full/compiler | 1,111 inputs; 4,888 PASS / 0 FAIL / 4 SKIP. [Full](evidence/20261106-remaining-queue/candidate-01/full-suite-acceptance-02.json) explicitly records metadata-only reuse; compiler and 110 metadata checks freshly pass. |
| Build/package | [Exact qualification](evidence/20261106-remaining-queue/candidate-01/current-package-qualification-01.json): 55 package tests pass; 18 entries/four runtimes/SBOM/privacy/notices. Offline scope only. |
| F26a | Owner-reviewed default-off install/resume candidate; native receipt required. |
| F32 and current native routes | Current exact-object acceptance required; older native families, editor10 and reliability30 are historical. |
| V02 scripted/performance | Four actual Express/Next cases and six stream boundaries pass in component scope. Selected128-of4096 component scan 3548.7181 ms <60,000 ms. Installed/native budgets remain separate. |
| Catalog | 44 rows/six tools/264 UNVERIFIED pairs; applicability/controls/oracles/prevention-sensitive mutation incomplete. |
| Audit | 42 retained builder findings: 17 HIGH/19 MODERATE/6 LOW; raw responses rehashed. Remediation OPEN; risk acceptance NOT_GRANTED. |
| Neutral review | [393-entry kit](independent-review-kit-20261106-011f96d1/reviewer-prompt.md) verified; external verdict NOT_PROVIDED. |
| Human gates | Smoke, two real-agent trials, five users, screen reader, symlink/platform and release decisions pending. |
| Publishing | Not performed. Original L6 requires HUMAN-ACTIONS then STOP; later owner evidence is required. |

Preserve the four privileged-symlink skips and nine confirmed unmanaged leaks. Linux/macOS/remote/virtual/PowerShell 7 remain untested unless separately qualified. Rebuilt or modified objects require affected verification and fresh exact-object independent review.

[Evidence index](RELEASE-EVIDENCE.json), [human actions](HUMAN-ACTIONS.md) and [current claims](evidence/20261106-remaining-queue/final/CURRENT-CLAIMS.md). Frozen packaged documents remain historical build inputs; this dated supplement records later evidence.
