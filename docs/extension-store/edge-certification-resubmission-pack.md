# Edge Add-ons — Certification Resubmission Pack

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Product ID:** `4194ac19-df9a-4026-a5c3-62fb5bdee15d`
**Package:** `apps/extension/dist/soter-extension-edge-v0.1.2.zip` (17 files, 0.20 MB)
**Date:** 2026-07-14

## Fixed issues (from the 2026-07-13 cert report)

See `edge-certification-fix-report.md` for the full table. Highlights:

- Removed unused `activeTab`, `scripting`, and `identity` optional permissions.
- Pinned all hosts to `https://`; removed localhost/`127.0.0.1` from the store manifest (moved to `manifest.dev.json`).
- Removed retired `bard.google.com`.
- Rewrote description to match the single-purpose statement; bumped version 0.1.1 → 0.1.2.
- Replaced retired public-VM listing/privacy URLs with `https://soterai.in/*` (all live, 200).
- Restored response-scanning admin-control language in `permission-justification.md` (fixed test RSP-010 → 120/120 pass).

## Partner Center fields (paste verbatim)

| Field | Value |
|---|---|
| Website | https://soterai.in |
| Privacy policy URL | https://soterai.in/privacy |
| Support URL | https://soterai.in/support |

## Permission justification

See `edge-permission-justification.md`. 4 API permissions (`contextMenus`,
`sidePanel`, `storage`, `alarms`), 20 https-only host permissions, no broad access.

## Reviewer notes (Notes for Certification)

Use `edge-reviewer-notes.md`. Summary to paste:

> No SoterAI test account credentials are required. The submitted store build includes
> a built-in local demo policy for reviewer testing. After installing, open a supported
> AI site such as `https://chatgpt.com`, paste the synthetic test prompt from the
> reviewer notes, and submit it. The extension displays a local warning/redaction
> overlay. Enterprise enrollment is only needed for customer-specific policy sync and
> admin reporting, not for certification testing.

Reviewer token: `[ADD LIMITED REVIEWER TOKEN IN PARTNER CENTER ONLY]` — do not commit a real token.

## Final package path

`apps/extension/dist/soter-extension-edge-v0.1.2.zip`

## Screenshots list

6 screenshots at 1280×800 + logo 300×300 + promo tiles (440×280, 1400×560) — see
`asset-checklist.md`. All under `docs/extension-store/edge-assets/`.

## Resubmission checklist

- [x] Manifest V3, version 0.1.2, single-purpose description
- [x] No unused/broad permissions; no `<all_urls>`; no `http://`; no localhost in store build
- [x] `validate:store` + `validate:extension-permissions` PASS
- [x] Typecheck + build pass; extension tests 120/120; `npm audit --omit=dev` 0 vulns
- [x] Icons 16/32/48/128/192/512 present; screenshots + promo assets present
- [x] Clean Edge ZIP produced and inspected
- [x] Live URLs confirmed 200 (website, privacy, support, terms, security)
- [ ] **Runtime smoke test in Edge — EVIDENCE REQUIRED** (see `docs/phase-2-browser-runtime-smoke-test.md`)
- [ ] Upload ZIP to Partner Center, paste listing + reviewer notes, submit
