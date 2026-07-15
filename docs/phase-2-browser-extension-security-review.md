# Phase 2 — Browser Extension Security Review

**Date:** 2026-07-14 · **Version:** 0.1.2

## Code-smell scan results

| Check | Command | Result |
|---|---|---|
| `eval(` | grep src | **none** |
| `new Function` | grep src | **none** |
| Remote JS / dynamic remote `import()` | grep src | **none** |
| `innerHTML` | grep src | 3 sinks — `content/overlay.ts`, `popup/PopupApp.tsx`, `sidepanel/SidePanelApp.tsx` |
| `console.*` of token/secret/authorization | grep src | **none** |
| `.env` in package | grep apps/extension | **none** |

### innerHTML review — all safe

All three `innerHTML` writes interpolate dynamic values **only** through
`escapeHtml()` (HTML entity-encodes `& < > " '`). Static markup + escaped values;
no untrusted scan text reaches the DOM unescaped. Verified in `content/overlay.ts:47-53`
(`userMessage`, `action`, `detected`, `rewrittenSafeText` all wrapped) and the popup/
sidepanel renderers which import `escapeHtml` from `lib/enrollment-ui`.

## Data / transport

- **Token:** stored in `chrome.storage`, sent only as `x-soter-extension-token` header
  over HTTPS (`lib/api-client.ts:172`). Never logged, never written to DOM.
- **Transport:** all `fetch` targets `https://`; base fallback is `https://unknown.invalid`.
  Store manifest contains no `http://` host (enforced by `validate-store-manifest.mjs`).
- **No overcollection:** no `tabs`/`history`/`webNavigation`/`cookies`/`downloads`/
  `<all_urls>`. Cannot observe pages outside declared AI hosts.
- **No raw content leaves the browser:** only redacted previews + hashes + metadata.

## CSP / remote code

MV3 default CSP; no `content_security_policy` override loosening it; no remote script
tags, no remote code execution. `npm audit --omit=dev` → **0 vulnerabilities**.

## Verdict

**PASS.** No security blockers for store submission.
