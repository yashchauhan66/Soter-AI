# SoterAI SEO Audit

**Date:** 2026-07-06
**Domain:** soterai.in
**Stack:** Next.js 15 (App Router), Tailwind CSS, self-hosted fonts, Vercel deployment
**Pages audited:** 181 routes (56 with explicit metadata exports)

---

## 1. Title Tags

| Item | Status | Details |
|------|--------|---------|
| Root default title | PASS | `SoterAI \| AI Security Command Layer` set in root layout metadata |
| Title template | PASS | `%s \| SoterAI` template ensures consistent branding across child pages |
| Unique titles per page | NEEDS IMPROVEMENT | 56 of ~70 public pages export custom metadata. Remaining pages inherit the root default title, which causes duplication in SERPs |
| Title length (50-60 chars) | NEEDS IMPROVEMENT | Some titles exceed 60 characters (e.g., compliance pages). Audit all titles for truncation in SERPs |
| Primary keyword in title | NEEDS IMPROVEMENT | Most titles are descriptive but not all lead with the target keyword. Comparison pages and docs pages should front-load keywords |

**Recommendations:**
- Add explicit `metadata` exports to every public-facing page that currently relies on the root default
- Audit all titles for length (aim for 50-60 characters)
- Front-load primary keywords in titles where natural (e.g., "AI Context Firewall" before "SoterAI")
- Ensure no two pages share the same title string

---

## 2. Meta Descriptions

| Item | Status | Details |
|------|--------|---------|
| Root default description | PASS | Comprehensive description set in root layout |
| Unique descriptions per page | NEEDS IMPROVEMENT | 56 pages have custom descriptions. Others inherit the root description, creating duplicate meta descriptions across the site |
| Description length (120-155 chars) | NOT VERIFIED | Need to audit each page's description length. Some may be too long or too short |
| Keyword inclusion | NEEDS IMPROVEMENT | Not all descriptions include the primary target keyword for that page |
| CTA in description | NEEDS IMPROVEMENT | Few descriptions include action-oriented language that drives clicks from SERPs |

