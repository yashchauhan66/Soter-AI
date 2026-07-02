# Security And Secret Scan Report

Date: 2026-07-02

## Tools
- `gitleaks`: NOT_AVAILABLE.
- `git-secrets`: NOT_AVAILABLE.
- Custom pattern scan: COMPLETED.
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities.

## Findings
- `.env` and `.env.production` contain deployment-style values. They are not tracked by git, based on `git ls-files`.
- Many matches in tests, docs, fixtures, demos, and detector code are synthetic examples or pattern references.
- Some packaged/dist files could not be read due Windows access restrictions; they were not source files required for publishing decisions.

## Status
PASS_WITH_LOCAL_ENV_WARNING.

Do not commit `.env` or `.env.production`. Rotate any value if it was ever shared outside this local machine.
