# Edge Add-ons — Certification Notes

**Extension:** Soter Enterprise AI Control Plane — v0.1.2

These notes address the Microsoft Edge Add-ons policy areas most commonly cited in
certification reports, and state how this build complies.

## Manifest & code integrity

- **Manifest V3**, service-worker background. No background pages.
- **No remote code.** No `eval`, no `new Function`, no remote `import()`, no
  injected `<script src="http…">`. All executable code ships inside the package.
  Enforced by the code-smell scan in `scripts/validate-store-manifest.mjs`.
- **Default MV3 CSP.** No `content_security_policy` override; `unsafe-eval` and
  `unsafe-inline` are not used by the extension's own pages.
- **DOM writes are escaped.** The three `innerHTML` sinks (`content/overlay.ts`,
  `popup/PopupApp.tsx`, `sidepanel/SidePanelApp.tsx`) render extension-controlled
  markup and pass every interpolated value through `escapeHtml()`. No untrusted page
  content is written as HTML.

## Permissions (least privilege)

- Reduced from 6 → 4 API permissions; removed `activeTab` and `scripting` (unused).
- Removed `identity` / `identity.email` optional permissions (unused).
- Host permissions are specific AI destinations only, `https://` scheme, no
  `<all_urls>`, no `http://`, no `localhost` in the store build.
- See `edge-permission-justification.md` for the per-permission mapping.

## Data & privacy

- Raw prompts / responses / file contents / copied text never leave the browser.
- Only redacted metadata and hashes are sent, over HTTPS, to the org's own API.
- No data sale, no advertising use, no general browsing-history tracking.
- See `edge-privacy-disclosure.md`. Privacy URL: https://soterai.in/privacy

## Dev vs. store build separation

- `manifest.json` = production/store manifest (https-only, no localhost).
- `manifest.dev.json` = development only; adds `http://localhost` +
  `http://127.0.0.1` for local mock-page testing. It is **excluded from the zip**
  and the validator fails the build if it appears in `dist/extension`.

## Package hygiene

The submitted zip (`dist/soter-extension-v0.1.2.zip`, 17 files) contains only:
manifest, managed-schema, icons, and compiled JS/HTML for background, content,
popup, and side panel. No `.env`, no source maps, no test/spec files, no
`manifest.dev.json`. Verified via `unzip -l` and the validator's file-hygiene check.

## Enterprise context

This is an enterprise DLP/security extension. Its purpose is to *reduce* risk from
AI tools, not to collect user data. Managed deployment (`managed-schema.json`) lets
IT admins pre-configure org ID and API base URL via Edge enterprise policy; end users
can also self-enroll via the popup.
