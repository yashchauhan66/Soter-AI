# Package Structure Verification

Date: 2026-07-01
ZIP path: `apps/extension/dist/soter-extension-v0.1.0.zip`
ZIP SHA-256: `AC5609ED9C9761BD4EDC15D72687ECC8C7233638D59C09A9FA936EF33B4CCDC2`

## Folder Check

* extension folder exists: PASS
* manifest at root: PASS
* service worker exists: PASS
* content script exists: PASS
* popup exists: PASS
* sidepanel exists: PASS
* icons exist: PASS

Notes:

* Generated folder verified: `apps/extension/dist/extension/`
* Verified files:
  * `manifest.json`
  * `background/service-worker.js`
  * `content/index.js`
  * `content/source-lineage-entry.js`
  * `popup/index.html`
  * `popup/index.js`
  * `sidepanel/index.html`
  * `sidepanel/index.js`
  * `managed-schema.json`
  * `assets/icon-16.png`
  * `assets/icon-32.png`
  * `assets/icon-48.png`
  * `assets/icon-128.png`
  * `assets/icon-192.png`
  * `assets/icon-512.png`
* Requested filenames `popup/main.js` and `sidepanel/main.js` are not present. This is not a load blocker because the manifest and built HTML reference the generated `index.js` files.

## ZIP Check

* ZIP exists: PASS
* ZIP root manifest: PASS
* no nested root issue: PASS

ZIP root entries include `manifest.json` directly. The ZIP is not wrapped inside an extra `extension/` folder.

## Manifest Check

* manifest valid: PASS
* permissions match docs: PASS
* host permissions acceptable: PARTIAL

Notes:

* Manifest version: `0.1.0`
* Extension package version: `0.1.0`
* Manifest paths checked against generated files:
  * background service worker: PASS
  * content scripts: PASS
  * popup: PASS
  * side panel: PASS
  * icons: PASS
  * managed schema: PASS
* `npm run validate:extension-permissions` passed and confirmed the manifest matches `docs/extension-store/permission-justification.md`.
* Required `host_permissions` do not include `<all_urls>`.
* Manifest includes `optional_host_permissions: ["*://*/*"]` and a content script with `matches: ["<all_urls>"]` for source lineage entry. This must remain heavily documented for store review. It is currently documented as optional enterprise custom destination/source-app support and tests include unrelated-site privacy checks, but it is still a likely manual review question.

Final result: PASS for private/hidden beta package structure, with a review-risk note for `<all_urls>` source-lineage scope and optional all-host permission.
