# Live secret actions — 13 November 2026

**Later branding update:** [SoterAI Secret Guard](BRAND-AND-LAUNCH-2026-11-13.md)
uses a new package with the same runtime bytes and updated display name/copy.
This page retains the original live-action candidate and its test evidence.

The user requested more useful secret protection for developers and vibe coders.
Live scanning already existed, so this increment improves its everyday action
flow: **detect a secret → review the relevant text → copy filtered context or
review vault protection → continue editing**.

## Reproduced gaps and resulting behavior

| Before | Now |
| --- | --- |
| Copy safe line masked only the selected finding; another synthetic password on the same line reached the clipboard | Filter the whole affected line/block, rescan the output, then show a preview before explicit copy |
| A stale quick-fix still copied content after the document changed | Bind actions to document identity, version, content digest, policy/configuration revision and current scan generation |
| The internal fix command accepted a caller-selected URI/range/category and opened the file | Accept only a bounded, one-use ID for a current owned finding; caller paths/ranges grant no target |
| A scan could publish diagnostics after its document closed or a newer scan finished | Discard late or superseded results |
| Secret findings offered direct replacement without vault custody | Offer existing reviewed vault migration; unsaved source is not silently saved |

Copy respects the existing path/region boundary and matching/output guards.
It does not remove a saved deny or infer approval from an earlier scan. Preview
edits, source edits, closed documents and protection changes invalidate copying.
Unknown private prose and unsupported secrets still require owner review.
Non-secret replacement remains an explicit, undoable editor action.

The existing vault command independently owns its current-file review, migration
and encrypted recovery. This pass verifies that the lightbulb dispatches that
flow for the correct current file; it does not establish that an application
still runs after migration or that configured recovery works in the installed IDE.

## Verification

- Four actual regressions failed against the earlier implementation, retained in
  [regression-red-03.tap](evidence/20261113-live-actions/regression-red-03.tap).
  The two preceding red files are test-plumbing failures, not additional product bugs.
- Ten live-action functional tests cover multi-secret copy, cancellation,
  source changes during approval, one-use vault handoff, forged diagnostics,
  disabled filtering, arbitrary URI refusal, closed/out-of-order scans and an
  incomplete primary scan. These run the production code with a VS Code API stub.
- The selected suite, including those tests, reviewed-context tests, scanner
  exclusions and extension contracts: **126 passed**, zero failures/skips.
- Lite/IDE TypeScript check: exit **0**.
- The palette contract now explicitly includes the four deliberately public
  developer-workflow commands from the earlier increment. Internal actions remain hidden.
- Fresh VSIX packaging, inventory and receipt checks passed.
- Exact VSIX installation in isolated VS Code 1.146.0 passed; all four installed
  runtime files matched the receipt hashes.
- The exact packaged broker passed **six synthetic loopback scenarios** and
  shut down cleanly. This is separate from GUI/live-provider acceptance.

Evidence: [current run](evidence/20261113-live-actions),
[126 checks](evidence/20261113-live-actions/focused-green.tap),
[packaged broker](evidence/20261113-live-actions/broker/result.json), and
[isolated installation](evidence/20261113-continuation/ide-live-actions-result.json).

## Candidate and use

- [Lite 0.7.0 Windows x64 pre-release VSIX](../../packages/soterai-lite/soterai-lite-0.7.0-live-actions-20261113-attempt01.vsix).
- **1,672,019 bytes**.
- SHA-256: `2987721860990fb8df37e508977c7bfe223ef7ac1c37f7daa12847648484cd71`.
- [Release pointer](evidence/20261113-live-actions/candidate-pointer.json).

In an appropriate test profile, use a lightbulb on a current SoterAI finding:
**Preview sanitized lines before copying** or **Review vault protection for this
file**. Review the generated plaintext before choosing **Copy reviewed text**.
No AI provider transmission occurs in this action.

Normal installed-profile upgrade, real GUI interaction, configured migration/app
execution/recovery, actual AI-provider traffic and independent developer pilots
remain unverified. The normal profile was not modified. `releaseReady` remains
false; these controls do not contain arbitrary same-user file reads or uploads.
No cleanup, registry publication or GitHub workflow activation occurred.

The next user-value proof is a small real developer pilot of this exact workflow,
including valid public controls, cancellation, a supported app after migration
and encrypted recovery. Test counts alone are not a measured protection rate.
