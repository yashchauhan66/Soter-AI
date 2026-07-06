# "What AI Saw" Ledger

An append-only local audit log of every AI Context Firewall decision:
`.soterai/local-ledger.jsonl`.

## What it records

Each entry stores **only** metadata — never raw content:

- `eventId`, `timestamp`, `workspacePseudoId` (a hash, not a path)
- `eventType` (context_built, context_blocked, context_approved,
  output_scanned, canary_leak, vault_migrated, …)
- `action` / `decision` / `severity` / `riskScore`
- `categories`, `filePaths` (paths only), `contentHashes` (SHA-256)
- `redactedEvidencePreview` (secret-free), `policyVersion`, `detectorVersions`,
  `approvalSessionId`

## What it never records

Raw secrets, raw prompts, raw file content, raw terminal output, or raw AI
responses. Every write passes through `sanitizeLedgerEntry`, which replaces any
string still containing a high-risk secret with `[REDACTED]`. This is proven by
the guard-core `ledger.test.ts` canary tests and the extension privacy tests.

## Commands

- **Open AI Access Ledger** — timeline of events (newest first, decisions,
  risk, categories, files, redacted evidence).
- **Export AI Access Ledger** — re-sanitized JSONL for sharing/compliance.
- **Clear Local AI Ledger** — deletes the history (requires confirmation).
- **Show What AI Saw Last Session** — the most recent context decision.

## Privacy note

Add `.soterai/local-ledger.jsonl` to `.gitignore`. The ledger is safe to export
(no raw secrets), but it does reveal file paths and activity, so treat it as
workspace-private.
