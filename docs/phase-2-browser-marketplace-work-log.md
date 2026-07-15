# Phase 2 — Browser Marketplace Work Log

**Date:** 2026-07-14 · **Engineer:** Memo v2.5 (release engineering pass)

Format per action: task · command · result · files · why · validation · blocker.

---

### A1 — Inventory & verify Phase-1 state
- **Command:** read manifests/package/validator; `git status`
- **Result:** manifest already hardened (20 https hosts, no `<all_urls>`, no localhost); dev/prod split exists.
- **Validation:** `npm run validate:extension-permissions` → PASS.
- **Blocker:** none.

### A2 — URL validation
- **Command:** `curl` website/privacy/support/terms/security.
- **Result:** all 200. No publicvm in ext/store/scripts (only unrelated `.env` + history docs).
- **Files:** `docs/phase-2-url-validation-report.md`.

### A3 — Build + typecheck
- **Command:** `npm --prefix apps/extension run typecheck && ... run build`
- **Result:** both clean.

### A4 — Store validation + package
- **Command:** `run validate:store`, `run package`
- **Result:** validation PASSED; built `soter-extension-edge-v0.1.2.zip` + `soter-extension-chrome-v0.1.2.zip` (0.20 MB each).
- **Files:** `docs/phase-2-browser-package-inspection.md`.

### A5 — ZIP inspection
- **Command:** `unzip -l` + Python central-directory read.
- **Result:** 17 files, forward-slash entries, no `.env`/maps/dev-manifest/localhost/publicvm. Clean.

### A6 — Security review
- **Command:** grep eval/new Function/innerHTML/console token/`.env`; read api-client + overlay.
- **Result:** no eval/remote code; 3 innerHTML sinks all escaped via `escapeHtml`; token HTTPS-only, never logged. `npm audit --omit=dev` → 0 vulns.
- **Files:** `docs/phase-2-browser-extension-security-review.md`.

### A7 — FIX: extension test RSP-010 failing
- **Command:** `npm run test:extension` → 119/120, RSP-010 fail.
- **Root cause:** Phase-1 rewrite of `docs/extension-store/permission-justification.md` dropped the response-scanning admin-disable language the test asserts.
- **Fix:** added "Response Scanning Controls" section (response scan + admin-disable-per-destination + unrelated-not-monitored).
- **Files changed:** `docs/extension-store/permission-justification.md`.
- **Validation:** `npm run test:extension` → **120/120 pass**.

### A8 — Chrome-side docs authored
- **Files:** `chrome-permission-justification.md`, `chrome-privacy-disclosure.md`, `chrome-store-listing.md`, `chrome-reviewer-notes.md`, `chrome-web-store-submission-pack.md`.

### A9 — Asset checklist
- **Command:** PIL dimension read of all icons/screenshots/promos.
- **Result:** icons 16/32/48/128/192/512 exact; 6 screenshots 1280×800; promos 440×280 + 1400×560; logo 300×300. All present.
- **Files:** `docs/extension-store/asset-checklist.md`.

### A10 — Resubmission packs + Phase-2 reports
- **Files:** `edge-certification-resubmission-pack.md`, plus `phase-2-*` inventory/url/permission/security/package/runtime/work-log + `PHASE-2-BROWSER-MARKETPLACE-COMPLETE.md`.

### A11 — Runtime smoke test
- **Result:** no driveable browser in this environment → **EVIDENCE REQUIRED**, not PASS.
- **Files:** `docs/phase-2-browser-runtime-smoke-test.md`.

---

## Remaining blockers
1. Runtime smoke test in Edge + Chrome (human, evidence required).
2. Actual Partner Center / Web Store upload + submission (account action).
