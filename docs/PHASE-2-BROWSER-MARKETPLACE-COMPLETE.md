# Phase 2 — Browser Marketplace Complete

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Date:** 2026-07-14

## 1. Summary

The extension is **package-ready and validation-green** for both Microsoft Edge
Add-ons and the Chrome Web Store. The manifest/permission/URL hardening was completed
in Phase 1; Phase 2 verified all of it against live commands, fixed a real doc-driven
test regression (RSP-010), authored the missing Chrome-side + submission docs, rebuilt
and inspected both store ZIPs, and confirmed live URLs. The **only** items not
achievable here are the live browser runtime smoke test (no driveable browser) and the
actual Partner Center / Web Store upload (account action).

## 2. Issues Fixed

- **RSP-010 test failure** — `permission-justification.md` had lost its response-scanning admin-control language (Phase-1 rewrite regression). Restored → **120/120 tests pass**.
- Missing Chrome-side compliance docs and submission packs — authored.
- Missing asset checklist and Phase-2 report set — authored.

(Manifest permission/host/URL cleanup itself was already correct from Phase 1 and was re-verified, not re-changed.)

## 3. URLs Fixed

All 200, live: `soterai.in`, `/privacy`, `/support`, `/terms`, `/security`. No
publicvm in extension/store/scripts. Details: `phase-2-url-validation-report.md`.

## 4. Manifest Before/After

| | Before (0.1.1) | After (0.1.2) |
|---|---|---|
| API perms | +`activeTab`,`scripting` | `contextMenus,sidePanel,storage,alarms` |
| Optional | `identity`,`identity.email` | none |
| Host scheme | `*://` (allowed http) | `https://` only |
| Dev hosts | localhost/127.0.0.1 in store | dev manifest only |
| Dead host | `bard.google.com` | removed |
| `<all_urls>` | — | never present |

## 5. Permissions Before/After

See `phase-2-permission-validation-report.md`. After: 4 API perms, 0 optional,
20 https-only hosts.

## 6. Permission Validation Result

`npm run validate:extension-permissions` → **PASS** (manifest ↔ docs match).
`validate:store` → **PASS** (20 hosts, all https, no localhost).

## 7. Privacy Policy Result

`https://soterai.in/privacy` → 200. Edge + Chrome privacy disclosures written with
extension-specific data-handling, HTTPS-only, no-sale/no-ads/no-tracking, token
storage, and deletion contact.

## 8. Store Listing Docs

Edge: `edge-store-listing.md`. Chrome: `chrome-store-listing.md`. Both with
single-purpose statement, ≤132-char short description, full description, URLs, assets.

## 9. Reviewer Notes

`edge-reviewer-notes.md`, `chrome-reviewer-notes.md` — install steps, synthetic test
prompt + fake secret + benign case, expected behavior, no real credentials, placeholder
reviewer token only.

## 10. Assets Status

All present and dimension-verified: icons 16/32/48/128/192/512, 6 screenshots 1280×800,
logo 300×300, promo tiles 440×280 + 1400×560. See `asset-checklist.md`.

## 11. Package Build Result

`typecheck` ✅ · `build` ✅ · `validate:store` ✅ · `package` ✅ →
`soter-extension-edge-v0.1.2.zip` + `soter-extension-chrome-v0.1.2.zip` (0.20 MB each).

## 12. ZIP Inspection

17 files, clean: manifest + icons + popup/sidepanel + SW/content scripts present; no
`.env`, no maps, no dev manifest, no test files, no localhost, no publicvm. See
`phase-2-browser-package-inspection.md`.

## 13. Runtime Smoke Test

⚠️ **EVIDENCE REQUIRED — NOT PASS.** No driveable browser in this environment. Manual
15-step checklist ready: `phase-2-browser-runtime-smoke-test.md`. Proxy evidence:
120/120 tests incl. redaction/privacy suites.

## 14. Final Command Results

| Command | Result |
|---|---|
| `validate:extension-permissions` | PASS |
| `apps/extension typecheck` | PASS |
| `apps/extension build` | PASS |
| `apps/extension validate:store` | PASS |
| `apps/extension package` | 2 ZIPs built |
| `test:extension` | 120/120 pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

## 15. Edge Resubmission Decision

**READY to upload** once runtime smoke evidence is captured. Pack:
`edge-certification-resubmission-pack.md` + `edge-certification-fix-report.md`.
Policies: 1.1.3 (Website URL) fixed; 1.5.2 (privacy URL) fixed; 1.3.1 (reviewer
testability) fixed.

## 16. Chrome Submission Decision

**READY to upload** once runtime smoke evidence is captured. Pack:
`chrome-web-store-submission-pack.md` with remote-code + data-use answers.

## 17. Remaining Evidence Required

1. Runtime smoke test in Edge **and** Chrome (human, screenshots).
2. Partner Center / Web Store upload + submit (account action).

## 18. Ready for Phase 3?

**Yes**, conditional on the two evidence items above. All engineering, packaging,
validation, security, and documentation deliverables are complete and green.
