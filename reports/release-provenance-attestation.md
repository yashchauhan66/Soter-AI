# VS Code Release Provenance

Generated: 2026-07-23T12:24:56.650Z

- Product: soterai-ide-guard
- Version: 0.2.1
- Commit: 6d4f5a1483ec52987a7f56faf488c2d6c55bb3e5
- Dirty worktree: yes
- SBOM present: yes (artifacts/security/sbom.spdx-lite.json)
- Signing status: unsigned-local-build
- Signature verified: no
- Reproducible build verified: no

## Artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `packages/vscode-extension/soterai-ide-guard-0.2.1.vsix` | 276881 | `sha256:b3fa49707bbefee7010ea24266c999c65e9e5299c44fab8b25a570e4b8225cb6` |
| `packages/vscode-extension/dist/extension.js` | 326439 | `sha256:bbe8ee8b633a6bd1947a39f0bff79cfa79f87f25d0c489041718fed41dee603a` |
| `packages/vscode-extension/dist/local-ai-broker.js` | 151801 | `sha256:d948f9b395f877bc3d0e268bdd115ba41506bcb8d4a53a7a3b7379b5a30084b6` |

## Claim Boundary

This proves local artifact integrity and checksum publication readiness. It is not a signed release and does not satisfy the 100/100 signed-provenance gate yet.

## Next Steps

- Sign the VSIX in CI with an organization-controlled certificate or marketplace-supported signing flow, then set signatureVerified only after verification.
- Run the same build from a clean tagged commit on a second machine/CI runner and compare artifact hashes before setting reproducibleBuildVerified.
