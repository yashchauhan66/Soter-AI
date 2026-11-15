# Production hardening and current release evidence, 14 November 2026

Continued the locally available transcript for thread
`01a1d2c5-d6a3-7521-8eca-1b454db65e2f`. The existing approval for isolated
native testing remains valid. The final candidate has additional security fixes
and passing local verification. Stable production acceptance remains incomplete;
`releaseReady` is **false**.

## Final candidate

- **SoterAI Secret Guard**, `soterai.soterai-ide-guard`, version **0.7.0**.
- Windows x64 preview, **1,674,618 bytes**.
- [Final VSIX](../../packages/soterai-lite/soterai-secret-guard-0.7.0-production-hardening-20261114-attempt02.vsix).
- SHA-256: `af4a5b3fa015b497fc1653af2a5975c9c0ba77fb4ab003f11581a4b73f56072e`.
- [Verified receipt pointer](evidence/20261114-production-completion/candidate-final-pointer.json).

Earlier `df92f72a` and intermediate `b917dbb6` candidates and their evidence are
retained. Native acceptance of older bytes does not establish acceptance of
this package. Packaging does not grant publication approval.

## Fixes and regression evidence

1. **Provider output password leak.** Plain `DB_PASSWORD=...`, a prefixed password
   in response metadata, and a password assembled across streaming events could
   reach the client. The response scanner returned `warn`, the older survivor
   matcher missed the assignment, and comparing two redactors did not compare
   against the original response. The broker now uses the complete recognized
   secret matcher before releasing response bytes. Three source regressions
   reproduced HTTP 200 before the fix; they now require HTTP 422, a blocked output
   decision, and no sensitive response content. See the retained
   [red run](evidence/20261114-production-completion/provider-output-red.tap) and
   [final core/broker suite](evidence/20261114-production-completion/core-broker-final.tap).
2. **Outbound deadline admission.** The last secret detector call could exceed
   the inspection budget and still admit the request. The gate now uses a
   monotonic clock and checks after detector/decoding work and before completion.
   The real detector regression first failed, then passed. This is a cooperative
   deadline; synchronous work already running is not interrupted.
3. **Malformed advisory response.** Primitive/array component results and null
   vulnerability lists could become a zero-match report. Strict response
   validation now refuses malformed results and incomplete pagination. The
   regression first accepted `false` as a clean result and now rejects it.
4. **Reproducible local verification.** Unit fixtures use the operating system's
   temporary directory instead of requiring a D: drive. Owned fixture cleanup
   checks remain in place. Updated the VS Code range test stub, the explicit
   reviewed-copy positive control, supported Cline-version documentation, and
   generated command counts.

## Executed checks

| Check | Result |
| --- | --- |
| [Full extension suite](evidence/20261114-production-completion/extension-final.tap) | **5,143 pass, 0 fail, 4 skips** |
| [Final core/broker suite](evidence/20261114-production-completion/core-broker-final.tap) | **677 pass, 0 fail, 1 skip** |
| [Affected extension gateway suite after output fix](evidence/20261114-production-completion/extension-gateway-serial.tap) | **270 pass, 0 fail, 0 skips** |
| [Release and advisory-schema suite](evidence/20261114-production-completion/release-verified.tap) | **97 pass, 0 fail, 0 skips** |
| Extension and final broker TypeScript checks | Exit 0 |
| Fresh package, receipt and final inventory | Passed |
| [Final packaged broker](evidence/20261114-production-completion/broker-final/result.json) | **12 synthetic loopback scenarios passed; child closed** |
| [Final isolated CLI upgrade](evidence/20261114-production-completion/cli-upgrade-final/result.json) | **0.6.2 to 0.7.0 metadata preserved; four runtime hashes verified** |
| [Final review packet](evidence/20261114-production-completion/review-kit-final/REVIEW.md) | **377 files byte-verified; human verdicts unfilled** |
| [Current shipped advisory lookup](evidence/20261114-production-completion/advisories-final-sandbox/result.json) | **LOOKUP_INCOMPLETE** |
| Final native workflows | Prepared; launch blocked before execution |

The full extension suite preceded the final broker output-guard change. Its
extension bundle remains byte-identical (`c4f81622...`); final broker/core and
affected gateway verification are recorded separately. Focused runs overlap
the full suite and must not be added to its count. Five skipped checks require
Windows file-symlink privileges; those assertions remain unverified.

One gateway check exceeded its one-second inspection deadline during concurrent
verification and packaging. That failed run is retained. The same 270 gateway
checks subsequently passed serially; the product deadline was not weakened.

The initial full run retained 337 failures, chiefly D: fixture access and stale
test/documentation contracts. The final full run above passed after their fixes.
The intermediate canary attempts are retained: some exposed incorrect test
expectations (redaction rather than refusal, or HTTP 415 for unsupported images),
and the provider-output attempt exposed the real leak fixed above.

The twelve final scenarios cover useful public output, password redaction in
requests/tool results/text content, valid redacted escaped tool-argument JSON,
metadata refusal, unsupported-image refusal, provider-output withholding, and
strict/enterprise approval behavior. They exercise the packaged broker with a
synthetic receiver, not actual Cline or an external provider. Image refusal does
not establish supported attachment processing. The CLI upgrade establishes
installation and synthetic metadata preservation, not encrypted vault recovery.

## Remaining acceptance and execution

Automatic approval review returned technical `content-blocked` failures before
executing the final native workflow and the public advisory network retry. The
action was not determined unsafe. These are execution blockers, not failed
native assertions. See [blocker record](evidence/20261114-production-completion/execution-blockers.json).

Prepared workflow, restricted-workspace, unchanged pinned Cline loopback, and
vault-app seed drivers bind the final candidate and their immutable source hashes.
From the repository root, the owner can execute the sequence once in PowerShell:

```powershell
& ./docs/soterai-lite/evidence/20261114-production-completion/RUN-NATIVE.ps1
```

The script verifies the review packet, stops dependent steps after a failure,
prepares vault restart only after accepting its same-candidate seed, and performs
the public package-version advisory lookup. Existing evidence is create-only;
failed attempts require a newly prepared directory. Assess actual host reports
and matching launch results before marking a native scope passed.

Stable release still requires final installed workflow/recovery acceptance,
meaningful interruption and populated encrypted-state upgrade recovery,
actual supported Cline/provider traffic and canaries, a completed current
advisory lookup, and independent developer/security/accessibility acceptance.
The user confirmed independent reviews have not occurred. Local test counts
and generated review templates do not replace these results.

No registry publication, production deployment or external messaging occurred.
Publishing remains disabled. Recommend controlled Windows preview evaluation
until the outstanding acceptance is completed and the owner authorizes release.
