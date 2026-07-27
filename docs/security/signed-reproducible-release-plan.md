# Signed And Reproducible Release Plan

Date: 2026-07-22

## Target release controls

- Generate SBOM from lockfiles for every package.
- Pin release dependencies and record package manager version.
- Build from a clean tagged commit.
- Record commit SHA, build command, Node version, OS, and artifact hashes.
- Sign VSIX and browser extension artifacts where the marketplace supports it.
- Publish SHA-256 checksums and provenance metadata.
- Prevent policy downgrade between build and publish.
- Keep rollback instructions for the last known-good release.

## Current status

- Preliminary SBOM artifact exists at `artifacts/security/sbom.spdx-lite.json`.
- The VS Code extension bundles successfully in local verification.
- Full reproducible build infrastructure, artifact signing, and independent verification are not yet complete.

Coverage: `PARTIAL_VISIBILITY` until signed provenance is automated in CI and independently reproducible.
