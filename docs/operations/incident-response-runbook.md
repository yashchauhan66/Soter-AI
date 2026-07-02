# Incident Response Runbook

## Severity Levels
- **P0 (Critical):** Extension crashes browser, or backend is completely down.
- **P1 (High):** Extension blocks 100% of valid prompts.
- **P2 (Medium):** Minor false positives or UI glitches.

## Process
1. Identify issue via alerts or user report.
2. Triage severity.
3. If P0, advise admin to use MDM rollback (see rollback-plan.md).
4. Gather logs from Soter dashboard.
5. Mitigate via policy update if possible.
6. Post-mortem after resolution.
