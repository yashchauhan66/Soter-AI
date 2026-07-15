# Phase 2 — Permission Validation Report

**Date:** 2026-07-14

## Before (v0.1.1, rejected by Edge)

- API: `contextMenus`, `sidePanel`, `storage`, `alarms`, **`activeTab`**, **`scripting`**
- Optional: **`identity`**, **`identity.email`**
- Hosts: `*://` scheme (included `http://`), **`localhost`**, **`127.0.0.1`**, **`bard.google.com`**, and retired publicvm listing URLs.

## After (v0.1.2, this state — no manifest change needed in Phase 2)

- API: `contextMenus`, `sidePanel`, `storage`, `alarms`
- Optional: none · optional_host: none
- Hosts: 20, all `https://`, no localhost, no `<all_urls>`.

The manifest was already hardened in Phase 1. Phase 2 verified it and fixed the doc
regression that broke test RSP-010.

## Removed domains

`http://localhost/*`, `http://127.0.0.1/*` (→ dev manifest only), `bard.google.com`,
all `http://` scoping, retired publicvm listing/privacy URLs.

## Kept domains + justification

Each of the 20 hosts maps to a shipped adapter (`src/adapters/`) or is the API host
(`soterai.in`). Full mapping in `docs/extension-store/edge-permission-justification.md`
and `chrome-permission-justification.md`. Wildcard subdomains (`*.replit.dev`,
`*.stackblitz.io`, `*.csb.app`, `*.github.dev`) are unavoidable because those
platforms serve per-project generated subdomains; scheme is pinned to https and parent
domains are fixed.

## Validation output

```
$ npm run validate:extension-permissions
Manifest permissions: contextMenus, sidePanel, storage, alarms
Optional permissions: none
Host permissions: 20
Optional host permissions: none
PASS: manifest permissions and store docs match.
```

```
$ npm --prefix apps/extension run validate:store
✅ Store manifest validation PASSED (Soter Enterprise AI Control Plane v0.1.2)
   permissions: contextMenus, sidePanel, storage, alarms
   host_permissions: 20 hosts, all https, no localhost
```

## Remaining risk

Low. Wildcard-subdomain code-sandbox hosts are the only broad-ish scope, fully
justified and reducible on reviewer request (listing-only change, no code impact).
