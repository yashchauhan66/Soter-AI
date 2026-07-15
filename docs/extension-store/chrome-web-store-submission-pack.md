# Chrome Web Store — Submission Pack

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Package:** `apps/extension/dist/soter-extension-chrome-v0.1.2.zip` (17 files, 0.20 MB)
**Date:** 2026-07-14

## 1. Single purpose

> SoterAI Guard helps users detect AI security risks in supported AI tools by scanning prompts and AI responses for prompt injection, jailbreaks, secrets, PII, and unsafe instructions.

## 2. Permission justifications

Full table in `chrome-permission-justification.md`. Summary:

| Permission | One-line justification |
|---|---|
| `contextMenus` | Right-click "Scan with Soter" on supported AI pages. |
| `sidePanel` | Show scan results, detected data types, enrollment status. |
| `storage` | Cache signed org policy, privacy mode, enrollment/auth state locally. |
| `alarms` | Lightweight periodic policy sync + health heartbeat. |
| Host permissions (20, https) | Inject scanning content scripts only on the supported AI tools + call the Soter API host. |

No `activeTab`, `scripting`, `tabs`, `identity`, `optional_permissions`, `<all_urls>`, or `http://` hosts.

## 3. Privacy disclosure

See `chrome-privacy-disclosure.md`. Privacy policy URL: **https://soterai.in/privacy** (live, 200).

## 4. Data usage answers (Privacy practices tab)

- **What user data do you collect?** Website content (limited to prompt/response text on supported AI hosts, processed locally), plus authentication information (enrollment token) and, for enterprise, user IDs for attribution.
- **Sell/transfer to third parties?** No.
- **Use for purposes unrelated to single purpose?** No.
- **Use to determine creditworthiness / lending?** No.

## 5. Remote code

> No. The extension does not download or execute remote JavaScript code. It only sends scan requests over HTTPS to the configured SoterAI API and renders local extension UI bundled with the extension.

## 6. Data use statement

> The extension processes user-selected or user-entered prompt/response text only to detect AI security risks. It does not sell data, does not use data for ads, and does not track unrelated browsing activity.

## 7. Screenshots & assets

Listed in `asset-checklist.md`. Minimum satisfied: 6 screenshots at 1280×800, store
icon 128×128, small promo 440×280, marquee 1400×560.

## 8. Package path

`apps/extension/dist/soter-extension-chrome-v0.1.2.zip`

Rebuild with: `npm --prefix apps/extension run package`
(runs build → `validate:store` → zip; fails if any store-unsafe pattern regresses).

## 9. Test instructions

See `chrome-reviewer-notes.md`. No real credentials required; synthetic test prompt +
fake secret provided; benign case documented.

## 10. Support contact

support@soterai.in · security@soterai.in

## 11. URLs (Developer Dashboard)

| Field | Value |
|---|---|
| Homepage URL | https://soterai.in |
| Support URL | https://soterai.in/support |
| Privacy policy URL | https://soterai.in/privacy |

## 12. Final checklist

- [x] MV3 manifest, version 0.1.2
- [x] `validate:store` PASS (permissions, https-only hosts, no localhost, no dev files)
- [x] `validate:extension-permissions` PASS (manifest ↔ docs match)
- [x] Typecheck + build pass; extension tests 120/120
- [x] `npm audit --omit=dev` → 0 vulnerabilities
- [x] Chrome ZIP built and inspected (no `.env`, no maps, no dev manifest, no localhost/publicvm)
- [x] Single purpose, permission justifications, privacy disclosure written
- [x] Screenshots + promo assets present at required sizes
- [x] Remote-code + data-use answers prepared
- [ ] **Runtime smoke test in Chrome — EVIDENCE REQUIRED** (browser not driveable in this environment; see `docs/phase-2-browser-runtime-smoke-test.md`)
- [ ] Upload ZIP, paste listing + privacy answers, submit
