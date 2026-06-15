# Performance Fixes Applied

Created: 2026-06-15 14:42:07 +05:30

This document records only performance changes that have passed focused verification. Provider-dependent and production-load claims remain separate.

## CRG-014 Dashboard Risk Aggregation

Status: `IN_PROGRESS`

- Before: the dashboard fetched up to 2,000 `GuardLog.riskTypes` arrays and grouped them in application memory.
- Target: aggregate risk labels in PostgreSQL with project/date filters and return at most five count rows.
- Data minimization: the query must not select original, redacted, or safe prompt/output text.
- Verification: pending.
