# Edge Certification Fix Report

**Extension:** Soter Enterprise AI Control Plane
**Version:** 0.1.1 (rejected) → **0.1.2** (resubmission)
**Date:** 2026-07-14
**Package:** `apps/extension/dist/soter-extension-v0.1.2.zip` (17 files, 0.20 MB)

This report addresses the Microsoft Edge Add-ons certification report completed on
2026-07-13 for Product ID `4194ac19-df9a-4026-a5c3-62fb5bdee15d`.

## Issues found and fixed

| # | Certification issue | Root cause | Policy area | Files changed | Fix |
|---|---|---|---|---|---|
| 1 | Unused / unjustified API permissions | `activeTab` and `scripting` declared but never called (content scripts are static; no `chrome.tabs`/`executeScript`) | Least privilege | `apps/extension/manifest.json`, `README.md`, `docs/.../permission-justification.md` | Removed both permissions |
| 2 | Unused optional permissions | `identity`, `identity.email` declared but no `chrome.identity` usage | Least privilege | `apps/extension/manifest.json` | Removed `optional_permissions` entirely |
| 3 | Insecure `http://` host scope | Host permissions used `*://` scheme, which includes `http://` | Secure transport | `apps/extension/manifest.json` | All hosts pinned to `https://` |
| 4 | Dev-only hosts in store build | `*://localhost/*` and `*://127.0.0.1/*` shipped in the store manifest | Store hygiene / privacy | `apps/extension/manifest.json`, new `manifest.dev.json` | Removed from store manifest; moved to dev-only manifest |
| 5 | Dead host permission | `*://bard.google.com/*` (Bard is retired, redirects to Gemini) | Least privilege | `apps/extension/manifest.json` | Removed |
| 6 | Vague description vs. single purpose | Description didn't state the security-scanning single purpose | Listing accuracy | `apps/extension/manifest.json` | Rewrote description to match single-purpose statement |
| 7 | Version not incremented | Resubmission must exceed rejected version | Submission rule | `manifest.json`, `package.json` | Bumped `0.1.1` → `0.1.2` |
| 8 | Missing / inaccurate compliance docs | Old docs listed removed permissions and an `*://*/*` optional host | Privacy & data-use disclosure | 5 new `edge-*` docs + superseded banner on legacy doc | Authored accurate Edge disclosure, justification, listing, reviewer, cert notes |
| 9 | Metadata Website URL did not resolve | Partner Center listing used the retired public VM privacy URL as Website | 1.1.3 | `edge-store-listing.md`, `edge-reviewer-notes.md` | Use `https://soterai.in` for Website and `https://soterai.in/privacy` for Privacy policy URL |
| 10 | Privacy policy URL did not resolve | Same retired public VM URL was used for privacy metadata | 1.5.2 | `edge-store-listing.md`, public `/privacy` page contacts | Privacy URL standardized to `https://soterai.in/privacy`; public page contact emails standardized to `@soterai.in` |
| 11 | Test credentials missing | Reviewer notes still contained a placeholder enrollment code | 1.3.1 | `edge-reviewer-notes.md` | Removed placeholder; added explicit explanation that no SoterAI credentials are required because the store build includes a local demo policy |

## Security validation (Step 7) — all clear

| Check | Result |
|---|---|
| `eval(` / `new Function` | None |
| Remote code / remote dynamic `import()` / injected `<script src=http>` | None |
| `innerHTML` unsafe usage | 3 sinks, **all** interpolate via `escapeHtml()` — safe |
| `chrome.tabs` broad access / `executeScript` | None (permission removed) |
| `<all_urls>` / `*://*/*` | None |
| `http://` production endpoints | None (https-only) |
| `console.*` of token/secret/authorization | None |
| Token storage/transport | `chrome.storage` + `x-soter-extension-token` header, HTTPS, never logged |
| Hardcoded secrets | None |

Automated enforcement added: `scripts/validate-store-manifest.mjs` scans the built
package for all of the above and fails `npm run package` if any regress.

## Files changed (exact)

**Modified**
- `apps/extension/manifest.json` — permissions, hosts, description, version
- `apps/extension/package.json` — version 0.1.2, `validate:store` script wired into `package`
- `apps/extension/README.md` — corrected permissions table + host-permission note
- `docs/extension-store/permission-justification.md` — superseded banner

