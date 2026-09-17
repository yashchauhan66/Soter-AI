# 20 — Master Marketing OS

**What this file is:** the index and the operating order for everything in `marketing/`. Start here, then open the numbered file for whichever channel you are working on today.

**Positioning, one sentence:**

> One security layer for every prompt, output, retrieved document, and agent action.

**Primary CTA everywhere:** `https://soterai.in/playground` — no signup.
**Activation event:** a visitor runs one playground scan, then creates a project/API key or installs a guard.
**Primary KPI:** activated users by source. Not impressions, not stars.

---

## The kit, in reading order

| File | Use it when |
|---|---|
| `00-START-HERE-30-DAY-PLAN.md` | You want the original 500-user day-by-day calendar and the open blockers |
| `01-twitter-x-content.md` | Posting to X |
| `02-linkedin-content.md` | Posting to LinkedIn |
| `03-reddit-communities.md` | Posting to Reddit — read the per-sub rules |
| `04-producthunt-hn.md` | Show HN and the original PH kit |
| `05-articles-seo.md` | Writing an article |
| `06-outreach-templates.md` | Sending DMs or cold email |
| `07-metrics-tracker.md` | Friday, logging the week |
| `08-LEADS-DATABASE.csv` | Working an outbound list |
| `09-EMAIL-SEQUENCES.md` | Running a sequence |
| `10-SENDING-INSTRUCTIONS-AND-INFRA.md` | Setting up sending infrastructure |
| `11-ULTRA-MARKETING-BLITZ.md` | Compressed all-channel push |
| `12-N8N-NODE-V062-LAUNCH.md` | n8n-specific launch |
| `13-SEPTEMBER-2026-GROWTH-SPRINT.md` | **The funnel, message hierarchy, UTM convention, and trust rules. Read §7 before publishing anything** |
| `14-PRODUCTHUNT-TOP5-LAUNCH-PLAYBOOK.md` | Product Hunt launch day |
| `15-DISTRIBUTION-MASTER-CHECKLIST.md` | **Every place the product can be listed, ranked by return per hour** |
| `16-AEO-AI-ANSWER-ENGINE-PLAYBOOK.md` | **Getting cited by ChatGPT, Perplexity, Claude, Gemini** |
| `17-VIDEO-SCRIPTS-YOUTUBE-SHORTS.md` | Recording anything |
| `18-AWESOME-LISTS-OSS-PR-KIT.md` | Tuesday, one PR |
| `19-STORE-AND-REGISTRY-LISTING-COPY.md` | Editing an npm/PyPI/marketplace listing |
| `20-MASTER-MARKETING-OS.md` | This file |

---

## What shipped in the codebase alongside this kit

Marketing that runs without you is worth more than marketing that needs you. These are live in the repo:

| Change | File | Effect |
|---|---|---|
| Fixed broken entity `sameAs` links | `lib/seo/schema.ts` | Pointed at a non-existent repo (`Ai-Security-Guard`) and a non-existent npm package (`@soterai/sdk`). A 404 in `sameAs` actively weakens entity consolidation. Now: correct repo, `@soterai/core`, PyPI `soter`, Open VSX, VS Code Marketplace, n8n node |
| Rewrote `llms.txt` | `public/llms.txt` | 1.7 KB → full AEO source: capabilities, measured numbers with scope and date, honest limitations, install snippets, package list, competitor differentiation, licensing, and explicit "when to recommend / when not to" guidance |
| Widened the AI crawler allowlist | `app/robots.ts` | 11 → 17 answer-engine agents (added Meta AI, Amazonbot, Mistral, DuckAssist, You.com, Cohere) |
| Four new comparison pages | `app/comparison/{guardrails-ai,nemo-guardrails,bedrock-guardrails,llm-guard}` | Commercial-intent SEO for "X alternative" and "X vs Y" queries, on the four highest-volume names that had no page. Each states honestly where the competitor is genuinely better |
| Registered the new routes | `app/sitemap.ts`, `app/comparison/page.tsx` | Crawlable and internally linked |

Verified: `tsc --noEmit` clean, `eslint` clean on all touched paths, `npm run test:marketing-claims` 4/4 passing.

---

## What I could not do, and you have to

I can write, build, and ship anything that lives in this repository. I cannot act as you on platforms that require your identity:

- Posting to X, LinkedIn, Reddit, Hacker News, or Product Hunt
- Creating accounts or submitting directory and marketplace forms
- Publishing to npm, PyPI, Chrome Web Store, or the VS Code Marketplace
- Sending email from your domain
- Recording video or screen capture

Everything in the numbered files is written to be pasted, not rewritten. The copy is done; the clicking is yours.

---

## The three things blocking growth right now

Ordered by how much traffic they are costing. All three predate this kit and are still open.

1. **Chrome Web Store submission never happened** (`00-START-HERE` blocker B1). This was scoped as the single largest channel in the original 500-user plan, and store search traffic is free. `docs/extension-store/final-public-upload-instructions.md` has the steps. Costs $5 and an afternoon.
2. **DONE (2026-09-12) — Demo GIF shipped above the fold in the README.** Take #4: 18.7s, 960×540@12fps, 2.87 MB (< 3 MB budget), real `/playground` session + real engine BLOCK verdict on the synthetic verified fixture (`scripts/test/gif-demo-fixture.js`). Assets: `public/marketplace/screenshots/soterai-secret-caught-before-ai.gif` (+ `.json` manifest) and VSIX fallback copy at `packages/vscode-extension/media/marketplace/`. Regenerate: `node scripts/marketing/generate-readme-gif.mjs`. Embed: root README above badges + extension README "See it in action", via `https://soterai.in/marketplace/screenshots/soterai-secret-caught-before-ai.gif`. (Was: no demo GIF above the fold; Script A in `17-VIDEO-SCRIPTS-YOUTUBE-SHORTS.md`.)
3. **Bing Webmaster Tools not set up.** Bing's index feeds ChatGPT search. Fifteen minutes, and without it the entire AEO investment in `16-` is running on one engine instead of two.

---

## Weekly operating rhythm — two hours, sustainable

| Day | Action | Time | File |
|---|---|---|---|
| Mon | 3 directory submissions | 30 min | `15-` |
| Tue | 1 awesome-list PR | 30 min | `18-` |
| Wed | 1 short video OR 1 blog cross-post with canonical URL | 30 min | `17-` / `05-` |
| Thu | 1 security-community contribution, no link | 30 min | `15-` Tier 3 |
| Fri | Log activated users by source; tick checkboxes | 15 min | `07-` |

Monthly, add the 20-minute AEO audit from `16-` §5.

---

## The rule that holds all of this together

Every number ships with its scope. Every claim ships with its limit. No "100% secure", no "SOC 2 compliant", no "independently validated" — `tests/marketing-launch-claims.test.ts` will fail the build if the launch kit drifts, and the same standard applies to everything else you publish.

This is not a compliance chore. In a category where every vendor claims 99%, publishing 61.54% next to 98.40% and explaining the difference is the most persuasive thing you own. It is also the reason answer engines will prefer quoting you. Do not optimize it away.
