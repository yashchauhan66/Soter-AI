# Public Launch Audit Report

## Version Information
1. **Current extension version**: 0.1.0
2. **Root package version**: 0.2.0
3. **Manifest version**: 3
4. **Build output path**: `apps/extension/dist/extension`
5. **ZIP path**: `apps/extension/dist/soter-extension-v0.1.0.zip`

## Permissions Used
### Required Permissions
- `activeTab`
- `contextMenus`
- `sidePanel`
- `storage`
- `scripting`
- `alarms`

### Host Permissions
- `*://chatgpt.com/*`
- `*://chat.openai.com/*`
- `*://claude.ai/*`
- `*://gemini.google.com/*`
- `*://bard.google.com/*`
- `*://perplexity.ai/*`
- `*://poe.com/*`
- `*://openrouter.ai/*`
- `*://replit.com/*`
- `*://*.replit.dev/*`
- `*://stackblitz.com/*`
- `*://*.stackblitz.io/*`
- `*://codesandbox.io/*`
- `*://*.csb.app/*`
- `*://github.dev/*`
- `*://*.github.dev/*`
- `*://bolt.new/*`
- `*://v0.dev/*`
- `*://lovable.dev/*`
- `*://openwebui.com/*`
- `*://localhost/*`
- `*://127.0.0.1/*`

### Optional Permissions
- `identity`
- `identity.email`
- `*://*/*` (Optional Host)

## Store-Review Risks
- Broad scripting and content script injection on multiple popular domains (ChatGPT, Claude, etc.) might trigger manual review.
- The optional `*://*/*` permission is a high risk and requires clear justification (Enterprise custom domains).
- `identity.email` needs justification if not used directly for authentication (currently marked optional).

## Missing Public Listing Assets
- Professional screenshots `01-popup-onboarding.png` through `10-emergency-lockdown.png` are missing. Only raw dev test screenshots exist in `docs/extension-store/screenshots`.
- Promotional images (`promo-small-440x280.png`, `promo-large-920x680.png`, `marquee-1400x560.png`) are missing.

## Missing Public Onboarding Flow
- The extension needs to be verified for a graceful Demo/read-only mode when installed without an enterprise backend. If it crashes or shows a broken empty state, it will fail public review.

## Missing Backend/Live E2E Checks
- Need to verify if the Docker/Postgres backend starts properly and if the live end-to-end admin events are tracking successfully without hardcoded dev logic.

## Missing Privacy/Support/Compliance Docs
- Basic `privacy-policy.md`, `support-process.md`, and `customer-limitations.md` exist and are correctly tailored for public viewing. They clearly state the limitations (e.g. no raw data stored, beta limitations).

## Old Docs That Contradict Current Status
- `docs/extension-store/chrome-private-listing.md` and `edge-hidden-listing.md` should be explicitly superseded by the public listing files.

## Final Blocker List
1. Generate high-quality Store Assets (Screenshots & Promos).
2. Ensure the UI doesn't break in unauthenticated "Demo" mode (Phase 2).
3. Validate live E2E event propagation (Phase 4).
4. Run validation on permissions to ensure the optional host logic is bulletproof (Phase 5).
