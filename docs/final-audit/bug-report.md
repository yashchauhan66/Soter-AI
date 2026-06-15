# Bug Report

## Bugs Fixed During Audit

| Severity | Bug | Root cause | Fix |
| --- | --- | --- | --- |
| HIGH | Sign-in open redirect risk | `callbackUrl` query value was passed to client `router.push()` without validation. | Added `lib/auth/callback.ts` and used `safeCallbackUrl()` in `app/signin/page.tsx`; added regression test. |
| HIGH | Public badge script HTML/style injection risk | `badge.js` used `innerHTML` with API-provided `brandColor`. | Replaced with DOM APIs, `createTextNode`, and strict `safeColor()` allowlist; added regression test. |
| MEDIUM | Output guard missed prose system-prompt leakage | Detector caught structured `system prompt:` but not prose `system prompt is`. | Added targeted output detector rule and test. |
| MEDIUM | API key form showed red error after successful generation | Async React event used `event.currentTarget.reset()` after `await`, where `currentTarget` may be null. | Captured `formElement` before await in `ApiKeyManager`. |
| MEDIUM | Webhook create form had same async reset bug | Same React event lifecycle issue. | Captured `formElement` before await in `WebhookManager`. |
| MEDIUM | Production build failed before local secret fix | Local `.env` had missing/short `AUTH_SECRET`/`NEXTAUTH_SECRET`. | Generated local 64-char secrets; updated `.env.example` placeholders. |
| LOW | `.env.example` contained local-looking DB credential and incomplete env list | Example config was stale. | Replaced DB URL placeholder and added missing worker/ML/SDK/env placeholders. |

## Remaining Bugs / Limitations

| Severity | Area | Finding | Recommendation |
| --- | --- | --- | --- |
| HIGH | SAML | ACS validates assertions but does not mint a real application session; comments say to wire this up. | Complete SAML session exchange and add browser/API tests. |
| HIGH | E2E | No Playwright/Cypress browser suite for signup/login/dashboard/project/key/webhook/RAG flows. | Add E2E smoke suite before production launch. |
| MEDIUM | Build warnings | `next-auth`/`jose` Edge runtime warnings appear during build. | Review middleware/runtime imports; keep monitoring for runtime edge failures. |
| MEDIUM | Linting | `npm run lint` is missing. | Add Next/ESLint config and script. |
| MEDIUM | Phase 11 | Many competitive features are count dashboards and helpers, not full product workflows. | Promote scaffold modules into end-to-end features gradually. |
| MEDIUM | Performance | Some dashboards query large sets (`take: 2000`, `take: 10000`) or lack pagination. | Add cursor pagination and aggregate tables. |
| LOW | UI | Several pages are dense/minified one-line components, harder to maintain. | Refactor only when touching those areas. |

## Command Failures Observed

- `npm run build` initially failed because production auth secret was missing/short.
- `npm run build` later hit stale `.next` Turbopack runtime after interrupted/dev-overlapping builds; clean build passed after stopping dev server and running `npm run clean`.
- `npm run lint` failed because no script exists.

