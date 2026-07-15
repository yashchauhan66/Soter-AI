# Phase 1 Release Assets Audit

| Asset | Expected path | Exists | Restored/regenerated | Used by marketplace | Remaining issue |
| --- | --- | --- | --- | --- | --- |
| Extension public/build assets | `apps/extension/assets` | Yes | Existing | Yes | None |
| Extension production manifest | `apps/extension/manifest.json` | Yes | Fixed/validated | Yes | None |
| Extension dev manifest | `apps/extension/manifest.dev.json` | Yes | Added/kept | No | Must not ship to store |
| Store manifest validator | `apps/extension/scripts/validate-store-manifest.mjs` | Yes | Added/kept | Release gate | None |
| Edge screenshots | `docs/extension-store/edge-assets/edge-*.png` | Yes | Restored from git | Yes | None |
| Edge promo tiles/logo | `docs/extension-store/edge-assets/*promotional*.png`, `logo-300x300.png` | Yes | Restored from git | Yes | None |
| Chrome/Edge screenshots | `docs/extension-store/screenshots` | Yes | Existing | Yes | None |
| Permission docs | `docs/extension-store/permission-justification.md` | Yes | Rewritten to match manifest | Yes | None |
| Edge listing/reviewer/privacy docs | `docs/extension-store/edge-*.md` | Yes | Kept/cleaned | Yes | None |
| VS Code icon | `packages/vscode-extension/media/icon.png` | Yes | Existing | Yes | None |
| VS Code README/CHANGELOG/LICENSE | `packages/vscode-extension` | Yes | Existing/modified README | Yes | None |
| VS Code screenshots/demo GIF | `packages/vscode-extension/media/screenshots` | Yes | Existing | Yes | None |
| VS Code package | `packages/vscode-extension/soterai-ide-guard-0.2.0.vsix` | Yes | Existing modified binary | Yes | Human review exact binary |
| n8n README/package metadata | `packages/integrations/n8n` | Yes | Existing | Yes | None |
| n8n workflow/demo final assets | `final/n8n-soterai-*` | Yes | Restored from git | Yes | None |
| n8n package tarball | `packages/integrations/n8n/n8n-nodes-soterai-0.2.0.tgz` | Yes | Existing | Optional | Confirm version before publishing |

Result: required marketplace/demo assets are present. Deleted Edge and n8n assets were restored.
