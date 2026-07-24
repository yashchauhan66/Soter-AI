# Privacy And Retention

Date: 2026-07-22

## Privacy contract

SoterAI security evidence should store:

- Content hashes.
- Redacted previews.
- Classifications.
- Reason codes.
- Coverage labels.
- Approval metadata.
- Tamper-evident ledger links where available.

SoterAI security evidence should not store:

- Raw secrets.
- Raw credentials.
- Full prompts.
- Complete proprietary files.
- Raw terminal output.
- Raw provider keys.

## Implemented evidence controls

- `Redactor` and `redactForSharing` remove high-risk secret classes.
- `HashCache` sanitizes cached decisions.
- `Ledger` sanitizes entries and supports tamper-evident chaining.
- `CheckpointRollback` stores hashes and redacted previews, not raw file contents, in its portable checkpoint metadata.

## Retention position

Local-only evidence remains on the user's machine unless explicitly exported. Enterprise retention windows and deletion confirmation behavior are covered elsewhere in the application tests, but extension-local retention must still be configured by product policy before broad rollout.
