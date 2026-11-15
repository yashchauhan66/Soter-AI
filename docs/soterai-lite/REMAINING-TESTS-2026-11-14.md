# Remaining test results, 14 November 2026

The requested remaining automated/native scopes have passing evidence for the unchanged **SoterAI Secret Guard 0.7.0 Windows x64 preview** candidate.

SHA-256: `98f3e336ee3a76e992276409648de98d1db4c6e362fb7669e624dd892adf0d9c`.

| Scope | Result and evidence |
| --- | --- |
| Actual Cline request canary | Passed: protected request withheld; benign tasks before and after succeeded. [Native report](evidence/20261114-release-gates/native-cline-canary-03/host-result.json) |
| Populated 0.6.2 to 0.7.0 upgrade | Five current-version controls passed: original encrypted records authenticated and retained, new records migrated and restored. [Upgrade report](evidence/20261114-release-gates/native-legacy-upgrade-01/host-result.json) |
| Reviewed workflow | Eleven native controls passed. [Workflow report](evidence/20261114-release-gates/native-workflow-01/host-result.json) |
| Restricted workspace | Six controls passed with actual workspace trust disabled. [Restricted report](evidence/20261114-release-gates/native-restricted-01/host-result.json) |
| Native interrupted recovery | Encrypted commit, forced owning-app termination, fresh-process recovery with actual SecretStorage, cancellation, idempotence and a second restart with approved original restoration passed. [Crash](evidence/20261114-release-gates/native-interruption-crash-01/native-launch.json), [recovery](evidence/20261114-release-gates/native-interruption-recovery-01/native-launch.json), [second restart](evidence/20261114-release-gates/native-interruption-verify-01/native-launch.json) |
| Actual Cline safe-reader tool result | Passed: native owner consent and recognized canary removal before the tool result reached the synthetic provider; benign follow-up succeeded. [Scoped check](evidence/20261114-release-gates/native-cline-extra-canaries-02/host-result.json) |
| Actual Cline PNG attachment | Passed: rejected before the synthetic provider; benign controls before and after succeeded. [Attachment report](evidence/20261114-release-gates/native-cline-attachment-01/host-result.json) |
| Built-in Cline free model | Six native controls passed, including UI selection and an actual visible reply from **Solar Mini 4** (`cline-free/solar-mini4`) using the owner's isolated sign-in. [Native report](evidence/20261114-release-gates/native-cline-free-10/host-result.json), [actual session/model proof](evidence/20261114-release-gates/native-cline-free-10/free-session-proof.json) |

[Machine-readable reconciliation](evidence/20261114-release-gates/remaining-tests-summary.json) records evidence hashes and exact scope. Previously passed full source suites were not rerun. Changes during this continuation were confined to test drivers, private test profiles and reports; the product VSIX is unchanged.

The legacy seed used the original 0.6.2 bytes with fixture-only Windows drive-letter normalization. Current-version upgrade had no such API instrumentation. Native interruption used a fixture barrier after the live ciphertext rename and then forcibly stopped the verified owning process tree; this is not a physical power-loss test.

The tool-result check covers the supported SoterAI safe-reader MCP route. Its original combined run failed a later attachment message expectation; that failed report is retained and the corrected attachment scope passed separately. It does not certify unrestricted native Cline reads. The image test verifies rejection, not OCR or image-content inspection.

The free-model run uses Cline's direct built-in provider. It demonstrates real client/provider operation, not SoterAI broker enforcement on that direct route. The user changed the external-provider request to Cline free models after AgentRouter returned HTTP 401. The free model was verified through actual UI selection and saved session metadata before being reported as passed. Earlier login, selector and model-state failures remain preserved.

Interactive authentication and runtime files remain in git-ignored isolated profiles. No credential values are included in these reports. Independent human security, pilot and accessibility acceptance remains absent; immutable package receipts retain `releaseReady: false`. No publication was performed.
