# Phase 2 — Browser Package Inspection

**Date:** 2026-07-14 · **Version:** 0.1.2

## Packages built

- `apps/extension/dist/soter-extension-edge-v0.1.2.zip` — 0.20 MB
- `apps/extension/dist/soter-extension-chrome-v0.1.2.zip` — 0.20 MB

Produced by `npm --prefix apps/extension run package` (build → validate:store → package.js).

## ZIP contents (17 files, identical for Edge/Chrome)

```
assets/icon-16.png  assets/icon-32.png  assets/icon-48.png
assets/icon-128.png assets/icon-192.png assets/icon-512.png
background/service-worker.js
chunks/constants-*.js  chunks/enrollment-ui-*.js
content/index.js  content/source-lineage-entry.js
popup/index.html  popup/index.js
sidepanel/index.html  sidepanel/index.js
managed-schema.json
manifest.json
```

Entry paths verified forward-slash separated (checked via zip central directory, not
the `unzip -l` Windows display which cosmetically shows backslashes).

## Compliance checklist

| Check | Result |
|---|---|
| `manifest.json` present | ✅ |
| Icons 16/32/48/128 present | ✅ (+192/512) |
| popup + sidepanel assets present | ✅ |
| service worker + content scripts present | ✅ |
| No `.env` | ✅ |
| No `.map` source maps | ✅ |
| No `manifest.dev.json` (dev manifest) | ✅ |
| No test/spec files | ✅ |
| No `localhost` / `127.0.0.1` | ✅ (store manifest is https-only) |
| No `publicvm` | ✅ |
| No secrets/tokens | ✅ |

## Verdict

**PASS.** Both packages are store-ready.
