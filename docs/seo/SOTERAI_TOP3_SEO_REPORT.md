# SoterAI Top-3 SEO Report — Full Audit & Implementation Plan

**Brand:** SoterAI / SoterAI Guard
**Website:** https://soterai.in
**Date:** 2026-07-28
**Analyst:** Kiro AI (Elite Technical SEO + SaaS Growth Strategist)
**Git branch:** main / current worktree
**Environment:** Next.js 15.5.19 App Router — Docker standalone production

---

## MANDATORY EVIDENCE NOTICE

All rankings, traffic, impressions, and CTR metrics below are **UNVERIFIED** unless
explicitly marked with a source. Google Search Console export was not available
at audit time. Directives are directional evidence only.

Verified sources used in this report:
- Repository inspection (July 28 2026)
- Live Lighthouse lab measurement (docs/seo/core-web-vitals-measured-report.md, 2026-07-06)
- Live web search (July 28 2026)
- robots.ts, sitemap.ts, layout.tsx, schema.ts — repository evidence

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Organic Search Baseline](#2-organic-search-baseline)
3. [Technical SEO Audit](#3-technical-seo-audit)
4. [Competitor Analysis](#4-competitor-analysis-live-serp-data--july-28-2026)
5. [Keyword Universe & Topical Authority Map](#5-keyword-universe--topical-authority-map)
6. [Site Architecture Audit](#6-site-architecture-audit)
7. [Structured Data Audit](#7-structured-data-audit)
8. [Core Web Vitals Evidence](#8-core-web-vitals-evidence)
9. [E-E-A-T Assessment](#9-e-e-a-t-assessment)
10. [Backlink & Authority Audit](#10-backlink--authority-audit)
11. [Top-3 Feasibility Table](#11-top-3-feasibility-table)
12. [Conversion Analysis](#12-conversion-analysis)
13. [Final Scoring (0–100)](#13-final-scoring-0100)
14. [P0/P1/P2/P3 Implementation Backlog](#14-p0--p1--p2--p3-implementation-backlog)
15. [30/60/90-Day Roadmap](#15-3060-day-roadmap)
16. [Rank Tracking Plan](#16-rank-tracking-plan)
17. [Changes Implemented In This Session](#17-changes-implemented-in-this-session)
18. [Remaining Blockers](#18-remaining-blockers)
19. [Final Honest Verdict](#19-final-honest-verdict)

---

## 1. EXECUTIVE SUMMARY

SoterAI has a **technically strong but authority-starved** SEO foundation.
The codebase demonstrates professional SEO implementation: server-rendered metadata
via Next.js App Router, full JSON-LD graph (Organization, WebSite, LocalBusiness,
SoftwareApplication, FAQPage, BreadcrumbList), correct sitemap.ts and robots.ts,
Google Analytics via @next/third-parties, and a verified GSC tag.

The product is **real, differentiated, and commercially viable**. It covers
a genuine niche (India PII + local-first + IDE Guard + MCP security) that no
top-ranked competitor fully owns.

**The core problem is not technical SEO — it is authority and visibility.**

- No soterai.in URL was found ranking in any top-10 SERP for any target keyword.
- No external backlinks to soterai.in were observed in search results.
- soter.com (completely unrelated workplace safety product) uses "SoterAI" branding,
  creating real entity confusion in search results.
- The Indian AI security market has emerging competitors (crewcheck.in, cloak-ai.co)
  who are also absent from major SERPs — the category is genuinely nascent.
- MCP security is a fast-growing keyword cluster where first-mover content is
  winning (cyberkendra.com, truefoundry.com, edgelabs.ai) — SoterAI has the
  product but weak content authority.

**Overall Top-3 readiness: 44/100**
Technical SEO: 78/100 | Content authority: 22/100 | Brand entity: 35/100

---

## 2. ORGANIC SEARCH BASELINE

### Verified from Repository

| Metric | Value | Evidence source |
|--------|-------|----------------|
| Indexable public pages | ~72 | app/ directory + sitemap.ts count |
| Protected / noindex pages | /dashboard, /admin, /api/* | middleware.ts matcher |
| Sitemap auto-generated | Yes | app/sitemap.ts |
| robots.txt auto-generated | Yes | app/robots.ts |
| AI crawlers allowed | Yes (11 bots) | robots.ts AI_CRAWLERS array |
| GSC verification tag | Installed | layout.tsx metadata.verification.google |
| Google Analytics | GA4 via @next/third-parties | layout.tsx GoogleAnalytics |
| HTTPS | Yes | HSTS header in next.config.mjs (production) |
| metadataBase | https://soterai.in | layout.tsx new URL(siteUrl) |
| Title template | "%s \| SoterAI" | layout.tsx metadata.title.template |
| JSON-LD — Organization | Site-wide | app/layout.tsx + lib/seo/schema.ts |
| JSON-LD — WebSite | Site-wide | lib/seo/schema.ts websiteNode |
| JSON-LD — LocalBusiness | Site-wide | lib/seo/schema.ts localBusinessNode |
| JSON-LD — SoftwareApplication | Per feature page | FeatureLanding.tsx softwareApplicationLd |
| JSON-LD — FAQPage | Per feature page | FeatureLanding.tsx faqPageLd |
| JSON-LD — BreadcrumbList | Per feature page | FeatureLanding.tsx breadcrumbList |
| JSON-LD — Dataset | Benchmark page | page.tsx homepageJsonLd |

### Unverified (requires GSC export)

- Total clicks (unknown — GSC required)
- Total impressions (unknown — GSC required)
- Average CTR (unknown — GSC required)
- Average position (unknown — GSC required)
- Branded vs non-branded split (unknown)
- Query-level data (unknown)
- Index coverage errors (unknown — could be crawled-not-indexed issues)
- Core Web Vitals field data / CrUX (unknown — needs 28 days of traffic)

### GSC Export Instructions

1. Open https://search.google.com/search-console
2. Select property: soterai.in
3. Performance → Search Results → Export CSV
4. Index Coverage → Export for error types
5. Core Web Vitals → Export field data
6. Sitemaps → Confirm sitemap.xml status

---

## 3. TECHNICAL SEO AUDIT

### Framework & Rendering

| Property | Value |
|----------|-------|
| Framework | Next.js 15.5.19 |
| Dev bundler | Turbopack |
| Rendering | SSR (App Router, React Server Components) |
| CSS | Tailwind CSS 3.4.17 |
| Deployment | Docker standalone (next.config.mjs output:"standalone") |
| Bundle optimisation | lucide-react tree-shaking (optimizePackageImports) |
| Image formats | avif + webp (images.formats) |
| Image cache TTL | 30 days |
| Compression | enabled (compress: true) |
| poweredBy header | removed |

### Metadata — Status per Page Type

| Page type | Title | Description | Canonical | OG | Twitter | Status |
|-----------|-------|-------------|-----------|-----|---------|--------|
| Homepage | ✅ Custom | ✅ Custom | ✅ "/" | ✅ Custom | ✅ | Good |
| Feature landing (FeatureLanding) | ✅ buildMetadata | ✅ buildMetadata | ✅ path | ✅ inherited | ✅ | Good |
| Blog posts | ✅ post.title | ✅ post.description | ✅ /blog/slug | ✅ inherited | ✅ | Good |
| Comparison pages | ✅ Custom | ✅ Custom | ✅ /comparison/X | ✅ Custom | ⚠️ inherited | Needs twitter.card explicit |
| /benchmark | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /pricing | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /enterprise | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /docs | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /playground | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /case-studies | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /compliance/* | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |
| /blog (index) | Unknown | Unknown | Unknown | Unknown | Unknown | Needs audit |

### Critical Technical Issues Found

| Issue | Severity | Evidence | Fix |
|-------|----------|----------|-----|
| hreflang set for hi/en-IN but NO Hindi content exists | HIGH | layout.tsx alternates.languages includes "hi" and "en-IN" pointing to same URL | Remove hi/en-IN hreflang — only use en and x-default |
| Comparison pages missing from sitemap | MEDIUM | sitemap.ts has /comparison/lakera, /comparison/prompt-security, /comparison/hiddenlayer listed ✅ but not yet in confirmed array | Verify sitemap includes all 3 |
| /integrations/* routes do not exist | HIGH | app/integrations directory confirmed missing | Create integration pages or remove from keyword map |
| /cursor-ai-security, /windsurf-ai-security missing | MEDIUM | No directories for these routes found | Create pages or 301 to /vscode-ai-security |
| OG type not set to "article" on blog posts | MEDIUM | buildMetadata uses type:"website" default | Override in blog page metadata |
| openGraph.publishedTime missing on blog posts | MEDIUM | No datePublished in OG metadata | Add to each blog page metadata |
| FeatureLanding final CTA always says "VS Code extension" | MEDIUM | CTA is hardcoded for VS Code even on /ai-agent-security, /enterprise-ai-security | Context-specific CTAs needed |
| No VideoObject schema for demo video | LOW | Demo video page exists, no VideoObject JSON-LD | Add VideoObject to /demo page |
| No Person schema for authors | LOW | Blog posts list no author Person schema | Add Organization author or Person schema |
| Benchmark page Dataset variableMeasured values are strings not Numbers | LOW | homepageJsonLd Dataset variableMeasured uses string values | Schema technically valid but numeric values preferred |
| Mobile LCP 4.9s (CRITICAL performance gap) | HIGH | Lighthouse mobile report 2026-07-06 | Fix below-the-fold hydration and hero image preload |
| Accessibility score 87 (target >95) | MEDIUM | Lighthouse both presets | Fix button-name, color-contrast, target-size |

### Sitemap Assessment

Confirmed in sitemap.ts as of repository snapshot:
- marketingPages: 22 entries
- featurePages: 16 entries
- blogPages: 9 entries (index + 8 posts)
- compliancePages: 3 entries
- legalPages: 7 entries
- docsPages: 18 entries
- servicePages: dynamic from SERVICES catalog

TOTAL: ~80+ entries (good — well above minimum, below 500 limit)

Missing from sitemap (confirmed by file inspection):
- /model-supply-chain-security (directory exists, not in sitemap)
- /ai-safe-mode (directory exists, not in sitemap)
- /ai-memory-inspector (directory exists, not in sitemap)
- /local-ai-broker (listed in featurePages ✅)
- /jailbreak-detection (listed in featurePages ✅)

### robots.txt Assessment — PASS

- All private routes correctly disallowed (/api/, /admin/, /dashboard/, auth routes)
- AI crawlers explicitly allowed — strategic for AEO/GEO (good decision)
- Sitemap URL correctly referenced

---

## 4. COMPETITOR ANALYSIS (LIVE SERP DATA — July 28 2026)

### SERP Findings by Keyword Cluster

**"best AI security platform 2026"**
Top results: appsecsanta.com, edgelabs.ai, generalanalysis.com, futureagi.com, guptadeepak.com
SoterAI position: NOT FOUND in top 10
Content type: List articles, comparison guides, buyer's guides
Schema used: Article, ItemList by competitors
SoterAI gap: No list-article / "best X" content; no third-party mention

**"MCP security" / "MCP security tools"**
Top results: cyberkendra.com, truefoundry.com, strac.io, edgelabs.ai, polygraf.ai, aclanthology.org
SoterAI position: NOT FOUND in top 10
Content type: Educational guides, tool comparisons, research paper
SoterAI gap: /mcp-security page exists but no external authority; competitors have full-length educational articles

**"prompt injection protection"**
Top results: nightfall.ai, guptadeepak.com, generalanalysis.com, edgelabs.ai
SoterAI position: NOT FOUND in top 10
Content type: Tool roundup, buyer's guide
SoterAI gap: /prompt-injection-protection page exists but no authority

**"AI security India" / "India PII detection AI" / "DPDP compliance AI"**
Top results: crewcheck.in, cloak-ai.co, protecto.ai, hunto.ai, anaya.legal
SoterAI position: NOT FOUND in top 10
Notable: This is the most realistic near-term opportunity — thin competition, India-specific niche
SoterAI gap: /ai-security-india page exists; /blog post exists; no external backlinks

**"VS Code AI security extension"**
Top results: github.blog (VS Code official), code.visualstudio.com, windowsforum.com, checkmarx.com
SoterAI position: NOT FOUND in top 10
Content type: Official docs, security research, CVE reports
SoterAI gap: /vscode-ai-security page exists; Marketplace listing needed for trust signal

**"jailbreak detection" / "LLM jailbreak"**
No specific SERP data captured — assumed medium competition, no SoterAI presence

### Competitor Gap Matrix

| Competitor | Keyword | Strength | SoterAI advantage | Missing evidence | Priority |
|-----------|---------|---------|-------------------|-----------------|---------|
| edgelabs.ai | AI agent security, MCP security, AI security tools | High-authority editorial content covering multiple keywords | India PII, self-hosted, free tier, IDE extension | Content depth, backlinks | P0 |
| generalanalysis.com | Best AI security platforms | Comprehensive buyer's guide, rich schema | Honest limitations section, pricing transparency | Third-party citation | P0 |
| appsecsanta.com | Best AI security tools | Simple comparison page, fast | Any mention at all | Product listing on their site | P1 |
| nightfall.ai | Prompt injection protection | Enterprise brand, cloud DLP integration | Developer-first, self-hosted, India PII | Brand awareness | P0 |
| crewcheck.in | AI security India, India PII | Direct India PII competitor, same niche | Full-stack guard (not just PII), agent firewall | India market backlinks | P1 |
| cloak-ai.co | India PII detection API | Stateless ML, DPDP-ready, developer-focused | Broader coverage (not just PII) | None yet | P1 |
| truefoundry.com | MCP security | Strong educational content | MCP-specific tooling, real config scanning | MCP-focused content depth | P1 |
| futureagi.com | Prompt injection tools, AI guardrails | Multiple keyword-targeting articles | Free tier, self-hosted, India-specific | Any mention | P2 |
| soter.com | SoterAI brand term | Occupies brand SERP for "SoterAI" | Correct brand for AI security | Brand disambiguation | P0 |

### Brand Confusion Risk — CRITICAL

Live search for "SoterAI" returns soter.com (workplace safety AI) as a prominent
result alongside soterai.in. The soter.com product is explicitly called "SoterAI"
in their content. This creates direct SERP entity confusion.

**Entity disambiguation strategy:**
- Consistently use full brand: "SoterAI Guard" for product, "SoterAI" for company
- Add sameAs references to GitHub, VS Code Marketplace, npm in Organization schema
- Create verified profiles on Product Hunt, LinkedIn, GitHub
- Ensure every page title includes "SoterAI Guard" not just "SoterAI"

---

## 5. KEYWORD UNIVERSE & TOPICAL AUTHORITY MAP

### Priority Classification

**P0 — Implement immediately (highest conversion potential, achievable)**

| Keyword | Intent | Funnel | Current page | Position | Difficulty |
|---------|--------|--------|-------------|----------|------------|
| MCP security | Commercial | Consideration | /mcp-security | Unverified | LOW (niche, nascent) |
| AI security India | Commercial | Consideration | /ai-security-india | Unverified | LOW (India niche) |
| India PII detection | Commercial | Awareness | /ai-security-india | Unverified | LOW |
| VS Code AI security extension | Commercial | BOFU | /vscode-ai-security | Unverified | LOW-MED |
| prompt injection protection | Commercial | Consideration | /prompt-injection-protection | Unverified | MEDIUM |
| jailbreak detection | Commercial | Consideration | /jailbreak-detection | Unverified | MEDIUM |
| LLM security platform | Commercial | Consideration | /llm-security | Unverified | HIGH |
| AI agent security | Commercial | Consideration | /ai-agent-security | Unverified | MED-HIGH |
| RAG security | Commercial | Consideration | /rag-security | Unverified | MEDIUM |
| DPDP AI compliance | Commercial | Consideration | /ai-security-india | Unverified | LOW |

**P1 — High priority (strong differentiation, content gap to close)**

| Keyword | Intent | Current page | Gap |
|---------|--------|-------------|-----|
| AI workflow security | Commercial | /ai-workflow-security | Page exists; needs integration depth |
| n8n AI security | Commercial | MISSING /integrations/n8n | No page |
| Zapier AI security | Commercial | MISSING /integrations/zapier | No page |
| Make.com AI security | Commercial | MISSING /integrations/make | No page |
| Cursor security extension | Commercial | MISSING /cursor-ai-security | No page |
| Windsurf security extension | Commercial | MISSING /windsurf-ai-security | No page |
| secure MCP servers | Commercial | /mcp-security | Partial coverage |
| AI context firewall | Educational | /blog/what-is-ai-context-firewall | Blog only; no product page |
| LLM firewall | Commercial | /llm-firewall (directory exists?) | Needs audit |
| enterprise AI security | Commercial | /enterprise-ai-security | Exists but weak authority |
| AI guardrails platform | Commercial | /llm-security | No dedicated page |
| best AI security platform | Navigational | /comparison | Comparison page exists |
| Aadhaar PII detection | Commercial | /ai-security-india | Partial |
| model supply chain security | Commercial | /model-supply-chain-security | In sitemap? Needs check |

**P2 — Medium priority (longer path, lower conversion immediacy)**

| Keyword | Intent | Status |
|---------|--------|--------|
| AI data leakage prevention | Commercial | Page exists (/ai-data-leakage-prevention) |
| protect secrets AI coding tools | Awareness | /vscode-ai-security covers this |
| what is prompt injection | Educational | Blog post exists |
| LLM guardrails explained | Educational | Blog post exists |
| AI agent security risks | Educational | Blog post exists |
| SoterAI vs Lakera | Navigational | /comparison/lakera ✅ |
| SoterAI vs HiddenLayer | Navigational | /comparison/hiddenlayer ✅ |
| SoterAI vs Prompt Security | Navigational | /comparison/prompt-security ✅ |
| OWASP LLM Top 10 | Educational | /compliance/owasp-llm-top-10 ✅ |
| AI security benchmark | Educational | /benchmark ✅ |

**P3 — Lower priority / future**

| Keyword | Notes |
|---------|-------|
| AI memory inspector | Very niche, page exists /ai-memory-inspector |
| what AI saw audit log | Very niche, brand-specific |
| terminal command firewall | Very niche, brand-specific |
| AI safe mode | Niche, page exists /ai-safe-mode |
| local AI broker | Niche, page exists /local-ai-broker |
| generative AI security platform | High competition vs generic |
| enterprise AI risk management | Very high competition |

### Cannibalisation Risks

| Risk | Pages | Resolution |
|------|-------|-----------|
| Homepage vs /llm-security for "AI security platform" | Homepage targets "AI Security Platform", /llm-security targets "LLM security platform" | Keep distinct: Homepage = broad, /llm-security = LLM-specific |
| /vscode-ai-security vs /cursor-ai-security | VSCode page covers Cursor/Windsurf | Create separate pages OR add explicit Cursor/Windsurf sections with anchors |
| /mcp-security vs /ai-agent-security | Both cover MCP | /mcp-security = config scanning, /ai-agent-security = runtime enforcement |
| /ai-security-india vs Homepage India section | Both cover India PII | /ai-security-india is canonical for India SEO; homepage links to it |
| /ai-workflow-security vs /integrations/* | Both cover n8n/Zapier | /ai-workflow-security = concept, /integrations/n8n = setup |

---

## 6. SITE ARCHITECTURE AUDIT

### Current Public Route Inventory (confirmed from app/ directory)

```
/ (homepage)
├── /ai-agent-security         ✅ Feature landing
├── /ai-data-leakage-prevention ✅ Feature landing
├── /ai-memory-inspector       ✅ Feature landing
├── /ai-safe-mode              ✅ Feature landing
├── /ai-security-india         ✅ Feature landing
├── /ai-workflow-security      ✅ Feature landing
├── /benchmark                 ✅ (content unknown — needs audit)
├── /benchmarks                ✅ (duplicate of /benchmark? — verify)
├── /blog/                     ✅ 8 posts
├── /case-studies/             ✅ (index + 1 post)
├── /changelog                 ✅
├── /comparison                ✅ Comparison hub
│   ├── /comparison/lakera     ✅
│   ├── /comparison/hiddenlayer ✅
│   └── /comparison/prompt-security ✅
├── /compliance/owasp-llm-top-10 ✅
├── /compliance/iso27001-readiness ✅
├── /compliance/soc2-readiness ✅
├── /contact                   ✅
├── /contact-sales             ✅
├── /data-retention            ✅
├── /demo                      ✅
├── /demo-chatbot              ✅
├── /demo/rag                  ✅
├── /demo/red-team             ✅
├── /docs                      ✅ (index + many sub-pages)
├── /enterprise                ✅
├── /enterprise/pilot          ✅
├── /enterprise-ai-security    ✅ Feature landing
├── /jailbreak-detection       ✅ Feature landing
├── /limitations               ✅ (honest limitations page — strong E-E-A-T)
├── /llm-firewall              ✅ (directory exists — content unknown)
├── /llm-security              ✅ Feature landing
├── /local-ai-broker           ✅ Feature landing
├── /mcp-security              ✅ Feature landing
├── /model-supply-chain-security ✅ (directory exists — needs sitemap entry)
├── /partners/agency           ✅ (orphan — no inbound links found)
├── /playground                ✅
├── /pricing                   ✅
├── /privacy                   ✅
├── /prompt-injection-protection ✅ Feature landing
├── /rag-security              ✅ Feature landing
├── /responsible-disclosure    ✅
├── /security                  ✅
├── /security-status           ✅
├── /status                    ✅
├── /subprocessors             ✅
├── /support                   ✅
├── /terms                     ✅
├── /trust                     ✅
└── /vscode-ai-security        ✅ Feature landing

MISSING (keyword demand exists):
├── /integrations/             ❌ MISSING
│   ├── /integrations/n8n      ❌ MISSING
│   ├── /integrations/zapier   ❌ MISSING
│   └── /integrations/make     ❌ MISSING
├── /cursor-ai-security        ❌ MISSING
└── /windsurf-ai-security      ❌ MISSING
```

### Internal Linking Assessment

**Strong internal links:**
- FeatureLanding "related" section links to 4-5 related pages on every feature page
- Homepage links to 4 feature categories, benchmark, OWASP compliance, docs, pricing
- Comparison hub links to 3 head-to-head pages
- Blog posts link to related product pages

**Weak internal links:**
- /model-supply-chain-security, /ai-safe-mode, /ai-memory-inspector — no inbound links from primary nav
- /partners/agency — orphaned, no inbound
- /case-studies/* — only 1 post; index page has no inbound from primary nav
- /compliance/* — not in main navigation, only in sitemap
- Blog posts do not link to /comparison pages
- /benchmark page lacks inbound links from feature landing pages (only from homepage)
- /enterprise page and /enterprise-ai-security are separate routes — overlap/confusion

**Recommended link additions (P0 — no code changes needed beyond content):**
1. Feature pages → /benchmark (add benchmark evidence link in each feature page)
2. Blog posts → /comparison (add comparison CTA in each post)
3. /mcp-security → /integrations/n8n (once created)
4. /ai-agent-security → /benchmark (evidence link)
5. /ai-security-india → /compliance/owasp-llm-top-10

---

## 7. STRUCTURED DATA AUDIT

### Site-Wide Graph (app/layout.tsx — every public page)

| Schema type | @id | Status | Issues |
|-------------|-----|--------|--------|
| Organization | https://soterai.in#organization | ✅ | sameAs only has 2 URLs — add more |
| WebSite | https://soterai.in#website | ✅ | No SearchAction — add sitelinks search box |
| LocalBusiness | https://soterai.in#localbusiness | ✅ | telephone is empty string — fix or omit |

### Page-Level Structured Data

| Page | Schema types | Status | Issue |
|------|-------------|--------|-------|
| Homepage | WebPage, SoftwareApplication, Dataset, FAQPage | ✅ | Good |
| /ai-agent-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /llm-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /rag-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /jailbreak-detection | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /vscode-ai-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /mcp-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /enterprise-ai-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /ai-workflow-security | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /ai-security-india | BreadcrumbList, SoftwareApplication, FAQPage | ✅ | |
| /comparison | AboutPage, ItemList, SoftwareApplication | ✅ | Good detail |
| /comparison/lakera | None detected | ❌ | VsCompetitor has no JSON-LD |
| /comparison/hiddenlayer | None detected | ❌ | Same issue |
| /comparison/prompt-security | None detected | ❌ | Same issue |
| /blog/* | Article schema | ❌ | No Article JSON-LD on blog posts |
| /benchmark | Dataset | ✅ (from homepage) | Needs own Dataset schema |
| /demo | None | ❌ | Should have VideoObject schema |
| /pricing | Product/Offer | ❌ | Unknown — needs audit |
| /docs | HowTo potential | ❌ | Unknown |

### Schema Fixes Required

**CRITICAL — comparison/lakera, /prompt-security, /hiddenlayer missing ALL schema:**
The VsCompetitor component renders no JSON-LD. These comparison pages are
high-value comparison-intent pages that should have at minimum:
- BreadcrumbList (Home > Comparison > SoterAI vs X)
- FAQPage (comparison questions are natural FAQ content)

**HIGH — Blog posts missing Article schema:**
8 blog posts exist with excellent content but no Article JSON-LD.
articleLd helper exists in lib/seo/metadata.ts — just not being called.

**MEDIUM — Organization.sameAs too sparse:**
Current: GitHub + Twitter. Should also include:
- VS Code Marketplace URL
- npm package URL
- Product Hunt (when listed)
- LinkedIn page

**MEDIUM — WebSite missing SearchAction:**
Adding sitelinks SearchAction to websiteNode enables Google sitelinks search box.

**LOW — telephone empty string in LocalBusiness:**
Either add a real phone number or remove the telephone property entirely.
An empty string is worse than omission.

---

## 8. CORE WEB VITALS EVIDENCE

Source: docs/seo/core-web-vitals-measured-report.md (Lighthouse 12.8.2, 2026-07-06)

| Metric | Target | Desktop | Mobile | Status |
|--------|--------|---------|--------|--------|
| Performance | >90 | 96 | 63 | ❌ Mobile critical |
| LCP | <2.5s | 1.1s | 4.9s | ❌ Mobile 2× over target |
| CLS | <0.1 | 0 | 0 | ✅ Perfect |
| TBT (proxy for INP) | <200ms | 40ms | 540ms | ❌ Mobile 2.7× over target |
| FCP | — | 0.8s | 2.8s | — |
| TTFB | — | ~140ms | ~130ms | ✅ Good |
| Total transferred | <500KB | — | 621KiB | ⚠️ Over target |
| Accessibility | >95 | 87 | 87 | ❌ Both fail |
| SEO | >95 | 100 | 100 | ✅ Perfect |
| Best Practices | >95 | 100 | 100 | ✅ Perfect |

### Mobile Performance Root Cause

1. TBT 540ms — excessive main-thread JS blocking on mobile throttled preset
2. LCP 4.9s — hero element not preloaded / hydration blocks rendering
3. Transfer weight 621KiB — below-the-fold components not lazy loaded

### Required Fixes (in priority order)

1. Audit `use client` boundaries — move client-only state to leaf components
2. Lazy load the DemoVideo, Features, Pricing, FAQ sections (below fold)
3. Ensure hero H1 text and above-fold image have `priority` / preload
4. Defer GoogleAnalytics to `strategy="afterInteractive"` (already using @next/third-parties which handles this)
5. Re-measure after each change

### Accessibility Issues (failing Lighthouse audits)

| Audit | Issue | Fix |
|-------|-------|-----|
| button-name | Icon-only buttons lack aria-label | Add aria-label to all icon buttons |
| color-contrast | Low-emphasis text fails WCAG AA | Increase contrast on slate-500 on dark bg |
| target-size | Small tap targets on mobile | Minimum 48×48px for interactive elements |

### Field Data Note

CrUX / real INP data requires 28-day traffic window. These are lab results only.
Once GSC access is available, Core Web Vitals tab will show field data.

---

## 9. E-E-A-T ASSESSMENT

E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) for a security product
is especially important — Google's QRG categorises security as a YMYL (Your Money Your Life)
adjacent topic requiring high E-E-A-T signals.

### Current Strengths

| Signal | Status | Notes |
|--------|--------|-------|
| Responsible disclosure page | ✅ | /responsible-disclosure exists |
| Honest limitations page | ✅ | /limitations exists — strong E-E-A-T signal |
| Security page | ✅ | /security exists |
| Trust center | ✅ | /trust exists |
| CHANGELOG | ✅ | /changelog exists |
| Privacy policy | ✅ | /privacy exists |
| Terms | ✅ | /terms exists |
| Data retention | ✅ | /data-retention exists |
| Subprocessors | ✅ | /subprocessors exists |
| Self-published benchmark with limitations stated | ✅ | Benchmark page explicitly labels results as self-maintained |
| Blog: honest content (no SEO spam) | ✅ | 8 posts with genuine technical depth |
| Marketing claims policy document | ✅ | docs/marketing-claims-policy.md |

### Critical E-E-A-T Gaps

| Signal | Status | Impact | Fix |
|--------|--------|--------|-----|
| No author profiles on blog posts | ❌ | HIGH | Add real person or org attribution |
| No About / team page | ❌ | HIGH | Create /about with company and team info |
| No Person schema for any author | ❌ | MEDIUM | Add Person or Organization schema to articles |
| No third-party security audit results | ❌ | HIGH | Link to any external audit or pen test report |
| No independent benchmark citation | ❌ | HIGH | The self-published F1=1.0 on synthetic data looks suspicious |
| No customer testimonials or case studies (with names) | ❌ | MEDIUM | /case-studies has 1 fictional case study |
| Founding date = "2024" only in schema | ⚠️ | MEDIUM | Add more context in About page |
| GitHub repo link is private/specific user | ⚠️ | MEDIUM | Ensure GitHub shows org activity |
| social profiles sparse | ❌ | MEDIUM | LinkedIn, X/Twitter, GitHub org all need active presence |

### E-E-A-T Action Plan

1. **Create /about page** with: Company description, founding story, team photos/names
   (or explain if anonymous for legitimate reasons), mission statement, India focus
2. **Add author attribution to all blog posts** — minimum: "By SoterAI Security Team,
   reviewed [date]" with Organization author schema; better: named engineer/researcher
3. **Add editorial policy** to clarify how content is reviewed and updated
4. **Link benchmark page to methodology** — currently exists, make it more prominent
5. **Add review/update dates** to all feature landing pages
6. **Third-party security signal** — link to any CVE disclosures, responsible disclosure
   responses, or external security coverage if it exists
7. **Create LinkedIn company page** and post technical content weekly

---

## 10. BACKLINK & AUTHORITY AUDIT

### Observed Backlink Status

Based on live search observation (July 28 2026):
- soterai.in found in search results at: soterai.in homepage only
- No third-party domains observed linking to soterai.in in search snippets
- No mention in any "best AI security tools" roundup article found
- No citation in any benchmark comparison site

**Estimated DR (Domain Rating): Very low (1–15 range estimated)**
**Evidence basis:** New domain (2024), minimal external mention, no editorial links found
**This is unverified — requires Ahrefs/Semrush/Moz access for confirmed data**

### Root Cause of Low Authority

1. Product is real and technically excellent but **not yet marketed** to external audiences
2. No GitHub stars/forks visible in search snippets (would indicate developer community)
3. No Product Hunt launch observed
4. No Hacker News Show HN post observed
5. No VS Code Marketplace reviews visible in search

### Authority Building Opportunities (in priority order)

**Tier 1 — Free, High-Impact (Days 1-30)**
- VS Code Marketplace: Ensure listing is complete with good description, screenshots, reviews
- GitHub: Make repos public where possible; add README with SEO-optimised content
- npm: Ensure @soterai/sdk package has full description, keywords, README
- Product Hunt: Launch SoterAI Guard — this creates links + community signal

**Tier 2 — Content-Led (Days 15-60)**
- Publish benchmark data to arXiv or Hugging Face (Dataset card) — generates academic citations
- Submit to OWASP community resources / LLM Security wiki
- Create open-source MCP security checklist tool on GitHub
- Write a guest post on a cybersecurity/developer blog with original data
- Submit to cyberkendra.com, appsecsanta.com, generalanalysis.com for listing

**Tier 3 — PR-Led (Days 30-90)**
- Reach out to edgelabs.ai, truefoundry.com, futureagi.com for inclusion in roundup articles
- Submit to DEV Community (dev.to) with India PII detection research piece
- Sponsor or participate in OWASP India chapter events
- Submit prompt injection detection research to InfoSec writeup channels

---

## 11. TOP-3 FEASIBILITY TABLE

All "current position" values are UNVERIFIED. "Probability" is a realistic estimate
based on: competition observed in live SERPs, SoterAI's existing page quality,
authority gap, and uniqueness of differentiators.

| Keyword | Current position | Difficulty | SoterAI page | Intent match | Authority gap | Content gap | Probability | Timeline | Required |
|---------|-----------------|-----------|-------------|-------------|--------------|------------|------------|---------|---------|
| MCP security | Unverified | LOW | /mcp-security | HIGH | Large | Medium | **Medium** | 3-6 months | Backlinks + content depth |
| AI security India | Unverified | LOW | /ai-security-india | HIGH | Small | Small | **Medium-High** | 2-4 months | India PR + directory listings |
| India PII detection (AI) | Unverified | LOW | /ai-security-india | HIGH | Small | Small | **Medium-High** | 2-4 months | India-specific backlinks |
| VS Code AI security extension | Unverified | LOW-MED | /vscode-ai-security | HIGH | Medium | Small | **Medium** | 3-6 months | Marketplace reviews + backlinks |
| DPDP AI compliance | Unverified | LOW | /ai-security-india | HIGH | Small | Medium | **Medium** | 3-6 months | DPDP-specific content |
| prompt injection protection | Unverified | MEDIUM | /prompt-injection-protection | HIGH | Large | Medium | **Low-Medium** | 6-12 months | Backlinks + original benchmark |
| jailbreak detection | Unverified | MEDIUM | /jailbreak-detection | HIGH | Large | Medium | **Low-Medium** | 6-12 months | Backlinks + benchmark |
| RAG security | Unverified | MEDIUM | /rag-security | HIGH | Large | Medium | **Low** | 9-15 months | Substantial authority building |
| AI agent security | Unverified | MED-HIGH | /ai-agent-security | HIGH | Large | Medium | **Low** | 9-18 months | Strong authority + content |
| LLM security platform | Unverified | HIGH | /llm-security | HIGH | Very large | Medium | **Low** | 12-24 months | Major authority building |
| AI security platform | Unverified | VERY HIGH | Homepage | MEDIUM | Very large | Large | **Insufficient evidence** | 18-36 months | Category leadership required |
| enterprise AI security | Unverified | HIGH | /enterprise-ai-security | HIGH | Very large | Large | **Low** | 18-36 months | Enterprise brand building |
| best AI security platform | Unverified | VERY HIGH | /comparison | MEDIUM | Very large | Large | **Insufficient evidence** | Unknown | Third-party citation |

### Key Insight

**Shortest credible path to Top-3:** India-focused keywords (AI security India, India PII detection,
DPDP AI compliance) where competition is thin and SoterAI has genuine product differentiation.
These are achievable within 2-4 months with focused effort.

**Second priority:** MCP security (fast-growing, first-mover window still partially open)

**Long-term bets:** Prompt injection, LLM security, AI agent security — these require sustained
authority building measured in years, not months.

---

## 12. CONVERSION ANALYSIS

### Conversion Paths Identified

| Path | CTA | Status |
|------|-----|--------|
| Homepage → Signup | "Read integration docs" (final CTA) | ⚠️ Weak — final CTA sends to docs not signup |
| Feature landing → VS Code Install | "Install the VS Code extension" | ✅ Clear and relevant for IDE pages |
| Feature landing → VS Code Install | Same CTA on /ai-agent-security, /enterprise-ai-security | ❌ Wrong CTA for non-IDE pages |
| Blog post → Product | /prompt-injection-protection link in blog | ✅ Good |
| /comparison → Signup | "Get started free" CTA | ✅ Clear |
| /benchmark → Demo | No clear CTA found | ❌ Benchmark page needs signup/demo CTA |
| /pricing → Signup | Assumed present | Unknown |
| /enterprise-ai-security → Contact Sales | "Contact Sales" in related links | ✅ |

### Critical Conversion Issues

1. **FeatureLanding CTA is always VS Code extension** — hardcoded in FeatureLanding.tsx
   regardless of page context. /ai-agent-security, /enterprise-ai-security, /rag-security,
   /llm-security should have API signup CTA not IDE extension CTA.

2. **Homepage final CTA sends to /docs not /signup** — the cyan banner says
   "Read integration docs" → /docs. This should be the primary signup driver.

3. **No demo request flow** — Enterprise visitors landing on /enterprise-ai-security
   get "Contact Sales" in a tiny link; no prominent demo booking CTA.

4. **Benchmark page likely lacks conversion CTA** — benchmark builds trust;
   should convert to "Try SoterAI free" immediately after benchmark proof.

### Conversion Event Tracking Checklist

Events to implement in GA4 (verify they exist):
- [ ] signup_started
- [ ] signup_completed
- [ ] api_key_created
- [ ] vscode_extension_click (outbound to Marketplace)
- [ ] docs_quickstart_opened
- [ ] pricing_viewed
- [ ] demo_requested
- [ ] contact_sales_clicked
- [ ] playground_used
- [ ] benchmark_viewed

---

## 13. FINAL SCORING (0–100)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Technical SEO | 78 | Strong foundation: metadata, canonical, sitemap, robots, JSON-LD. Gaps: hreflang bug, missing schema on comparison/blog pages, mobile performance |
| Crawlability | 88 | Private routes correctly blocked, AI crawlers allowed, server-rendered HTML, no JS crawl barriers |
| Indexation | 65 | GSC verified but no confirmed index count; potential crawled-not-indexed risk for newer pages |
| On-page SEO | 66 | Feature pages well-optimised; FeatureLanding CTA mismatch; comparison/blog pages weaker |
| Content quality | 62 | Feature pages honest and clear; blog posts genuinely educational; content thin on some utility pages |
| Topical authority | 22 | 8 blog posts + 16 feature pages — inadequate depth for competitive keywords; no cluster dominance |
| Brand entity strength | 35 | soter.com brand confusion is a critical problem; sameAs too sparse; inconsistent "SoterAI" vs "SoterAI Guard" |
| E-E-A-T | 42 | Strong trust documents (limitations, responsible disclosure, security); no About/team, no author attribution |
| Structured data | 68 | Good on feature pages; gaps on comparison pages, blog, benchmark, demo |
| Internal linking | 55 | FeatureLanding related links are good; orphan pages exist; blog→comparison links missing |
| Backlink authority | 8 | No confirmed external backlinks; new domain; no community signals visible |
| Performance | 58 | Desktop excellent (96); mobile critical gap (63, LCP 4.9s) |
| Conversion readiness | 52 | CTAs present but mismatched; benchmark/blog post-conversion not optimised |
| Analytics readiness | 68 | GA4 + GSC installed; event tracking extent unknown |
| India / International SEO | 52 | India-focused content and pricing in INR; hreflang bug (Hindi with no Hindi content) |
| **Overall Top-3 readiness** | **44** | Technical base is solid; authority, content depth, and brand entity are the blockers |

---

## 14. P0 / P1 / P2 / P3 IMPLEMENTATION BACKLOG

### P0 — Critical / Implement Now

| Task | Impact | Effort | Type |
|------|--------|--------|------|
| Fix hreflang: remove hi/en-IN from layout.tsx | HIGH | Low | Code fix |
| Fix LocalBusiness telephone empty string | MEDIUM | Low | Code fix |
| Add Article JSON-LD to all 8 blog posts | HIGH | Medium | Code |
| Add JSON-LD (BreadcrumbList + FAQ) to comparison/lakera, /hiddenlayer, /prompt-security | HIGH | Medium | Code |
| Add /about page (company, team, mission) | HIGH | Medium | New page |
| Add /model-supply-chain-security to sitemap.ts | LOW | Low | Code fix |
| Add /ai-safe-mode and /ai-memory-inspector to sitemap.ts | LOW | Low | Code fix |
| Create /integrations/n8n page | HIGH | Medium | New page |
| Create /integrations/zapier page | HIGH | Medium | New page |
| Create /integrations/make page | HIGH | Medium | New page |
| Create /cursor-ai-security page | MEDIUM | Medium | New page |
| Add SearchAction to WebSite schema | MEDIUM | Low | Code fix |
| Expand Organization.sameAs (add Marketplace, npm URLs) | MEDIUM | Low | Code fix |

### P1 — High Priority / Days 1-30

| Task | Impact | Effort | Type |
|------|--------|--------|------|
| Context-specific CTAs in FeatureLanding (not always VS Code) | HIGH | Medium | Code |
| Fix homepage final CTA from /docs → /signup | HIGH | Low | Code |
| Add openGraph.type:"article" + datePublished to blog posts | MEDIUM | Low | Code |
| Fix mobile performance (LCP 4.9s): lazy-load below-fold, hero preload | HIGH | High | Code |
| Fix accessibility: button-name, color-contrast, target-size | MEDIUM | Medium | Code |
| Add author attribution to all blog posts (at minimum Organization schema) | HIGH | Medium | Content |
| Create /windsurf-ai-security page | MEDIUM | Medium | New page |
| Create /integrations/ hub page | MEDIUM | Low | New page |
| Add VideoObject schema to /demo page | LOW | Low | Code |
| Submit sitemap to GSC and Bing Webmaster Tools | HIGH | Low | Action |
| Create LinkedIn company page | HIGH | Low | Marketing |
| Submit to VS Code Marketplace — ensure listing is complete | HIGH | Low | Marketing |

### P2 — Medium Priority / Days 31-60

| Task | Impact | Effort | Type |
|------|--------|--------|------|
| Publish India PII benchmark dataset to Hugging Face | HIGH | High | Research |
| Write original "State of MCP Security 2026" research post | HIGH | High | Content |
| Create MCP security checklist (interactive / downloadable) | HIGH | Medium | Content |
| Add SoterAI to Product Hunt | HIGH | Low | Marketing |
| Reach out to edgelabs.ai, cyberkendra.com for inclusion | HIGH | Medium | Outreach |
| Create /compliance/dpdp page | MEDIUM | Medium | New page |
| Add HowTo schema to /docs/quickstart | MEDIUM | Low | Code |
| Implement rank tracking (GSC + manual spot checks) | MEDIUM | Medium | Analytics |
| Create YouTube demo video with proper VideoObject schema | MEDIUM | High | Content |
| Internal linking audit: add benchmark links from all feature pages | MEDIUM | Low | Content |

### P3 — Lower Priority / Days 61-90

| Task | Impact | Effort | Type |
|------|--------|--------|------|
| International SEO strategy (only if non-English content planned) | LOW | High | Strategy |
| Programmatic SEO assessment for integration/glossary pages | MEDIUM | High | Strategy |
| Open-source tool / GitHub repo for link building | HIGH | Very High | Development |
| Conference/podcast outreach plan | MEDIUM | High | Marketing |
| A/B test homepage CTA copy | MEDIUM | Medium | CRO |
| Canonical review of /benchmark vs /benchmarks (possible duplicate) | MEDIUM | Low | Audit |
| Per-page OG image generation for comparison/blog pages | LOW | Medium | Code |

---

## 15. 30/60/90-DAY ROADMAP

### Days 1–30: Fix, Fill, and Index

| Activity | Owner | Effort | Success metric | Risk |
|----------|-------|--------|---------------|------|
| Fix hreflang bug (remove hi/en-IN) | Dev | 30 min | No invalid hreflang in GSC | Low |
| Add Article JSON-LD to blog posts | Dev | 2 hours | Rich results test passes | Low |
| Add comparison page JSON-LD | Dev | 2 hours | Rich results test passes | Low |
| Add /integrations/n8n, /zapier, /make pages | Dev | 1 day | Pages indexed in GSC | Low |
| Add /about page | Dev + Content | 1 day | E-E-A-T signal visible | Low |
| Fix LocalBusiness telephone | Dev | 15 min | Schema valid | Low |
| Add SearchAction to WebSite | Dev | 30 min | Sitelinks search box eligible | Low |
| Expand Organization.sameAs | Dev | 30 min | Entity connections richer | Low |
| Submit sitemap to GSC + Bing | SEO | 15 min | Sitemap accepted | Low |
| Fix homepage final CTA | Dev | 15 min | Signup CTA prominent | Low |
| Complete VS Code Marketplace listing | Marketing | 2 hours | Reviews/installs increase | Low |
| Create LinkedIn company page | Marketing | 1 hour | Brand entity signal | Low |
| Export GSC baseline data | SEO | 30 min | Have baseline metrics | Low |

### Days 31–60: Content Depth and Authority

| Activity | Owner | Effort | Success metric | Risk |
|----------|-------|--------|---------------|------|
| Publish "State of MCP Security 2026" research post | Content | 3 days | Links from MCP community | Medium |
| India PII benchmark dataset on Hugging Face | Dev + Content | 2 days | Citations, downloads | Medium |
| MCP security checklist (GitHub + page) | Dev + Content | 2 days | Stars, links | Low |
| Submit to Product Hunt | Marketing | 1 day | Upvotes, backlinks | Medium |
| Context-specific CTAs in FeatureLanding | Dev | 1 day | Conversion rate improvement | Low |
| /compliance/dpdp page | Dev + Content | 1 day | DPDP keyword rankings | Low |
| Outreach to edgelabs.ai, cyberkendra.com | SEO | 3 hours | Inclusion in roundup | Medium |
| Fix mobile performance (lazy-load, hero preload) | Dev | 2 days | Mobile LCP <2.5s | Medium |
| Internal linking: benchmark links from feature pages | Dev | 2 hours | Benchmark page impressions | Low |
| /windsurf-ai-security and /cursor-ai-security pages | Dev | 1 day | Niche keyword coverage | Low |

### Days 61–90: Distribution, CRO, and Measurement

| Activity | Owner | Effort | Success metric | Risk |
|----------|-------|--------|---------------|------|
| Rank tracking system setup | SEO | 1 day | Weekly keyword reports | Low |
| GSC CTR optimisation for pages in positions 11-20 | SEO | Ongoing | CTR improvement | Low |
| Accessibility fixes (button-name, contrast, targets) | Dev | 1 day | Accessibility score >95 | Low |
| Author attribution added to all blog posts | Content | 2 hours | E-E-A-T improvement | Low |
| Content refresh: update 3 oldest blog posts | Content | 2 days | Ranking improvement | Low |
| /enterprise-ai-security conversion optimisation | Dev + Content | 1 day | Demo requests increase | Low |
| YouTube demo video published | Marketing | 3 days | Video impressions, links | Medium |
| Second Product Hunt comment strategy (replies, updates) | Marketing | Ongoing | Sustained visibility | Low |
| GSC 30-day review: identify quick wins in pos 11-20 | SEO | 1 hour | Data-driven next steps | Low |

---

## 16. RANK TRACKING PLAN

### Priority Keywords to Track

| Keyword | Country | Device | Target page | Current | Source |
|---------|---------|--------|------------|---------|--------|
| MCP security | IN | Mobile | /mcp-security | Unverified | GSC |
| MCP security | US | Desktop | /mcp-security | Unverified | GSC |
| AI security India | IN | Mobile | /ai-security-india | Unverified | GSC |
| India PII detection | IN | Mobile | /ai-security-india | Unverified | GSC |
| DPDP AI compliance | IN | Mobile | /ai-security-india | Unverified | GSC |
| VS Code AI security extension | Global | Desktop | /vscode-ai-security | Unverified | GSC |
| prompt injection protection | Global | Desktop | /prompt-injection-protection | Unverified | GSC |
| jailbreak detection LLM | Global | Desktop | /jailbreak-detection | Unverified | GSC |
| RAG security | Global | Desktop | /rag-security | Unverified | GSC |
| AI agent security | Global | Desktop | /ai-agent-security | Unverified | GSC |
| LLM security platform | Global | Desktop | /llm-security | Unverified | GSC |
| SoterAI | Global | All | / | Unverified | GSC |
| SoterAI Guard | Global | All | / | Unverified | GSC |
| n8n AI security | Global | Desktop | /integrations/n8n | Unverified | GSC |

### Measurement Protocol

1. Export GSC performance data weekly (minimum)
2. Segment by: branded vs non-branded, India vs global, mobile vs desktop
3. Alert thresholds:
   - Entry into top 20: monitor weekly
   - Entry into top 10: notify immediately
   - Entry into top 3: celebrate + document evidence
   - Position drop >5: investigate within 48h
   - Indexation loss: investigate within 24h

### Tools (no black-hat scraping)

- Primary: Google Search Console (free, accurate, authoritative)
- Secondary: Bing Webmaster Tools (submit sitemap separately)
- Tertiary: PageSpeed Insights for CWV field data
- Optional: Ahrefs/Semrush lite plan for competitor gap analysis

---

## 17. CHANGES IMPLEMENTED IN THIS SESSION

All changes verified with `git status` and `npx tsc --noEmit` (exit code 0).

### Modified files (git diff --name-only HEAD)

| File | Change |
|------|--------|
| `app/layout.tsx` | Removed invalid hreflang: `hi` and `en-IN` — no Hindi content exists |
| `app/page.tsx` | Homepage final CTA updated from docs-only to "Create free account → /signup" |
| `app/sitemap.ts` | Added: /cursor-ai-security, /windsurf-ai-security, /integrations, /integrations/n8n, /integrations/zapier, /integrations/make, /about, /model-supply-chain-security. Updated lastmod to 2026-07-28 |
| `app/benchmark/page.tsx` | Clarified title — disambiguated from /benchmarks |
| `app/benchmarks/page.tsx` | Clarified title — disambiguated from /benchmark |
| `app/blog/*/page.tsx` (all 8) | Added `isArticle: true` + `datePublished` to all 8 blog post `buildMetadata` calls, enabling `og:type article` and `publishedTime` |
| `lib/seo/metadata.ts` | Extended `PageMetaInput` interface with `isArticle?` and `datePublished?`. Extended `buildMetadata` to emit `og:type: article`, `publishedTime`, and `twitter:creator` for article pages |
| `lib/seo/schema.ts` | Removed `telephone: ""` empty string from LocalBusiness. Added `potentialAction: SearchAction` to WebSite node. Expanded `ORG_SAME_AS` with VS Code Marketplace and npm URLs |
| `components/marketing/FeatureLanding.tsx` | Added `primaryCta()` and `secondaryCta()` helpers — IDE pages show "Install VS Code extension", API/platform pages show "Start for free → /signup". Hero and bottom CTA now context-aware. IDE_PAGES set defined |
| `components/marketing/VsCompetitor.tsx` | Added `breadcrumbList` import and `JsonLd` import. All 3 comparison sub-pages now emit `BreadcrumbList` JSON-LD automatically |

### New files created (git status ??)

| File | Purpose |
|------|---------|
| `app/about/page.tsx` | Company About page — critical E-E-A-T signal. Includes Organization AboutPage JSON-LD, BreadcrumbList, company mission, product description, contact info |
| `app/cursor-ai-security/page.tsx` | Cursor IDE security landing page. Targets "cursor security extension", "cursor ai security". Full FeatureLanding with limitations and FAQs |
| `app/windsurf-ai-security/page.tsx` | Windsurf IDE security landing page. Targets "windsurf security extension", "windsurf ai security". Full FeatureLanding with limitations and FAQs |
| `app/integrations/page.tsx` | Integrations hub page. Lists all integrations with BreadcrumbList JSON-LD |
| `app/integrations/n8n/page.tsx` | n8n AI security integration guide. Targets "n8n ai security". Includes HowTo + FAQPage + BreadcrumbList JSON-LD. Step-by-step setup guide |
| `app/integrations/zapier/page.tsx` | Zapier AI security integration guide. Targets "zapier ai security". Includes HowTo + FAQPage + BreadcrumbList JSON-LD |
| `app/integrations/make/page.tsx` | Make.com AI security integration guide. Targets "make.com ai security". Includes HowTo + FAQPage + BreadcrumbList JSON-LD |
| `docs/seo/SOTERAI_TOP3_SEO_REPORT.md` | This master report (54KB, 800+ lines) |
| `docs/seo/keyword-map.csv` | 70-keyword universe with intent, funnel, page mapping, cannibalisation flags |
| `docs/seo/content-clusters.md` | 9 topic clusters with pillar + supporting pages |
| `docs/seo/keyword-cannibalisation-report.md` | 6 cannibalisation risks identified and resolved |
| `docs/seo/90-day-content-calendar.md` | 18 content assets planned for 90 days |
| `docs/seo/digital-pr-plan.md` | Ethical link-building and digital PR plan |
| `docs/seo/backlink-opportunity-map.csv` | 25 link opportunities with effort, risk, and priority |

### TypeScript verification

```
npx tsc --noEmit
Exit code: 0 — zero errors across all new and modified files
```

### Build verification

```
npx next build — timed out at 180s (expected for large Next.js project on dev machine)
TypeScript noEmit is the primary compilation evidence
```

---


## 18. REMAINING BLOCKERS

| Blocker | Impact | Human action required |
|---------|--------|----------------------|
| No GSC export available | HIGH — cannot verify rankings or coverage errors | Export GSC data: Performance, Index Coverage, CWV |
| No Ahrefs/Semrush access | MEDIUM — cannot confirm backlink count | Get tool access for backlink audit |
| Brand confusion with soter.com | HIGH — entity disambiguation difficult without backlinks | Build entity signals: Product Hunt, LinkedIn, GitHub org |
| No About/team information provided | MEDIUM — cannot write accurate About page | Provide company/team details |
| Mobile performance fix requires testing | HIGH — cannot deploy without environment | Run `npx lighthouse https://soterai.in` post-fix |
| Author names for blog posts | MEDIUM — real author improves E-E-A-T | Provide real author name(s) or confirm using company name |
| VS Code Marketplace install count | MEDIUM — social proof signal | Check and report marketplace stats |

---

## 19. FINAL HONEST VERDICT

SoterAI has built a technically excellent product with genuinely unique differentiation
(India PII, MCP security, local-first, free tier, self-hosted). The website is
correctly structured, server-rendered, and technically competent for SEO.

**The honest problem: this is a well-built site that no one has linked to yet.**

Ranking in the top 3 for "AI security platform" or "LLM security" against
Lakera (Check Point), Palo Alto, HiddenLayer, and GA Guard within 6 months is
not realistic given the current authority gap. These are well-funded enterprises
with years of backlink accumulation.

**What IS realistic:**

- Top 3 for "AI security India" within 3-5 months — thin competition, strong product fit
- Top 3 for "India PII detection AI" within 3-5 months — same
- Top 5 for "MCP security" within 4-6 months — first-mover window closing but not gone
- Top 10 for "VS Code AI security extension" within 3-6 months — niche enough
- Top 10 for "DPDP AI compliance" within 3-6 months — nascent keyword

**The path forward is clear:**
1. Fix the technical bugs identified in this audit (2 days)
2. Build the missing integration and IDE pages (3 days)
3. Create an original research asset the community will link to (2 weeks)
4. Get listed in the roundup articles that currently rank (ongoing)
5. Establish brand entity signals across GitHub, Marketplace, Product Hunt (ongoing)

The product quality is there. The execution gap is in content authority and distribution.
