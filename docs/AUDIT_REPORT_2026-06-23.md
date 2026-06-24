# SoterAI — Deep Audit & Fix Report

**Date:** 2026-06-23
**Scope:** Full app (144 pages, 164 API routes), 5 SDK packages (JS, Python, LangChain, LlamaIndex, Vercel AI), 8 examples, docs, SEO, security, UI/UX.

---

## 1. Health baseline (all green)

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | ✅ 0 errors |
| ESLint | ✅ 0 errors (46 cosmetic warnings) |
| Unit test suite | ✅ **549 / 549 pass** |
| JS SDK (`@soterai/core`) typecheck+build+test | ✅ 14 / 14 pass |
| Python SDK (`soter`) pytest | ✅ 56 pass, 21 skipped |
| Production build (`next build`) | ✅ exit 0, all routes compile |

The codebase is fundamentally solid. No crashing bugs, no failing tests.

---

## 2. Security review — STRONG, no critical vulnerabilities

Reviewed auth, all 164 API routes, headers, injection surfaces, SSRF, secrets, rate limiting.

**Confirmed strong:**
- **Headers** (`next.config.mjs`): full CSP, HSTS (prod), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Permissions-Policy, `frame-ancestors 'none'`.
- **CSRF**: origin enforcement in `middleware.ts` on all cookie-auth mutations.
- **Access control**: every route authenticates via shared helpers (`requireUser`, `getActiveOrganization`, `requireProjectPermission`, `authenticateAdvancedSecurity`, `authenticateAgentPassport`, `authorizeScimRequest`, SAML signature verification). Queries are workspace-scoped (e.g. `api-keys` filters by `active.org.id`). **No IDOR gaps found.**
- **Injection**: zero `$queryRawUnsafe`/`$executeRawUnsafe`; all Prisma queries parameterized. Zero `dangerouslySetInnerHTML`.
- **Input validation**: routes use zod schemas (`apiKeySchema`, `dataCheckSchema`, etc.).
- **Rate limiting**: public endpoints (`signup`, `contact`, `request-password-reset`) use `enforcePublicRateLimit`.
- **Secrets**: API keys/raw prompts never logged; read from env server-side only.

**No action required.** Posture is launch-grade.

---

## 3. Bugs fixed (P0 — broke real users)

| # | Bug | Fix |
|---|---|---|
| 1 | **Wrong npm package name `@soter/core`** in every in-app docs page + 8 dashboard integration snippets + the real-chatbot example. `npm install @soter/core` and the imports **fail** — published name is `@soterai/core`. | Replaced `@soter/core` → `@soterai/core` across 17 files. |
| 2 | **`soter.protect({ output })` in quickstart** — `protect()` only accepts `{ input }`, so this throws `guardInput requires text` at runtime. | Changed to `soter.guardOutput({ aiResponse: llmReply })` + matching JSON-LD HowToStep. |
| 3 | **Python docs referenced a non-existent `cyberrakshak_guard` package** + a false "`Soter` is an alias for `CyberRakshakGuard`" claim → `ModuleNotFoundError`. | Removed all false legacy-import notes in `docs/integrations/python.md` + in-app python page. |
| 4 | **Python `retries=2`** constructor arg is silently ignored (real param is `max_retries`). | Fixed in `app/docs/python/page.tsx` (×2) and `python.md`. |
| 5 | **`protect_langchain_chain(my_chain.invoke, guard)`** — wrapper expects the chain object, not `.invoke`. | Fixed to `protect_langchain_chain(my_chain, guard)`. |
| 6 | **`pip install "soter[langchain]"`** — no such extra exists. | Removed the line. |
| 7 | False "stdlib `urllib` only / no HTTP dep" + false `CYBERRAKSHAK_*` env-fallback claims for Python. | Corrected to `requests`/`httpx`; removed false env claims. |

---

## 4. SEO fixed

