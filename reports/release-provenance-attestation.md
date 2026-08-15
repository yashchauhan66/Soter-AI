# VS Code Release Provenance

Generated: 2026-08-15T12:53:55.424Z

- Product: soterai-ide-guard
- Version: 0.5.0
- Commit: 5c2421eea53bf23e3496bf40194466fb615a3694
- Dirty worktree: yes
- SBOM present: yes (artifacts/security/sbom.spdx-lite.json)
- Signing status: unsigned-local-build
- Signature verified: no
- Reproducible build verified: no

## Artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `packages/vscode-extension/soterai-ide-guard-0.5.0.vsix` | 1507523 | `sha256:9d8431eab444a6e77231d0be5ecf34443367414990d5c4f72ef7696188b41c0d` |
| `packages/vscode-extension/dist/extension.js` | 804875 | `sha256:ba153f7797c7f5223518367fd9de1f539e6197f90c43ccdbe9fc1f42d50865b2` |
| `packages/vscode-extension/dist/local-ai-broker.js` | 362095 | `sha256:bce1faa68b6322d9930b7d8b4321d46bd91708e37bee3b810c79576227c35bdc` |

## Claim Boundary

This proves local artifact integrity and checksum publication readiness. It is not a signed release and does not satisfy the 100/100 signed-provenance gate yet.

## Next Steps

- Sign the VSIX in CI with an organization-controlled certificate or marketplace-supported signing flow, then set signatureVerified only after verification.
- Run the same build from a clean tagged commit on a second machine/CI runner and compare artifact hashes before setting reproducibleBuildVerified.
