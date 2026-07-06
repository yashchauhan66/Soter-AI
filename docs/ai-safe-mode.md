# AI Safe Mode

AI Safe Mode is a one-click strict policy overlay for SoterAI-routed workflows. Enable it from the command palette and choose a level.

| Level | Behavior |
| --- | --- |
| Developer Safe (`developer`) | Warns on sensitive source, redacts provider tokens/database URLs/PII, blocks private keys and canaries |
| Strict Safe (`strict`) | Blocks protected files and secret categories; requires approval for auth/payment/infra paths; blocks risky commands and MCP behavior |
| Enterprise Safe (`enterprise`) | Adds fail-closed behavior and requires approval for any detected risk that was not already blocked |

All levels disable raw cloud telemetry, stay local-only by default, scan brokered requests/responses, enable canary checks, and keep the What AI Saw ledger. Generated project policy protects `.env*`, private keys, credentials, customer-data patterns, and production secret files. Sensitive patterns include `src/auth/**`, `src/payments/**`, and `infra/**`.

Commands:

- `SoterAI: Enable AI Safe Mode`
- `SoterAI: Disable AI Safe Mode`
- `SoterAI: Show AI Safe Mode Rules`
- `SoterAI: Configure Safe Mode`

Safe Mode can only escalate a base decision. A canary always blocks. Its enforcement applies to SoterAI-built context, explicit scans, and brokered traffic; it cannot impose policy on traffic or file reads that bypass SoterAI.
