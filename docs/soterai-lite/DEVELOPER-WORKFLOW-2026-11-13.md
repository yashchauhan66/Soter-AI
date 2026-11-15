# Developer usefulness improvements — 13 November 2026

**Later increment:** [live secret action protection](LIVE-SECRET-ACTIONS-2026-11-13.md)
adds reviewed whole-line copy, current-action guards and an updated exact VSIX.
The results below retain their original candidate identity.

The user authorized the proposed priority order. This implements a local
developer-workflow increment; it does not complete real-provider, independent
human or production release acceptance. Existing project files/evidence were
preserved. The user freed disk space after an actual disk-full error.

| Priority | Implemented behavior | Remaining validation |
| --- | --- | --- |
| 1. Guided setup | Detect fixed project markers without parsing configuration; keep the next recommended step available after each action; retain progress until workspace/configuration changes; pause when source selection is needed | Five-minute onboarding is a target, not a measured result; independent usability is pending |
| 2. Useful findings | Select current finding metadata, then review supported vault migration, blank env examples or encrypted recovery through the existing owner-controlled operations | Actual configured upgrade/recovery and independent user acceptance remain pending |
| 3. Useful AI context | Preview selected-code prompts before explicit copy; generate names-only env contracts with suggested types and synthetic examples; discard original assignment values/comments | Unknown/private variable names still need owner review; no universal detection claim |
| 4. Reliable tool setup | Show Cline/Claude installed-versus-supported versions and scoped local check counts; retain adapter policy/schema regressions | Configuration and local self-checks do not verify real provider requests or attachments |
| 5. Safe debugging workflow | Generate bounded, filtered selected-log/stack-trace context; preview before copying; invalidate on source/settings/preview edits | Private prose, paths and hostnames may remain; no unattended log collection or prompt-injection containment claim |
| 6. Source/build checks | Add pathless CLI Markdown/JSON summaries, preserve exit codes, and run a finite Node source/output example with failure tests | GitHub workflow application was blocked by automatic approval review; no active PR gate or hosted run is claimed |

## Use it

Install the candidate into an appropriate test profile, then open
**SoterAI: Protect This Project Step by Step** from the command palette or
Protection Center. The recommended action appears first. Existing reviewed
operations still control all source changes and recovery.

For context, select the relevant text in a trusted workspace, then use:

- **Prepare Reviewed AI Context** for a selected-code prompt or environment contract.
- **Preview Environment Contract from Selection** for supported single-line dotenv assignments.
- **Preview Debug Context from Selection** for a bounded log or stack trace.

Review the generated plaintext document and choose **Copy reviewed text** or
**Keep preview**. Editing its source, protection settings or preview requires a
new review. A closed/reopened source cannot reuse the earlier document binding.
Selections and generated previews are bounded to 64 KiB. Environment input has
at most 128 case-insensitively unique names; unsupported multiline/ambiguous
syntax is withheld. Suggested types depend on variable names, not real values.
These features never automatically send data to an AI provider.

CLI: `ci scan --format github` emits a Markdown summary and
`--format summary-json` emits pathless counts/status. Existing JSON/SARIF formats
remain available for local location-aware review. The
[local example](../../examples/developer-workflow/README.md) checks both source
and its real finite output. The [workflow proposal](../../examples/developer-workflow/WORKFLOW-PROPOSAL.md)
is reviewable but not applied. It explicitly checks the finite example, not the
whole repository or the existing Next.js/Docker deployment.

## Validation actually executed

- Final complete CLI suite: **150 passed**, zero failures/skips.
- Selected extension, command, context, Cline/Claude policy/schema and example
  suite: **85 passed**, zero failures/skips, using serial test-file execution.
- The final additional example run after requiring positive source coverage:
  **4 passed**; these overlap the 85 above and are not additional unique tests.
- IDE/Lite TypeScript check and fresh CLI compilation: exit **0**.
- Local example source and produced output: both clean, one 267-byte file each.
  This checks packaging/scanning, not whether the example application runs.
- Fresh VSIX packaging, receipt and inventory verification: passed.
- Exact candidate installation into a fresh isolated VS Code 1.146.0 profile:
  passed; all **4 runtime files** matched the receipt hashes.
- Exact candidate broker: **6 synthetic loopback scenarios passed**, including
  useful public traffic and default/strict/enterprise secret handling.

The first concurrent final suite had 84 pass/1 fail: an existing Claude schema
inspection exceeded its time budget while CLI tests and TypeScript ran in
parallel. The serial suite passed with the same protection limits. This retained
failure is a load-sensitivity observation, not evidence that the limit can be
removed. Earlier hygiene tests hit a hardcoded D: fixture permission failure;
their fixture now uses the platform temporary directory. No protection boundary
was weakened to obtain a pass.

Evidence is under [this run](evidence/20261113-developer-workflow), including
`cli-final.tap`, `extension-final-serial.tap`, `commands-example-green.tap`,
`example-final.tap`, `typecheck-final.log`, `package.log` and `broker/result.json`.
The reused installer retained its
[exact installation result](evidence/20261113-continuation/ide-developer-workflow-result.json)
and isolated profile separately. Peer agents reviewed supplied designs; they had
no execution tools, so they did not independently run repository tests.

## Exact candidate and remaining boundaries

- [Lite 0.7.0 Windows x64 pre-release VSIX](../../packages/soterai-lite/soterai-lite-0.7.0-developer-workflow-20261113-attempt01.vsix).
- Size: **1,670,359 bytes**.
- SHA-256: `5beb0675a4177f976c64a3812279fa8de72c4097e893bd23ad31be6f29ec11b2`.
- [Release pointer](evidence/20261113-developer-workflow/candidate-pointer.json).
- The normal installed 0.6.2 profile was not modified. This candidate was tested
  in a separate profile; registry publication has not occurred.

GUI activation/usability, configured upgrade/recovery, real provider traffic,
native Docker enforcement, live AWS delivery and independent human acceptance
remain unverified. The new CLI report/example features are separate from the
IDE's bundled user flows. `releaseReady` remains **false**.

Writing the proposed GitHub workflow failed at automatic approval review with
the technical error `content-blocked`; it did not execute. A subsequent request
to run D: fixture tests outside the sandbox failed at that same review layer.
The local example and portable test fixtures were completed within the workspace
instead. No active workflow or branch-protection change is claimed.

The product is more useful in its supported managed workflow, but these source
and synthetic results do not justify an independent effectiveness percentage or
an upgraded production-readiness rating. The previous 6/10 overall assessment
remains provisional until actual developer/provider acceptance supplies evidence.
