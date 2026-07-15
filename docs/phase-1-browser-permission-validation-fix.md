# Phase 1 Browser Permission Validation Fix

## Before

`npm run validate:extension-permissions` failed because the production manifest declared exact HTTPS host permissions, while `docs/extension-store/permission-justification.md` still documented older wildcard-scheme, dev, and optional permission behavior.

Failure included missing exact documentation for the 20 production hosts.

## After

Production manifest permissions:

- `contextMenus`
- `sidePanel`
- `storage`
- `alarms`

Production host permissions:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://www.perplexity.ai/*`
- `https://poe.com/*`
- `https://openrouter.ai/*`
- `https://replit.com/*`
- `https://*.replit.dev/*`
- `https://stackblitz.com/*`
- `https://*.stackblitz.io/*`
- `https://codesandbox.io/*`
- `https://*.csb.app/*`
- `https://github.dev/*`
- `https://*.github.dev/*`
- `https://bolt.new/*`
- `https://v0.dev/*`
- `https://lovable.dev/*`
- `https://openwebui.com/*`
- `https://soterai.in/*`

## Removed/Not In Store Build

- No `<all_urls>`.
- No `*://*/*`.
- No `http://`, localhost, or `127.0.0.1`.
- No optional wildcard host permissions.
- No old public VM production URL.
- No deprecated `bard.google.com`.

## Validation Output

`npm run validate:extension-permissions`

Result:

```text
Manifest permissions: contextMenus, sidePanel, storage, alarms
Optional permissions: none
Host permissions: 20
Optional host permissions: none
PASS: manifest permissions and store docs match.
```

Remaining risk: none for manifest/docs parity. Store reviewers may still ask why each AI destination is listed; the revised permission doc now gives the justification.