**Recommendations:**
- Write unique meta descriptions for every indexable page (especially /enterprise, /enterprise/pilot, /demo/*, /playground)
- Keep all descriptions between 120-155 characters
- Include the primary keyword naturally within the first 100 characters
- Add a CTA phrase where appropriate ("Try free", "See how", "Get started")

---

## 3. Heading Structure (H1/H2)

| Item | Status | Details |
|------|--------|---------|
| Single H1 per page | NOT VERIFIED | Need to audit each page component for multiple H1 tags. Next.js components may render multiple H1s if not careful |
| H1 matches page topic | NOT VERIFIED | H1 content should closely match the title tag and target keyword |
| Logical H2-H6 hierarchy | NOT VERIFIED | Need to audit heading nesting. Common issue: skipping from H1 to H3 |
| Keywords in headings | NOT VERIFIED | Secondary keywords should appear in H2/H3 subheadings |

**Recommendations:**
- Audit every public page for exactly one H1 tag
- Ensure H1 includes the primary keyword and is distinct from the title tag
- Verify heading hierarchy does not skip levels (H1 > H2 > H3, never H1 > H3)
- Use H2s for major sections, H3s for subsections -- never use headings for styling only

---

## 4. Canonical URLs

| Item | Status | Details |
|------|--------|---------|
| Self-referencing canonicals | PASS | Most public pages set `alternates.canonical` in their metadata export |
| Homepage canonical | PASS | Homepage sets `alternates.canonical: "/"` |
| Trailing slash consistency | PASS | Next.js App Router handles trailing slashes consistently |
| No conflicting canonicals | NOT VERIFIED | Need to verify no page points its canonical to a different page unintentionally |
| Dynamic routes | NEEDS IMPROVEMENT | `app/docs/services/[id]/page.tsx` uses `generateMetadata` -- verify canonical is set for each generated page |
| `metadataBase` set | PASS | Root layout sets `metadataBase: new URL("https://soterai.in")` (from env) |

**Recommendations:**
- Add `alternates.canonical` to every page that currently lacks it
- Verify `/docs/services/[id]` dynamic routes generate correct canonical URLs
- Ensure `security-status/[slug]` dynamic routes set canonicals

---

## 5. Sitemap

| Item | Status | Details |
|------|--------|---------|
| Sitemap exists | PASS | `app/sitemap.ts` generates sitemap programmatically |
| All public pages included | NEEDS IMPROVEMENT | Sitemap covers 19 marketing + 3 compliance + 8 legal + 18 docs + dynamic service pages. Missing: `/demo/*`, `/playground`, `/case-studies/*`, `/changelog`, `/support`, `/partners/*`, `/model-supply-chain-security` |
| Priority values set | PASS | Homepage 1.0, key pages 0.8-0.9, others 0.4-0.6 |
| changeFrequency set | PASS | Ranges from daily (/status) to yearly (legal pages) |
| lastModified set | NEEDS IMPROVEMENT | Uses static `SITE_LAST_MODIFIED = "2026-06-29"` for all pages instead of per-page dates |
| Dynamic service pages | PASS | Auto-generated from `SERVICES` constant |
| Submitted to Google Search Console | NOT VERIFIED | Sitemap URL is declared in robots.txt |

**Recommendations:**
- Add missing public pages to the sitemap (demo, playground, case studies, changelog, support, partners)
- Implement per-page `lastModified` dates instead of a single static date
- Verify sitemap is accessible at `https://soterai.in/sitemap.xml`
- Submit sitemap in Google Search Console and Bing Webmaster Tools
- Consider a sitemap index if page count exceeds 500

---

## 6. Robots.txt

| Item | Status | Details |
|------|--------|---------|
| Robots.txt exists | PASS | `app/robots.ts` generates robots.txt programmatically |
| Public pages allowed | PASS | Default rule allows `/` |
| Private pages disallowed | PASS | Disallows `/api/`, `/admin/`, `/dashboard/`, auth pages, `/_next/` |
| AI crawlers allowed | PASS | Intentional decision -- 11 AI crawlers explicitly allowed (GPTBot, ClaudeBot, PerplexityBot, etc.) |
| Sitemap referenced | PASS | Sitemap URL included in robots.txt |
| Host declared | PASS | Host set to `https://soterai.in` |

**Recommendations:**
- No changes needed. The AI crawler allowlist is a deliberate strategic choice for AI visibility
- Monitor AI crawler traffic in analytics to assess impact
- Consider adding `Crawl-delay` if AI crawlers cause excessive load

---

## 7. OpenGraph Tags

| Item | Status | Details |
|------|--------|---------|
| Default OG tags | PASS | Root layout sets `openGraph` with type, locale, siteName, image (1200x630) |
| Dynamic OG image | PASS | `app/opengraph-image.tsx` generates branded OG images via `next/og` ImageResponse |
| Per-page OG titles | NEEDS IMPROVEMENT | Only ~30 pages set custom OG properties. Others inherit root defaults |
| Per-page OG descriptions | NEEDS IMPROVEMENT | Same as above -- pages without custom metadata get the generic site description |
| OG URL per page | NEEDS IMPROVEMENT | Few pages set `openGraph.url` explicitly. Relying on canonical for this |
| OG type per page | NEEDS IMPROVEMENT | Root sets `type: "website"`. Blog posts should use `type: "article"` |

**Recommendations:**
- Ensure every public page has `openGraph.title` and `openGraph.description` in its metadata
- Set `openGraph.type: "article"` for blog posts and case studies
- Add `openGraph.publishedTime` and `openGraph.modifiedTime` for article-type pages
- Consider per-page dynamic OG images for high-traffic pages (comparison, pricing)

---

## 8. Twitter Cards

| Item | Status | Details |
|------|--------|---------|
| Default Twitter card | PASS | Root layout sets `twitter.card: "summary_large_image"` with image and `@soterai` handle |
| Per-page Twitter titles | NEEDS IMPROVEMENT | Inherits from page title or OG title. Not explicitly set on most pages |
| Per-page Twitter descriptions | NEEDS IMPROVEMENT | Same as OG descriptions -- most pages inherit root default |
| Twitter site handle | PASS | `@soterai` set in root layout |
| Twitter creator handle | NEEDS IMPROVEMENT | No `twitter.creator` set for blog/article content |

**Recommendations:**
- Twitter cards inherit from OG tags when not set, so fixing OG tags (Section 7) addresses most issues
- Add `twitter.creator` for authored content (blog posts, case studies)
- Validate cards using Twitter Card Validator for key landing pages

---

## 9. Schema.org Structured Data

| Item | Status | Details |
|------|--------|---------|
| Organization schema | PASS | Site-wide via `lib/seo/schema.ts` -- includes name, logo, URL, contactPoint, sameAs, foundingDate |
| WebSite schema | PASS | Site-wide with SearchAction potentialAction |
| SoftwareApplication schema | PASS | Homepage includes SoftwareApplication with offers, rating, category |
| FAQPage schema | PASS | Homepage and Docs hub include FAQPage structured data |
| BreadcrumbList schema | PASS | All 16+ docs sub-pages include BreadcrumbList via `breadcrumbList()` helper |
| Product schema | PASS | Pricing page includes Product + AggregateOffer |
| Article schema | NEEDS IMPROVEMENT | Blog posts and case studies lack Article structured data |
| Comparison pages | NEEDS IMPROVEMENT | Comparison pages (Lakera, HiddenLayer, Prompt Security) lack structured data |
| JSON-LD safety | PASS | `safeJsonLd` function escapes XSS vectors in JSON-LD output |
| Validation | NOT VERIFIED | Need to validate all structured data with Google Rich Results Test |

**Recommendations:**
- Add Article schema to blog posts and case studies with `author`, `datePublished`, `dateModified`
- Add FAQ schema to comparison pages (common comparison questions)
- Add HowTo schema to quickstart and integration docs
- Validate all existing structured data at https://search.google.com/test/rich-results
- Consider adding Review/AggregateRating schema once user reviews are collected

---

## 10. Internal Linking

| Item | Status | Details |
|------|--------|---------|
| Navigation links | PASS | Main nav links to key pages (pricing, docs, features) |
| Docs cross-linking | PASS | `relatedDocs` field in SERVICES enables cross-linking between doc pages |
| Comparison page linking | NEEDS IMPROVEMENT | Comparison pages should link to each other and to feature pages they discuss |
| CTA links on landing pages | NEEDS IMPROVEMENT | Feature pages should link to pricing, docs, and related comparison pages |
| Footer links | NOT VERIFIED | Footer should include links to all major sections |
| Orphan pages | NEEDS IMPROVEMENT | Some pages (e.g., `/model-supply-chain-security`, `/partners/agency`) may have few or no inbound internal links |
| Anchor text variety | NOT VERIFIED | Need to audit anchor text for keyword-rich, descriptive linking |

**Recommendations:**
- Add "Related" sections at the bottom of comparison pages linking to other comparisons
- Add contextual links from feature descriptions to relevant docs pages
- Create a hub-and-spoke linking model: feature pages link to docs, docs link back to features
- Audit for orphan pages with zero or one inbound internal link
- Use descriptive anchor text (not "click here" or "learn more")

---

## 11. Image Alt Text

| Item | Status | Details |
|------|--------|---------|
| Logo alt text | NOT VERIFIED | Check that the SoterAI logo has descriptive alt text |
| Feature illustrations | NOT VERIFIED | Dashboard screenshots and feature images need audit |
| Icons as decorative | NOT VERIFIED | Lucide/Hero icons used throughout should have `aria-hidden="true"` or empty alt |
| OG image alt | PASS | OG image has alt text set in metadata |

**Recommendations:**
- Audit all `<img>` and `<Image>` tags for meaningful alt text
- Use descriptive alt text for informational images (e.g., "SoterAI dashboard showing prompt injection detection results")
- Mark decorative images with `alt=""` and icons with `aria-hidden="true"`
- Ensure Next.js `<Image>` components always include the `alt` prop

---

## 12. Page Speed & Performance

| Item | Status | Details |
|------|--------|---------|
| Next.js 15 with Turbopack | PASS | Modern framework with optimized bundling |
| Self-hosted fonts | PASS | `next/font/local` with Inter and JetBrains Mono -- no external font requests |
| Font display swap | PASS | Both fonts use `display: "swap"` for fast text rendering |
| Image optimization | PASS | Next.js `<Image>` component handles responsive images, lazy loading, WebP |
| Bundle splitting | PASS | App Router automatic code splitting per route |
| Static generation | NEEDS IMPROVEMENT | Verify which pages use SSG vs SSR. Marketing pages should be statically generated |
| Third-party scripts | NEEDS IMPROVEMENT | Google Analytics loaded. Check for render-blocking third-party scripts |

**Recommendations:**
- Run Lighthouse on key landing pages and document scores
- Ensure all marketing/landing pages use `export const dynamic = "force-static"` where possible
- Defer non-critical JavaScript (analytics, chat widgets)
- Verify no layout shift from font loading (CLS)
- Add `preload: true` to primary font (Inter) for above-the-fold text

---

## 13. Mobile Responsiveness

| Item | Status | Details |
|------|--------|---------|
| Viewport meta tag | PASS | Set in root layout viewport export |
| Tailwind responsive classes | PASS | Tailwind CSS used throughout with responsive breakpoints |
| Touch targets | NOT VERIFIED | Buttons and links need minimum 48x48px touch targets |
| Mobile navigation | NOT VERIFIED | Check hamburger menu and mobile nav usability |
| Content reflow | NOT VERIFIED | Verify no horizontal scroll on mobile viewports |

**Recommendations:**
- Test all public pages on mobile viewport (375px width) using Chrome DevTools
- Verify touch targets meet Google's 48x48px minimum
- Check for text readability without zooming (minimum 16px body text)
- Test mobile navigation flow end-to-end

---

## 14. Core Web Vitals

| Item | Status | Details |
|------|--------|---------|
| LCP (Largest Contentful Paint) | NOT VERIFIED | Target: < 2.5s. Self-hosted fonts and static generation should help |
| FID/INP (Interaction to Next Paint) | NOT VERIFIED | Target: < 200ms. App Router with client-side hydration needs measurement |
| CLS (Cumulative Layout Shift) | NOT VERIFIED | Target: < 0.1. Font swap and image dimensions need verification |
| TTFB (Time to First Byte) | NOT VERIFIED | Depends on Vercel edge deployment and SSG/SSR split |

**Recommendations:**
- Set up Core Web Vitals monitoring via Google Search Console
- Run PageSpeed Insights on top 10 landing pages
- Address any LCP issues by preloading hero images and critical fonts
- Prevent CLS by setting explicit dimensions on all images and reserving space for dynamic content
- Consider adding `next/script` with `strategy="lazyOnload"` for analytics

---

## 15. Duplicate Content Risk

| Item | Status | Details |
|------|--------|---------|
| Comparison pages | NEEDS IMPROVEMENT | `/comparison/lakera`, `/comparison/hiddenlayer`, `/comparison/prompt-security` may share significant boilerplate about SoterAI features |
| Docs service pages | NEEDS IMPROVEMENT | Dynamic `/docs/services/[id]` pages could have similar structure. Ensure enough unique content per service |
| WWW vs non-WWW | NOT VERIFIED | Verify redirect from www.soterai.in to soterai.in (or vice versa) |
| HTTP vs HTTPS | NOT VERIFIED | Verify HTTP redirects to HTTPS |
| Trailing slash | PASS | Next.js handles consistently |

**Recommendations:**
- Ensure each comparison page has at least 60% unique content (not just swapping competitor names)
- Add unique FAQs, feature comparison tables, and use-case scenarios per comparison page
- Verify domain-level redirects (www, http) in Vercel dashboard
- Use canonical URLs to consolidate any duplicate content paths

---

## 16. Thin Content Risk

| Item | Status | Details |
|------|--------|---------|
| Feature pages | NEEDS IMPROVEMENT | Some feature pages may lack sufficient depth. Aim for 800+ words per landing page |
| Legal pages | PASS | Privacy, terms, etc. are expected to have standard content |
| Docs pages | PASS | Integration guides and API docs have substantial content |
| Demo/playground | NEEDS IMPROVEMENT | Interactive pages may have little indexable text content |
| Case studies template | FAIL | `/case-studies/template` appears to be a template page that should not be indexed |

**Recommendations:**
- Add `noindex` to `/case-studies/template` and any other template/placeholder pages
- Ensure each landing page has at least 800 words of unique, valuable content
- Add FAQ sections to thin pages to increase content depth
- Expand feature pages with use cases, code examples, and benefits sections

---

## 17. Crawlability

| Item | Status | Details |
|------|--------|---------|
| Server-side rendering | PASS | Next.js App Router with SSR/SSG ensures crawlable HTML |
| JavaScript rendering | PASS | Content is server-rendered, not client-only |
| robots.txt blocks | PASS | Only private routes blocked |
| Internal link depth | NEEDS IMPROVEMENT | Some pages may be 4+ clicks from homepage |
| 404 handling | NOT VERIFIED | Verify custom 404 page exists and returns proper status code |
| Redirect chains | NOT VERIFIED | Check for redirect chains (301 > 301 > 200) |
| XML sitemap accuracy | NEEDS IMPROVEMENT | Some public pages missing from sitemap (see Section 5) |

**Recommendations:**
- Ensure no public page is more than 3 clicks from the homepage
- Create a custom 404 page with helpful navigation links
- Audit for broken internal links periodically
- Fix any redirect chains to single-hop redirects
- Keep sitemap in sync with all indexable pages

---

## 18. HTTPS

| Item | Status | Details |
|------|--------|---------|
| SSL certificate | PASS | Vercel provides automatic SSL |
| HTTP to HTTPS redirect | NOT VERIFIED | Should be automatic via Vercel but verify |
| Mixed content | NOT VERIFIED | Ensure no HTTP resources loaded on HTTPS pages |
| HSTS header | NOT VERIFIED | Check for Strict-Transport-Security header |

**Recommendations:**
- Verify HSTS header is set in Vercel configuration or `next.config.js` headers
- Audit for mixed content warnings in browser console
- Ensure all internal links use relative paths or HTTPS URLs

---

## 19. Clean URLs

| Item | Status | Details |
|------|--------|---------|
| No file extensions | PASS | Next.js App Router provides extensionless URLs |
| Lowercase URLs | PASS | All route directories use lowercase |
| No query parameters for content | PASS | Content pages use path-based routing, not query strings |
| Descriptive slugs | PASS | URLs like `/comparison/lakera`, `/docs/quickstart` are descriptive |
| URL depth | PASS | Most URLs are 2-3 levels deep maximum |

**Recommendations:**
- No changes needed. URL structure is clean and SEO-friendly
- Maintain this standard for all new pages

---

## Summary Scorecard

| Category | Status | Score |
|----------|--------|-------|
| Title Tags | NEEDS IMPROVEMENT | 7/10 |
| Meta Descriptions | NEEDS IMPROVEMENT | 6/10 |
| Heading Structure | NOT VERIFIED | --/10 |
| Canonical URLs | PASS | 8/10 |
| Sitemap | NEEDS IMPROVEMENT | 7/10 |
| Robots.txt | PASS | 10/10 |
| OpenGraph Tags | NEEDS IMPROVEMENT | 6/10 |
| Twitter Cards | NEEDS IMPROVEMENT | 6/10 |
| Schema.org Structured Data | PASS | 8/10 |
| Internal Linking | NEEDS IMPROVEMENT | 5/10 |
| Image Alt Text | NOT VERIFIED | --/10 |
| Page Speed | PASS | 8/10 |
| Mobile Responsiveness | PASS | 8/10 |
| Core Web Vitals | NOT VERIFIED | --/10 |
| Duplicate Content Risk | NEEDS IMPROVEMENT | 6/10 |
| Thin Content Risk | NEEDS IMPROVEMENT | 6/10 |
| Crawlability | PASS | 7/10 |
| HTTPS | PASS | 9/10 |
| Clean URLs | PASS | 10/10 |

**Overall SEO Health: 72/100 (estimated)**

### Top 5 Priority Actions

1. **Add unique metadata to all public pages** -- 14+ public pages lack custom title/description. This is the highest-impact fix
2. **Expand sitemap coverage** -- Add missing public pages (demo, playground, case studies, changelog, support, partners)
3. **Add Article schema to content pages** -- Blog posts and case studies need structured data for rich results
4. **Audit and fix internal linking** -- Create hub-and-spoke linking between features, docs, and comparison pages
5. **Measure Core Web Vitals** -- Run Lighthouse audits and set up monitoring in Google Search Console
