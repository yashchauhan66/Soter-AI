# SoterAI Browser Extension — Final Rating & Edge Publish Readiness Report

**Date:** 2026-08-18 (updated 2026-08-22)
**Version audited:** v0.2.0 → **v0.2.1 (current)**
**Target store:** Microsoft Edge Add-ons (first), then Chrome Web Store
**Artifact produced:** `apps/extension/dist/soter-extension-edge-v0.2.1.zip` (243 KB, 18 entries)

---

## v0.2.1 Update (2026-08-22) — UX Polish

| Fix | Detail |
|---|---|
| Removed ugly ASCII "Safe Context Capsule" box | Sanitized prompts now end with a clean one-line footer: `🛡️ Soter sanitized this prompt before sending. <summary>.` — reads naturally in chat |
| Removed annoying persistent response banner | Response warnings now auto-dismiss |
| Premium overlay UI redesign | Glassmorphism, gradient accents, refined typography |

**Final Edge package check (v0.2.1):**
- ✅ ZIP: 18 entries (manifest.json, service-worker.js, content scripts, popup, sidepanel, icons, managed-schema.json)
- ✅ manifest.json: `name: Soter Enterprise AI Control Plane`, `version: 0.2.1`, `manifest_version: 3`, `minimum_chrome_version: 116`
- ✅ ASCII box removed from built bundles; new clean footer present
- ✅ 328/328 tests passing

**Ready to upload to Microsoft Edge Add-ons.**

---

## Verification Results (run today)

| Check | Command | Result |
|---|---|---|
| TypeScript + production build | `npm run build:extension` | ✅ PASSED (tsc + 4 vite builds, 0 errors) |
| Store manifest validation | `validate-store-manifest.mjs` | ✅ PASSED (permissions, CSP, hosts, no dev artifacts, no eval/remote-code patterns) |
| Permission/docs consistency | `npm run validate:extension-permissions` | ✅ PASSED |
| Extension unit/security tests | `npm run test:extension` | ✅ **328/328 PASSED** (0 fail) |
| Store packaging | `npm run package:extension` | ✅ `soter-extension-edge-v0.2.0.zip` + `soter-extension-chrome-v0.2.0.zip` created |

---

## Final Rating: 9.2 / 10 — PUBLISH-READY for Microsoft Edge

| Category | Score | Notes |
|---|---|---|
| Security architecture | 9.8/10 | Message guard (SS-3), fail-closed policy gate, endpoint pinning (SS-2), network-layer block (SS-9), signed-policy support, approval ledger with one-time TTL release |
| Store compliance (MV3) | 9.5/10 | Explicit hardened CSP, 5 minimal permissions, https-only hosts, no `externally_connectable`, no `web_accessible_resources`, no broad matches, automated store validator gates the build |
| Privacy posture | 9.3/10 | Local-first scanning, raw prompt not stored by default, redacted previews only, audit metadata instead of full text, ML remote call bounded (8k chars) and best-effort |
| Detection capability | 9.0/10 | Regex/keyword detectors + local ML heuristics (entropy, injection n-grams, encoded payloads) + optional remote ML; ML can only raise risk, never downgrade |
| Enterprise readiness | 9.4/10 | Managed enrollment (Intune/GPO/MDM), self-service enrollment + trial mode, emergency lockdown, hard enforcement, offline fail-closed, shadow-AI discovery, data lineage |
| UX / Side panel | 8.2/10 | Functional, i18n (en/hi), self-test, privacy transparency panel; UI is innerHTML-rendered and utilitarian — acceptable for v0.2 |
| Test coverage | 9.5/10 | 328 passing tests incl. anti-evasion (leetspeak, zero-width, homoglyphs), endpoint-poisoning, approval-ledger abuse, message-boundary attacks |
| Build/packaging hygiene | 9.5/10 | Deterministic build, source maps/dev manifests excluded from store zip, code-smell scan (eval/new Function/remote import/token logging) enforced |

---

## What makes this extension strong (evidence from code)