**Added**
- `apps/extension/manifest.dev.json` — dev-only manifest (localhost)
- `apps/extension/scripts/validate-store-manifest.mjs` — store validator
- `docs/extension-store/edge-privacy-disclosure.md`
- `docs/extension-store/edge-permission-justification.md`
- `docs/extension-store/edge-certification-notes.md`
- `docs/extension-store/edge-store-listing.md`
- `docs/extension-store/edge-reviewer-notes.md`
- `docs/extension-store/edge-certification-fix-report.md` (this file)

## Build & validation results

- `npm run build` — ✅ success (background 46.9 kB, content 52.1 kB, lineage 14.5 kB)
- `npm run validate:store` — ✅ PASSED: `contextMenus, sidePanel, storage, alarms`;
  20 hosts, all https, no localhost, no unused permissions, no dev files in package
- `node scripts/package.js` — ✅ `soter-extension-v0.1.2.zip`, 17 files, 0.20 MB
- Zip inspection — ✅ no `.env`, no `.map`, no test/spec, no `manifest.dev.json`,
  icons + manifest + popup/sidepanel present

## Permissions after fix

- **API:** `contextMenus`, `sidePanel`, `storage`, `alarms`
- **Optional:** none
- **Host (20, https only):** ChatGPT, chat.openai.com, Claude, Gemini,
  www.perplexity.ai, Poe, OpenRouter, Replit (+`*.replit.dev`), StackBlitz
  (+`*.stackblitz.io`), CodeSandbox (+`*.csb.app`), GitHub Codespaces
  (+`*.github.dev`), Bolt, v0, Lovable, Open WebUI, soterai.in

## Resubmission checklist

- [x] Manifest V3, version bumped to 0.1.2
- [x] No unused / broad permissions; no `<all_urls>`; no `http://`; no localhost in store build
- [x] Single-purpose description set
- [x] Icons 16/32/48/128/192/512 present
- [x] No remote code; safe CSP (MV3 default); escaped DOM writes
- [x] No secrets/tokens logged; HTTPS-only transport
- [x] Privacy disclosure, permission justification, store listing, reviewer notes written
- [x] Clean package zip produced and inspected
- [x] Removed placeholder reviewer enrollment code from reviewer notes
- [x] Added a reviewer-testability explanation for "Submission Options > Notes for Certification"
- [ ] **Confirm live URLs** return 200 before resubmission:
      `https://soterai.in`, `https://soterai.in/privacy`, `https://soterai.in/support`
- [ ] **Runtime smoke test in Edge** (Path A) — see below; capture screenshots
- [ ] Upload zip to Partner Center, paste listing + reviewer notes, submit

## Partner Center metadata to paste

Use these exact URL values in Microsoft Partner Center. Do not use
the retired public VM host in any listing metadata.

| Field | Value |
|---|---|
| Website | `https://soterai.in` |
| Support URL | `https://soterai.in/support` |
| Privacy policy URL | `https://soterai.in/privacy` |

## Notes for Certification to paste

No SoterAI test account credentials are required. Soter Enterprise AI Control Plane
is an enterprise AI security/DLP extension, and the submitted store build includes
a built-in local demo policy for reviewer testing. After installing the extension,
open a supported AI site such as `https://chatgpt.com`, paste the synthetic test
prompt from the reviewer notes, and submit it. The extension should display the
local warning/redaction overlay. Enterprise enrollment is only needed for
customer-specific policy sync and admin reporting, not for certification testing.

## Remaining evidence required

1. **Runtime smoke test — EVIDENCE REQUIRED.** Edge was not driven in this
   environment. Execute the human checklist in `edge-reviewer-notes.md` §§4–9 and the
   result table in `docs/extension-testing/local-mock-ai-page-test.md`, capturing:
   popup opens, settings save, prompt-injection overlay, fake-secret redaction,
   benign prompt allowed, no console token leakage, no scanning on unrelated sites.
2. **Live URL confirmation** for the website, privacy, and support links used in
   the listing.
3. **Infrastructure redirect recommended:** if the retired public VM host remains in
   DNS, configure it to 301 redirect to `https://soterai.in`; otherwise ensure no
   Partner Center metadata references it.
