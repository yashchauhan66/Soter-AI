# Security 100 Evidence Gate

Date: 2026-07-22

SoterAI must not claim `100/100`, `perfect`, `complete`, or `world-best zero-trust` unless every gate in `scripts/validate-security-100-evidence.ts` passes.

## Required gates

| Gate | Required evidence |
|---|---|
| 99+ foundation | `reports/security-99-evidence-gates.json` must pass through the existing 99 evidence gate. |
| OS-enforced process and network boundary | `reports/os-enforcement-attestation.json` proving process-tree blocking, shell bypass blocking, arbitrary egress blocking, metadata endpoint blocking, and filesystem escape blocking. |
| Enterprise extension allowlist enforcement | `reports/extension-control-attestation.json` proving non-allowlisted AI extensions are blocked by enterprise policy. |
| Signed reproducible release provenance | `reports/release-provenance-attestation.json` proving commit SHA, artifact hash, verified signature, reproducible build, and SBOM path. |
| Recovery and rollback drill | `reports/recovery-drill-report.json` proving restore and rollback with RTO <= 60 minutes and RPO <= 15 minutes. |

## Commands

- Advisory report: `npm run validate:security-100`
- Release-blocking mode: `npm run validate:security-100:strict`

The strict command must fail until all required external/deployment evidence exists. This is intentional and prevents accidental overclaiming.
