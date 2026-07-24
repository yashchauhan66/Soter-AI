# Incident Response

Date: 2026-07-22

## Supported incident package

For supported SoterAI paths, an incident package should include:

- Event time range.
- Workspace pseudonymous identifier.
- Agent/integration label when observable.
- Protection mode.
- Coverage level.
- Policy decisions and reason codes.
- Redacted evidence previews.
- Content hashes.
- Files touched or blocked, when path logging is allowed.
- Brokered terminal/network/MCP decisions.
- Approval and rollback metadata.
- Residual-risk notes.

## Do not include

- Raw secrets.
- Raw credentials.
- Full prompts.
- Full proprietary files.
- Raw terminal output.
- Provider API keys.

## Triage flow

1. Verify the route coverage level.
2. Confirm whether the event was pre-execution blocked, transformed, approval-gated, or observe-only.
3. Verify ledger hash-chain status where available.
4. Reconstruct the minimal causal chain with hashes and redacted previews.
5. Identify unsupported bypass paths that could also explain the event.
6. Rotate affected credentials if raw exposure is suspected.
7. Preserve artifacts and update the residual-risk register.
