# Continuation and practical assessment — 13 November 2026

**Later update:** [developer-workflow implementation](DEVELOPER-WORKFLOW-2026-11-13.md)
records the subsequent user-authorized improvements and the newer exact VSIX.
This page retains the earlier continuation and rating rationale.

Resumed the locally available transcript for thread
`01a1d031-50a7-7e52-83af-e0442c400827`. Its accepted scope was P1–P4 review,
gap fixes, and remaining verification. Existing project files and historical
evidence remain preserved. This continuation has **not completed release or
external acceptance**; `releaseReady` remains **false**.

## Newly fixed and verified

The shared CI/project-journey scanner could return `clean` and an admission
digest when cancellation or the time budget was reached during its final file.
There was no next iteration to recheck the stop condition. Two regression tests
first failed with that exact result. The scanner now rechecks cancellation/time
after finalization, marks the report incomplete, and removes its snapshot
digest. This is a cooperative time budget; it cannot interrupt synchronous work
in progress. Consumers must use the final clean report to admit captured bytes.

The prior native preflight also used an obsolete hardcoded VS Code CLI path.
The installed `code.cmd` points into a versioned application directory. The new
verification helper resolves that actual launcher, installs into a fresh isolated
profile, and verifies the installed runtime files against the package receipt.
The original profile was not modified; its existing extension directory is 0.6.2.

| Verification executed here | Result |
| --- | --- |
| Reproduction before scanner fix | 2 tests failed as expected |
| Scanner and isolation regression suite | 22 passed, no failures |
| Final complete CLI suite | 147 passed, no failures/skips |
| Project journey tests | 4 passed, no failures/skips |
| CLI typecheck and fresh TypeScript compilation | Exit 0 |
| Fresh Lite packaging, receipt and inventory validation | Passed |
| Exact new VSIX isolated installation in VS Code 1.146.0 | Passed; 4 runtime files matched their hashes |
| Exact new VSIX broker, synthetic loopback only | 6 scenarios passed; broker shut down cleanly |

The 22 focused tests overlap the full CLI suite; do not add them to its total.
The six broker scenarios verify a useful public response, default/strict password
redaction, nested metadata refusal, enterprise refusal, and redaction even after
enterprise approval. They do not exercise a real provider account.

Evidence: [current run directory](evidence/20261113-continuation),
[failed regressions](evidence/20261113-continuation/scan-finalization-red.tap),
[final CLI tests](evidence/20261113-continuation/cli-final.tap),
[installed package](evidence/20261113-continuation/ide-fixed-result.json), and
[packaged broker](evidence/20261113-continuation/broker-fixed/result.json).

## Exact current candidate

- Lite **0.7.0**, Windows x64 pre-release, **1,664,949 bytes**.
- [VSIX](../../packages/soterai-lite/soterai-lite-0.7.0-continuation-20261113-attempt01.vsix).
- SHA-256: `21c187f303d7d69f84849d5781bf9b9e4a839deeb1f070b100a97a52fcda6ca2`.
- [Verified release pointer](evidence/20261113-continuation/candidate-pointer.json).
- The shared scanner fix is bundled through the project journey. The separate
  P2 isolation, operation broker and P4 CLI are not automatically IDE features.
- The older `33e199…` candidate was checked first and is retained. Its results
  are not substituted for this new artifact's installation/broker results.

No GUI activation, actual upgrade from a configured 0.6.2 profile, encrypted
recovery drill, Marketplace publication or independent review is claimed.

## Remaining work and actual blockers

1. **Native Docker enforcement:** the CLI is installed and Docker processes are
   running, but the sandbox denied the Linux engine pipe. Outside-sandbox
   read-only verification was rejected by automatic approval review because
   the review system returned `content-blocked`. The user explicitly approved
   retrying; the retry failed at the same review layer and did not execute.
   This is an approval-system failure, not evidence that the engine is down.
   No container was created and no isolation canary ran. The prepared
   `preflight.cjs native` can be retried after that system works.
2. **Installed runtime and usability:** complete activation, GUI journey,
   configured upgrade and encrypted recovery against the new exact VSIX.
   Installation and matching files alone do not establish those behaviors.
3. **AWS/provider delivery:** the known required account/instance, artifact
   bucket, OIDC role and provider key settings are absent from
   `.env.production`; the region is configured. No secret values were printed.
   The finite Node EC2 reference still needs its owner target/SSM/signing setup.
   The existing Next.js DockerHub/SSH pipeline has not been migrated to it.
4. **Independent acceptance:** real provider traffic, security and accessibility
   review, and five real developer pilots remain missing. Scripts or peer model
   opinions cannot supply human acceptance. No reviewer identities/keys or
   successful live deployment results were fabricated.

Subagents lacked execution tools in this session. Peer reasoning used supplied
source/evidence excerpts; every executed check above was run by the root agent.
Fast mode could not be toggled through an available tool. Independent local
checks were parallelized; the official speed documentation request was also
blocked by the approval-system error.

## Honest usefulness rating

These are engineering judgments for the **current candidate**, not measured
detection percentages or ratings of the installed 0.6.2 version.

| Use case | Rating | Reason |
| --- | --- | --- |
| Overall developer security assistant today | **6/10** | Useful implemented controls and reproducible local checks; incomplete runtime, provider and user acceptance |
| Preventing accidental disclosure through supported managed workflows | **7/10** | Reviewed masked reads, vault placeholders, supported gateway redaction and scoped findings provide practical value |
| Production rollout readiness | **4/10** | Native lifecycle, real integration and independent acceptance are still missing |
| Containing an unrestricted hostile same-user AI agent | **1/10** | Independent filesystem reads, shells, original buffers and uploads remain available outside managed routes |

For a developer deliberately using the managed AI route, it can catch/redact
recognized passwords before sending a prompt, replace reviewed secrets with
placeholders, and point out source or artifact exposure. That makes it useful
as an additional layer in everyday development.

Merely installing it does not make every AI extension or agent safe. An agent
with unrestricted same-user file/network access can bypass the managed route.
Unknown secrets or transformations are not guaranteed to be detected. The
finite Docker CLI is not a complete isolated coding-agent environment, and
approved production app code can expose secrets intentionally given to it.
Historical unmanaged leak cases illustrate that boundary; their counts are not
a statistically valid effectiveness rate.
