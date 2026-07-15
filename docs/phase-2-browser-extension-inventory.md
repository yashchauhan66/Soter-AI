# Phase 2 — Browser Extension Inventory

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Date:** 2026-07-14
**Manifests:** `apps/extension/manifest.json` (store), `apps/extension/manifest.dev.json` (dev-only)

## Permissions

| | Store manifest | Dev manifest |
|---|---|---|
| API permissions | `contextMenus`, `sidePanel`, `storage`, `alarms` | same |
| optional_permissions | none | none |
| optional_host_permissions | none | none |
| host_permissions | 20 (https only) | 22 (adds `http://localhost/*`, `http://127.0.0.1/*`) |

## Host permissions (store)

ChatGPT (`chatgpt.com`, `chat.openai.com`), Claude, Gemini, Perplexity, Poe,
OpenRouter, Replit (+`*.replit.dev`), StackBlitz (+`*.stackblitz.io`), CodeSandbox
(+`*.csb.app`), GitHub Codespaces (`github.dev` +`*.github.dev`), Bolt, v0, Lovable,
Open WebUI, and `soterai.in` (API host only, no content script).

## Content script matches

Two content scripts (`content/index.js`, `content/source-lineage-entry.js`) injected
at `document_idle` on the 19 AI/editor hosts above (NOT on `soterai.in`).

## Components

- **Background service worker:** `background/service-worker.js` (module) — context menu, heartbeat, policy sync.
- **Content scripts:** DOM observer, submit interceptor, paste/file listeners, overlay, source-lineage.
- **Popup:** `popup/index.html` + `popup/index.js`.
- **Side panel:** `sidepanel/index.html` + `sidepanel/index.js`.
- **Options:** none (settings live in popup).
- **Managed storage schema:** `managed-schema.json`.
- **Adapters:** 15 site adapters under `src/adapters/`.

## Dev-only URLs

`http://localhost/*`, `http://127.0.0.1/*` — present **only** in `manifest.dev.json`;
blocked from the store package by `validate-store-manifest.mjs`.

## Production URLs

Website `https://soterai.in`, privacy `/privacy`, support `/support`, terms `/terms`,
security `/security` — all return 200 (see `phase-2-url-validation-report.md`).

## Data collected / processed

Prompt/response text (local only), pasted text (hash + redacted preview), uploaded
file metadata (hash/size/type), org/employee attribution (enterprise), device token
(`chrome.storage`, sent as `x-soter-extension-token` header). No raw content leaves
the browser. Details in `chrome-privacy-disclosure.md` / `edge-privacy-disclosure.md`.

## Assets

- Icons 16/32/48/128/192/512 — present, dimensions verified.
- 6 screenshots at 1280×800, logo 300×300, promo tiles 440×280 + 1400×560 — present.
- Full matrix in `asset-checklist.md`.

## Store docs present

- Edge: permission-justification, privacy-disclosure, store-listing, reviewer-notes, certification-notes, certification-fix-report, certification-resubmission-pack.
- Chrome: permission-justification, privacy-disclosure, store-listing, reviewer-notes, web-store-submission-pack.
- Shared: `permission-justification.md` (used by the validator), `asset-checklist.md`.

## CSP / remote code

No custom CSP override (MV3 default sandbox). No `eval`, no `new Function`, no remote
`import()`. All `innerHTML` writes escaped via `escapeHtml`.