| # | Issue | Fix |
|---|---|---|
| 1 | **Global canonical pointed every page at the homepage** (`alternates: { canonical: siteUrl }` in layout) — risked **de-indexing** pricing, comparison, benchmarks, compliance, etc. | Removed global canonical; added explicit `/` canonical to homepage so subpages self-canonicalize. |
| 2 | **Broken OG image** — metadata + JSON-LD referenced `/opengraph-image.png` which didn't exist → blank social cards & Organization logo. | Generated a real branded **1200×630 `public/opengraph-image.png`**. |
| 3 | **sitemap/robots conflict** — auth pages were both sitemapped and `Disallow`-ed. | Removed auth pages from the sitemap. |
| 4 | **Brand inconsistency** — `/comparison` used "Soter" not "SoterAI" in title, description, and the comparison table row. | Fixed to "SoterAI". |
| 5 | Missing metadata/canonical on top pages. | Added `metadata` + canonical to `/pricing`, `/comparison`, `/benchmarks`. |

---

## 5. UI/UX fixed

| # | Issue | Fix |
|---|---|---|
| 1 | **Logo invisible on dark header** (dark-navy wordmark on dark bg). | Generated transparent on-dark logo variant `SoterAILogo-onDark.png`; wired into header/footer with correct aspect ratio; regenerated favicons. |
| 2 | **FeedbackWidget** showed send-failures in success-cyan + textarea had no label. | Failures now red; added `<label>` + `role="status"` live region. |
| 3 | **Low-contrast footer headings** (`text-slate-600` fails WCAG AA on dark). | Bumped to `text-slate-400`. |

---

## 6. Outstanding recommendations (not yet done — larger efforts)

**High priority:**
1. **⚠️ Commit the new logo assets** — `public/SoterAILogo-onDark.png`, `SoterAILogo.png`, `opengraph-image.png` are **untracked**; a clean CI deploy will ship a broken logo. Run: `git add public/SoterAILogo*.png public/opengraph-image.png public/icon*.png public/apple-icon.png`
2. **Mobile navigation** — signed-out users on mobile (`HeaderNav.tsx`) can't reach Docs/Pricing/Features/Sign-in (no hamburger). Dashboard sidebar (~40 items) stacks above content below `lg`.
3. **Per-page metadata** — ~20 remaining marketing/legal pages (enterprise, compliance/*, case-studies, trust, security, changelog, demo, playground, legal) still inherit the default title. Add unique title/description/canonical to each.

**Medium priority:**
4. **Rebrand the WordPress plugin** — `integrations/wordpress-plugin/` Plugin Name/Author/badge still say "CyberRakshak" (function names/REST routes are intentionally frozen — leave those).
5. **Docs sidebar** — add `app/docs/layout.tsx` with persistent nav (18 doc pages currently only reachable via the index).
6. **Review self-authored `aggregateRating`** JSON-LD on homepage (ratingCount 1) against Google's self-serving-review policy.

**Low priority:**
7. Clean 46 cosmetic lint warnings (unused doc imports + unescaped apostrophes).
8. Add route-level `loading.tsx` to heavy dashboard pages (logs, forensics, billing).
9. Stale `demo-cyberrakshak` org slug in `examples/real-chatbot-test`.

---

## 7. Notes
- **Real-chatbot test**: the guard logic is validated by the 549 unit + 14 SDK tests. The example's end-to-end run needs a live Neon DB (unreachable here) for the billing step — environmental, not a code bug.
- Files changed this session: `app/layout.tsx`, `app/page.tsx`, `app/pricing/page.tsx`, `app/comparison/page.tsx`, `app/benchmarks/page.tsx`, `app/sitemap.ts`, `app/docs/quickstart/page.tsx`, `app/docs/python/page.tsx`, 13 other `app/docs` + dashboard pages (package name), `components/ops/FeedbackWidget.tsx`, `docs/integrations/python.md`, `examples/real-chatbot-test/*`, plus new logo/OG assets.
