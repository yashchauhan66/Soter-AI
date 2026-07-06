# Canary Secret System

SoterAI IDE Guard can plant **local decoy secrets ("canaries")** and detect when
they appear in AI output or where they should not — proving and localizing
leakage without ever uploading the raw value.

## What a canary is

A canary is a randomly generated, clearly-fake secret (e.g. a `CANARY_API_KEY`)
that has no real access to anything. It exists only so that if an AI tool reads
protected context and then reproduces the value, SoterAI can recognize it.

- The **raw token** is stored in VS Code **SecretStorage** only.
- Everywhere else — ledger, exports, reports, webviews — a canary is tracked by
  its **hash + a redacted preview** (e.g. `CANARY_…a1b2`).
- Canaries are **local by default**; nothing is uploaded.

## Commands (Phase 7)

| Command | What it does |
| --- | --- |
| **SoterAI: Generate Local Canary Secret** | Creates a canary, copies it to the clipboard, stores the raw token in SecretStorage. |
| **SoterAI: Insert Canary Into Test File** | Writes `.soterai/canary.env` with a decoy secret (never commit it). |
| **SoterAI: Scan Workspace for Canary Exposure** | Reports which workspace files contain the active canary so you can gitignore them. |
| **SoterAI: Verify No Canary in Logs/Reports** | Proves the ledger export contains no raw canary token. |
| **SoterAI: Rotate Canary** | Generates a fresh canary and invalidates prior ones. |

## How detection works

The **LLM Output Leak Monitor** (`scanAIOutput`) and the workspace scan compare
candidate text against the set of active canary hashes. A match raises a
**critical** alert: an AI tool likely read protected context.

```
[SoterAI CRITICAL] A SoterAI canary appeared in this AI output —
an AI tool likely read protected context. (CANARY_…a1b2)
```

## Privacy guarantees

- Raw canary token is **never** written to the ledger, cache, telemetry,
  exports, or webviews.
- `SoterAI: Verify No Canary in Logs/Reports` is the automated proof of this and
  is backed by unit tests (`canary.test.ts`, `outputleak.test.ts`).

## Honest scope

A canary **proves leakage after the fact** and helps you localize it. It does
not, by itself, prevent an extension from reading a file. Combine canaries with
the [Protected Secret Vault](protected-secret-vault.md) for prevention and the
[What AI Saw ledger](what-ai-saw-ledger.md) for the audit trail. See
[ide-guard-limitations.md](ide-guard-limitations.md).
