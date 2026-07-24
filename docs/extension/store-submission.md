# Store Submission — Microsoft Edge Add-ons & Chrome Web Store

This is the commercial-packaging checklist for shipping the Soter Enterprise AI
Control Plane extension. The build already produces store-ready artifacts:

```bash
cd apps/extension
npm run package   # build + validate:store + zip -> dist/soter-extension-{edge,chrome}-v<version>.zip
```

`npm run package` fails closed if the built manifest violates any store
certification rule (see `scripts/validate-store-manifest.mjs`): no broad host
match, https-only hosts, no dev artifacts (`.map`, `.test.js`, `manifest.dev.json`),
no `eval`/remote import, no token logged to console, required icons present.

> **Note on manifests:** Edge Add-ons and the Chrome Web Store both consume the
> same Chromium MV3 `manifest.json`. Do **not** add `browser_specific_settings`
> — that is a Firefox/Gecko key and Edge ignores it. The two zips are identical
> except for the filename; they exist so each store upload is tracked separately.

## Listing copy

- **Name:** Soter Enterprise AI Control Plane
- **Short description (≤132 chars):** Scans prompts and AI responses for prompt
  injection, jailbreaks, secrets, PII, and unsafe instructions on supported AI tools.
- **Category:** Developer tools / Productivity
- **Language:** English (add localized listings as needed)

## Permission justifications (required by both stores)

| Permission | Why it is needed |
|---|---|
| `storage` | Cache the signed org policy and enrollment config locally so scanning works offline. |
| `alarms` | Schedule periodic policy sync and heartbeat while the MV3 service worker is idle. |
| `contextMenus` | Let users scan selected text on demand. |
| `sidePanel` | Show policy status, sync freshness, and activity in the side panel. |
| `host_permissions` (listed AI domains only) | Inject the DLP content script **only** on the specific AI tools the policy monitors. No broad `<all_urls>` access. |

## Privacy

- Data handling: prompts/pastes/uploads are scanned **locally**; only redacted,
  privacy-safe previews and metadata leave the device (see `packages/shared/src/privacy.ts`).
- Publish the privacy policy URL (https://soterai.in/privacy) in both stores.
- Declare "does not sell data" and the single purpose (enterprise DLP for AI tools).

## Screenshots / assets checklist

- [ ] 1280×800 (or 640×400) screenshots: popup, side panel, a block overlay, dashboard devices view
- [ ] Store icon 128px (already in build: `assets/icon-128.png`)
- [ ] Small promo tile (Chrome: 440×280) if using the featured slot
- [ ] Short demo video (optional, improves review outcome)

## Microsoft Edge Partner Center submission

1. Create/ði use the Partner Center account with **Microsoft Edge program** enrolled.
2. New extension → upload `dist/soter-extension-edge-v<version>.zip`.
3. Fill listing copy, permission justifications, and privacy fields above.
4. For enterprise-only distribution, mark visibility as **private/unlisted** and
   use `ExtensionInstallForcelist` (see `edge-enterprise-force-install.md`).
5. Submit for certification; expect 1–7 business days.

## Chrome Web Store submission

1. Developer Dashboard → new item → upload `dist/soter-extension-chrome-v<version>.zip`.
2. Same listing copy, justifications, and privacy disclosures.
3. Set distribution (public, unlisted, or private to a Google Workspace domain for
   managed force-install via Google Admin).
4. Submit for review.

## Release checklist

- [ ] Bump `apps/extension/package.json` version (and `manifest.json` version).
- [ ] `npm run package` is green (validator passed).
- [ ] Both zips extract cleanly and load unpacked in Edge + Chrome.
- [ ] Force-install tested against a managed profile (see enterprise docs).
- [ ] Store listings updated with the new version's changes.
