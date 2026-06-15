# Agent Tool Security Review

Phase 11 adds a defensive tool-call firewall scaffold:

- Unknown tools denied by default.
- High-risk categories require approval or are blocked.
- Code execution is blocked in the scaffold.
- Tool inputs/outputs are redacted before logging.
- Approval and rollback logs are modeled.

Do not enable arbitrary shell execution.