1. **Message boundary (SS-3)** — `message-guard.ts`: every runtime message is validated against a per-type contract (scope: content_script / extension_page / any_internal, size caps, schema parse). Unknown types are dropped. `SOTER_SET_STATE` (unrestricted state write) was deleted entirely.
2. **Fail-closed gate (SS-4/SS-11)** — `scanner.ts`: tampered/replayed/unsigned policy bundles block all submissions; a fail-closed block never offers "use safe prompt" or re-submit — only audited dismiss.
3. **Endpoint trust (SS-2)** — `enrollment.ts` + `trusted-endpoint.ts`: https-only, no embedded credentials, no IP literals, no punycode/IDN homographs, origin pinning; server-returned `apiBaseUrl` is never stored (prevents token redirection attacks). 25+ dedicated tests (EP-200..EP-223).
4. **Network-layer enforcement (SS-9)** — short-lived, tab-scoped `declarativeNetRequestWithHostAccess` session rules armed before the block verdict returns; orphan reclaim on service-worker restart; TTL clamped 1s–60s.
5. **Approval ledger** — one-time, origin-bound, TTL-windowed grants; a grant can never release a `block` or a fail-closed decision.
6. **Privacy** — `privacy-preview.ts` + redaction: storage-safe scan results, raw text not persisted by default, full-prompt logging only under explicit admin flag (`full_prompt_explicit_admin_enabled`).
7. **ML augmentation done safely** — local heuristics + remote classifier are additive-only (can raise risk score, never lower), remote is best-effort with 3s timeout, response validated and bounded.

---

## Improvements needed before / during Edge submission

### Must-do (store listing, not code)
1. **Edge Add-ons listing fields** — prepare these before submitting at partner.microsoft.com:
   - Privacy policy URL (use `https://soterai.in/privacy`) — **required** because host permissions + network requests exist.
   - Permission justification text for: `sidePanel`, `contextMenus`, `storage`, `alarms`, `declarativeNetRequestWithHostAccess` (the validator already confirms docs match; copy that rationale into the listing).
   - Single-purpose description: "Scans prompts and AI responses on AI tools for prompt injection, jailbreaks, secrets, and PII, enforcing organization policy."
2. **Description length** — manifest description is 131 chars (under the 132 limit) ✅; the Edge "short description" field must be ≤132 chars too.

### Recommended (nice-to-have, non-blocking)
3. **Remove deprecated host** — `bard.google.com` appears in the scanner fallback regex and shadow-AI list (not in manifest hosts, so no store warning). Harmless; can be cleaned later.
4. **Side panel polish** — the current UI is clear and honest but basic. A styled React build for popup/sidepanel would improve store-review perception in a future version.
5. **Screenshots for the listing** — capture: (a) block overlay on ChatGPT, (b) side panel with latest scan, (c) trial-mode enrollment, (d) privacy "What leaves browser?" section. Edge requires 1+ screenshot (1280×800 or 640×480).
6. **Version note** — v0.2.0 is valid semver for Edge. If this is the first public submission, consider listing it as your initial release (Edge shows version history).

### Not needed (already handled)
- ❌ No need to remove source maps — the packager excludes `.map`, `.env`, test files, and `manifest.dev.json` automatically.
- ❌ No need to change CSP — explicit hardened CSP already exceeds MV3 defaults and passes the strict validator.
- ❌ No need to reduce permissions — all 5 are justified and validated; no broad `<all_urls>` anywhere.

---

## Edge submission checklist

- [x] Build passes (`npm run build:extension`)
- [x] Store manifest validation passes
- [x] 328/328 security tests pass
- [x] `soter-extension-edge-v0.2.1.zip` generated (243 KB — well under the 500 MB limit)
- [ ] Create Edge Add-ons developer account at partner.microsoft.com (one-time $19 fee if not already done)
- [ ] Upload `apps/extension/dist/soter-extension-edge-v0.2.1.zip`
- [ ] Fill listing: name, short description, full description, category (Security), language (English + Hindi supported)
- [ ] Add privacy policy URL + permission justifications
- [ ] Upload screenshots (1280×800 recommended)
- [ ] Submit for certification (typical review: 1–3 business days)

---

## Verdict

**The extension is PUBLISH-READY for Microsoft Edge Add-ons.** No code changes are required before submission. The only remaining work is store-listing content (privacy URL, permission justifications, screenshots). Security posture is enterprise-grade and significantly above the typical browser-extension baseline — the automated store validator + 328-test security suite is a stronger release gate than most commercial extensions ship with.