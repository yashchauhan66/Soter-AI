# Phase 11 -- Technical SEO Implementation Report

> **Goal:** Audit and document the current state of technical SEO implementation for soterai.in, identify gaps, and provide implementation code for missing elements.

---

## Implementation Status Summary

| Element | Status | Priority | Details |
|---------|--------|----------|---------|
| sitemap.xml | EXISTS | -- | Dynamic sitemap via `app/sitemap.ts`, 60+ URLs |
| robots.txt | EXISTS | -- | Via `app/robots.ts`, allows all crawlers including AI bots |
| Canonical tags | NEEDS VERIFICATION | P1 | Must verify per-page canonical URLs |
| Metadata per page | NEEDS AUDIT | P1 | Root layout has metadata; child pages need individual audit |
| OpenGraph images | NEED CREATION | P1 | OG image infrastructure needed |
| Twitter cards | NEED IMPLEMENTATION | P1 | Twitter card meta tags needed per page |
| JSON-LD: SoftwareApplication | EXISTS | -- | In `lib/seo/schema.ts`, injected via root layout |
| JSON-LD: Organization | EXISTS | -- | In `lib/seo/schema.ts` |
| JSON-LD: WebSite | EXISTS | -- | In `lib/seo/schema.ts` with SearchAction |
| JSON-LD: Product | NEEDS ADDITION | P2 | For pricing page |
| JSON-LD: FAQPage | NEEDS ADDITION | P2 | For FAQ sections across the site |
| JSON-LD: BreadcrumbList | NEEDS ADDITION | P2 | Helper exists in schema.ts, needs per-page usage |
| JSON-LD: Article | NEEDS ADDITION | P2 | For blog posts (when blog launches) |
| Clean URLs | YES | -- | App Router provides clean URLs by default |
| Image optimization | NEEDS AUDIT | P1 | Verify all images use `next/image` |
| Lazy loading | DEFAULT | -- | Next.js handles lazy loading of images and routes |
| Docs internal search | NEEDS IMPLEMENTATION | P3 | Not yet implemented |
| Redirects | NEEDS REVIEW | P2 | Check for broken/moved pages |
| 404 page | NEEDS VERIFICATION | P1 | Verify custom 404 exists and is useful |
| RSS feed | NEEDS IMPLEMENTATION | P3 | For blog posts when blog launches |

---

## Existing Infrastructure

### sitemap.ts

**Location:** `app/sitemap.ts`  
**Status:** Fully functional  
**Coverage:** 60+ URLs including marketing pages, docs, compliance, legal, per-service pages, comparison pages  
**Last modified:** 2026-06-29 (hardcoded; consider making dynamic)

**Recommendations:**
- Change `lastModified` to use actual file modification dates or git commit dates
- Add `changeFrequency` and `priority` fields for better crawler guidance
- Ensure new pages (blog posts, tutorials) are automatically included

```tsx
// Recommended enhancement to sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://soterai.in';

  // Static pages with manual priority
  const staticPages = [
    { url: `${baseUrl}/`, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/pricing`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${baseUrl}/docs`, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/comparison`, changeFrequency: 'monthly' as const, priority: 0.8 },
    // ... other static pages
  ];

  // Dynamic pages (services, docs, etc.)
  // ... existing service-derived pages

  return staticPages.map((page) => ({
    ...page,
    lastModified: new Date(), // Or use git-based dates
  }));
}
```

---

### robots.ts

**Location:** `app/robots.ts`  
**Status:** Fully functional  
**Notable:** Explicitly allows 11 AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)

**Current rules:**
- Allow: all public pages
- Disallow: `/api/`, `/admin/`, `/dashboard/`, auth pages
- Sitemap: `https://soterai.in/sitemap.xml`

**Recommendations:**
- Current configuration is intentional (allows AI crawlers for visibility) -- do not change
- Add `Crawl-delay` for aggressive bots if server load becomes an issue
- Consider adding `/playground` to disallow if it generates unique URLs that waste crawl budget

---

### JSON-LD Structured Data (lib/seo/schema.ts)

**Location:** `lib/seo/schema.ts`  
**Status:** Organization + WebSite + SoftwareApplication schemas exist  
**Injection:** Via root layout (`app/layout.tsx`)

**Current schemas:**
```
@graph: [
  Organization (soterai.in, with logo, social links)
  WebSite (soterai.in, with SearchAction for site search)
  SoftwareApplication (SoterAI, with offers, OS support, category)
]
```

**What is missing and needs to be added:**

---

## Missing Implementations

### 1. Canonical Tags (Per-Page Verification)

Next.js App Router sets canonical URLs through the `metadata` export. Each page must explicitly define its canonical URL to prevent duplicate content issues.

**Implementation:**

```tsx
// app/pricing/page.tsx (example for each page)
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — SoterAI',
  description: 'AI security that starts free. Local scanning, AI Safe Mode, and full audit trail at no cost.',
  alternates: {
    canonical: 'https://soterai.in/pricing',
  },
};
```

**Pages to verify/add canonical tags:**

| Page | Canonical URL | Status |
|------|-------------|--------|
| `/` | `https://soterai.in/` | VERIFY |
| `/pricing` | `https://soterai.in/pricing` | VERIFY |
| `/docs` | `https://soterai.in/docs` | VERIFY |
| `/docs/quickstart` | `https://soterai.in/docs/quickstart` | VERIFY |
| `/comparison` | `https://soterai.in/comparison` | VERIFY |
| `/comparison/soterai-vs-lakera` | `https://soterai.in/comparison/soterai-vs-lakera` | VERIFY |
| `/trust` | `https://soterai.in/trust` | VERIFY |
| `/privacy` | `https://soterai.in/privacy` | VERIFY |
| `/enterprise` | `https://soterai.in/enterprise` | VERIFY |
| All other pages | Corresponding canonical URL | VERIFY |

**Audit script:**
```bash
# Run against the deployed site to check canonical tags
curl -s https://soterai.in/ | grep -i 'canonical'
curl -s https://soterai.in/pricing | grep -i 'canonical'
curl -s https://soterai.in/docs | grep -i 'canonical'
# Repeat for all key pages
```

---

### 2. Per-Page Metadata Audit

Each page should have unique `title` and `description` metadata optimized for its target keywords.

**Recommended metadata for key pages:**

```tsx
// app/page.tsx (Homepage)
export const metadata: Metadata = {
  title: 'SoterAI — Local-First AI Security for Developers',
  description: 'Protect your secrets, prompts, MCP tools, and AI coding context locally before they reach AI. VS Code extension with AI Safe Mode, Context Firewall, and full audit trail.',
  alternates: { canonical: 'https://soterai.in/' },
};

// app/pricing/page.tsx
export const metadata: Metadata = {
  title: 'Pricing — SoterAI | Free AI Security for Developers',
  description: 'AI security that starts free. Local secret scanning, AI Safe Mode, Context Firewall, and audit trail at no cost. Pro and Enterprise tiers for teams.',
  alternates: { canonical: 'https://soterai.in/pricing' },
};

// app/docs/page.tsx
export const metadata: Metadata = {
  title: 'Documentation — SoterAI IDE Guard',
  description: 'Get started with SoterAI IDE Guard. Tutorials for AI Safe Mode, Local AI Broker, MCP security auditing, and DPDP compliance.',
  alternates: { canonical: 'https://soterai.in/docs' },
};

// app/comparison/page.tsx
export const metadata: Metadata = {
  title: 'Compare AI Security Tools — SoterAI vs Lakera, GHAS, Prompt Security',
  description: 'See how SoterAI compares to Lakera Guard, GitHub Advanced Security, Prompt Security, and HiddenLayer. Local-first, IDE-native AI security.',
  alternates: { canonical: 'https://soterai.in/comparison' },
};

// app/enterprise/page.tsx
export const metadata: Metadata = {
  title: 'Enterprise AI Security — SoterAI',
  description: 'Enterprise-grade AI security with SSO, audit log export, custom policies, and dedicated support. Protect your engineering team\'s AI workflows.',
  alternates: { canonical: 'https://soterai.in/enterprise' },
};

// app/trust/page.tsx
export const metadata: Metadata = {
  title: 'Trust Center — SoterAI Security & Privacy',
  description: 'How SoterAI protects your data. Local-first architecture, no telemetry by default, open-source core, and transparent security practices.',
  alternates: { canonical: 'https://soterai.in/trust' },
};
```

**Metadata rules:**
- Title: 50-60 characters, brand name at end (except homepage)
- Description: 150-160 characters, include primary keyword, include CTA or value proposition
- Every page must have unique title and description (no duplicates)

---

### 3. OpenGraph Images

**Implementation approach:** Use Next.js dynamic OG image generation via `opengraph-image.tsx`.

```tsx
// app/opengraph-image.tsx (Default OG image for all pages)
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SoterAI — Local-First AI Security for Developers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 'bold', color: '#ffffff', marginBottom: 20 }}>
          SoterAI
        </div>
        <div style={{ fontSize: 32, color: '#a0a0a0', textAlign: 'center', maxWidth: '80%' }}>
          Local-First AI Security for Developers
        </div>
        <div style={{ fontSize: 24, color: '#3b82f6', marginTop: 30 }}>
          soterai.in
        </div>
      </div>
    ),
    { ...size }
  );
}
```

```tsx
// app/pricing/opengraph-image.tsx (Page-specific OG image)
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SoterAI Pricing — Free AI Security for Developers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 'bold', color: '#ffffff', marginBottom: 20 }}>
          SoterAI Pricing
        </div>
        <div style={{ fontSize: 36, color: '#10b981', marginBottom: 10 }}>
          Starts Free. Stays Generous.
        </div>
        <div style={{ fontSize: 24, color: '#a0a0a0' }}>
          Local AI Security | No Account Required
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**OG images needed for:**
| Page | Image Content | Priority |
|------|-------------|----------|
| `/` (default) | SoterAI logo + tagline | P0 |
| `/pricing` | Pricing headline + free emphasis | P1 |
| `/docs` | Documentation + quick start | P1 |
| `/comparison/*` | "SoterAI vs X" for each competitor | P2 |
| `/enterprise` | Enterprise features | P2 |
| Blog posts (future) | Article title + author | P2 |

---

### 4. Twitter Card Implementation

Twitter cards should be configured alongside OpenGraph. Next.js handles this through the `metadata` export.

```tsx
// app/layout.tsx (add to existing metadata)
export const metadata: Metadata = {
  // ... existing metadata
  twitter: {
    card: 'summary_large_image',
    site: '@soterai_in', // Twitter handle
    creator: '@soterai_in',
    title: 'SoterAI — Local-First AI Security for Developers',
    description: 'Protect secrets, prompts, MCP tools, and AI context locally before they reach AI.',
    // images are auto-resolved from opengraph-image.tsx
  },
};
```

**Per-page Twitter metadata:**
```tsx
// app/pricing/page.tsx
export const metadata: Metadata = {
  // ... other metadata
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — SoterAI | Free AI Security',
    description: 'AI security that starts free. No account required.',
  },
};
```

---

### 5. JSON-LD: Product Schema (Pricing Page)

```tsx
// app/pricing/page.tsx or a dedicated component
import { safeJsonLd } from '@/lib/seo/jsonLd';

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'SoterAI IDE Guard',
  description: 'Local-first AI security extension for VS Code that protects secrets, prompts, and AI context.',
  brand: {
    '@type': 'Organization',
    name: 'SoterAI',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description: 'Full local scanning, AI Safe Mode, Context Firewall, audit trail',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '9',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '9',
        priceCurrency: 'USD',
        billingDuration: 'P1M', // Per month
      },
      description: 'Team policies, advanced analytics, CI/CD integration, unlimited canaries',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Enterprise',
      price: '0', // Contact for pricing
      priceCurrency: 'USD',
      description: 'SSO, audit log export, dedicated support, custom deployment',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '0',
        priceCurrency: 'USD',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: '1',
          unitText: 'Contact for pricing',
        },
      },
    },
  ],
  category: 'Developer Tools',
  operatingSystem: 'Windows, macOS, Linux',
  applicationCategory: 'SecurityApplication',
};

// In the page component:
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(productSchema) }} />
```

---

### 6. JSON-LD: FAQPage Schema

```tsx
// Reusable FAQ schema generator
function generateFaqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// Example usage for pricing page FAQ:
const pricingFaqs = [
  {
    question: 'Is SoterAI really free?',
    answer: 'Yes. The Free tier includes full local scanning, AI Safe Mode, AI Context Firewall, What AI Saw Ledger, MCP Tool Scanner, Terminal Command Firewall, and up to 5 canary secrets. No credit card required. No time limit.',
  },
  {
    question: 'Does SoterAI send my code to the cloud?',
    answer: 'No. SoterAI runs 100% locally on your machine. No code, secrets, or prompts are uploaded to SoterAI servers. Optional anonymized usage analytics are opt-in only.',
  },
  {
    question: 'Does SoterAI work with Copilot, Cursor, and Claude?',
    answer: 'Yes. SoterAI works with any AI coding assistant that runs in VS Code, including GitHub Copilot, Cursor, Claude (via extensions), Continue, and others.',
  },
  {
    question: 'What is AI Safe Mode?',
    answer: 'AI Safe Mode is a one-click toggle that redacts all detected secrets from AI context windows. When enabled, AI assistants see [REDACTED] tokens instead of real secret values, while still getting the code structure they need to help you.',
  },
  {
    question: 'What is the difference between Free and Pro?',
    answer: 'Free includes all core security features for individual developers. Pro adds team policies, shared configurations, advanced analytics, CI/CD integration, unlimited canary secrets, and priority support -- designed for teams and organizations.',
  },
];
```

---

### 7. JSON-LD: BreadcrumbList Schema

A helper already exists in `lib/seo/schema.ts`. It needs to be used on each page.

```tsx
// Usage in each page (example: /docs/tutorials/local-ai-broker)
import { generateBreadcrumbs } from '@/lib/seo/schema';

const breadcrumbs = generateBreadcrumbs([
  { name: 'Home', url: 'https://soterai.in/' },
  { name: 'Docs', url: 'https://soterai.in/docs' },
  { name: 'Tutorials', url: 'https://soterai.in/docs/tutorials' },
  { name: 'Local AI Broker', url: 'https://soterai.in/docs/tutorials/local-ai-broker' },
]);

// Render in page:
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbs) }} />
```

**Pages needing breadcrumbs:**
- All `/docs/*` pages (deep hierarchy)
- All `/comparison/*` pages
- All `/compliance/*` pages
- All `/case-studies/*` pages (if they have sub-pages)

---

### 8. JSON-LD: Article Schema (For Blog Posts)

```tsx
// Reusable blog post schema generator
function generateArticleSchema({
  title,
  description,
  url,
  datePublished,
  dateModified,
  authorName,
  imageUrl,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  imageUrl: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: datePublished,
    dateModified: dateModified,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'SoterAI',
      url: 'https://soterai.in',
      logo: {
        '@type': 'ImageObject',
        url: 'https://soterai.in/logo.png',
      },
    },
    image: imageUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}

// Usage:
// generateArticleSchema({
//   title: 'Why Your AI Coding Assistant Is Leaking Your Secrets',
//   description: 'Real examples of secrets that end up in AI context windows...',
//   url: 'https://soterai.in/blog/ai-leaking-secrets',
//   datePublished: '2026-07-07',
//   dateModified: '2026-07-07',
//   authorName: 'SoterAI Team',
//   imageUrl: 'https://soterai.in/blog/ai-leaking-secrets/og.png',
// });
```

---

### 9. Image Optimization Audit

**Check:** Search for raw `<img>` tags that should be `next/image`.

```bash
# Run this to find all <img> tags in the app directory
grep -rn '<img' app/ components/ --include="*.tsx" --include="*.jsx"
```

**Replacement pattern:**
```tsx
// BEFORE (bad for CWV)
<img src="/feature-screenshot.png" alt="Feature" />

// AFTER (good for CWV)
import Image from 'next/image';
<Image
  src="/feature-screenshot.png"
  alt="Feature screenshot showing AI Safe Mode"
  width={800}
  height={450}
  loading="lazy" // Default for non-priority images
/>
```

---

### 10. 404 Page Verification

**Check:** Does `app/not-found.tsx` exist?

```tsx
// app/not-found.tsx (create if missing)
import Link from 'next/link';

export const metadata = {
  title: '404 — Page Not Found | SoterAI',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: true }, // Don't index 404, but follow links
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-8">This page does not exist.</p>
      <div className="flex gap-4">
        <Link href="/" className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700">
          Go Home
        </Link>
        <Link href="/docs" className="px-6 py-3 border border-gray-600 rounded-lg hover:border-gray-400">
          Read Docs
        </Link>
      </div>
    </main>
  );
}
```

---

### 11. RSS Feed (For Blog)

```tsx
// app/blog/feed.xml/route.ts (create when blog launches)
import { NextResponse } from 'next/server';

// Type for blog posts - replace with actual data source
interface BlogPost {
  title: string;
  slug: string;
  description: string;
  date: string;
  author: string;
}

export async function GET() {
  const baseUrl = 'https://soterai.in';

  // Replace with actual blog post data source
  const posts: BlogPost[] = [
    // Fetch from CMS, MDX files, or database
  ];

  const rssItems = posts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${baseUrl}/blog/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${post.slug}</guid>
      <description><![CDATA[${post.description}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <author>${post.author}</author>
    </item>`
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SoterAI Blog — AI Security for Developers</title>
    <link>${baseUrl}/blog</link>
    <description>Technical articles on AI coding security, prompt injection, MCP security, and developer privacy.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
```

**Add RSS discovery link to layout:**
```tsx
// In app/layout.tsx metadata
export const metadata: Metadata = {
  // ... existing metadata
  alternates: {
    types: {
      'application/rss+xml': 'https://soterai.in/blog/feed.xml',
    },
  },
};
```

---

### 12. Docs Internal Search

**Implementation options (ranked by complexity):**

**Option A: Client-side search with Pagefind (recommended for static docs)**
```bash
# Build-time indexing
npx pagefind --site .next --output-path public/_pagefind
```

**Option B: Algolia DocSearch (free for open-source)**
- Apply at docsearch.algolia.com
- Provides instant search UI component
- Crawls the site automatically
- Free for qualifying open-source/documentation sites

**Option C: Custom Fuse.js search (simple, no external dependencies)**
```tsx
// lib/docs-search.ts
import Fuse from 'fuse.js';

const docsIndex = [
  { title: 'Quick Start', path: '/docs/quickstart', content: '...' },
  { title: 'Local AI Broker', path: '/docs/tutorials/local-ai-broker', content: '...' },
  // ... all docs
];

const fuse = new Fuse(docsIndex, {
  keys: ['title', 'content'],
  threshold: 0.3,
});

export function searchDocs(query: string) {
  return fuse.search(query).map((result) => result.item);
}
```

---

### 13. Redirect Audit

**Check for these common redirect needs:**

| Pattern | Redirect | Status Code |
|---------|----------|-------------|
| `/docs/getting-started` -> `/docs/quickstart` | Implement if old URL existed | 301 |
| Trailing slash normalization | Next.js handles by default | -- |
| `/blog` -> `/blog/` (or vice versa) | Configure in next.config.js | 301 |
| Old comparison URLs | Redirect to new format if changed | 301 |

```js
// next.config.js
module.exports = {
  async redirects() {
    return [
      // Add redirects as URLs change
      // {
      //   source: '/old-path',
      //   destination: '/new-path',
      //   permanent: true, // 301
      // },
    ];
  },
};
```

---

## Implementation Priority Checklist

### P0 -- Before content launch (Week 1)
- [ ] Verify canonical tags on top 10 pages
- [ ] Add unique metadata (title + description) to all pages
- [ ] Create default OpenGraph image (`app/opengraph-image.tsx`)
- [ ] Add Twitter card metadata to root layout
- [ ] Verify 404 page exists and is useful
- [ ] Verify all images use `next/image`

### P1 -- Week 2
- [ ] Create page-specific OG images for pricing, docs, comparison
- [ ] Add Product JSON-LD to pricing page
- [ ] Add FAQPage JSON-LD to pricing and relevant pages
- [ ] Add BreadcrumbList JSON-LD to docs and comparison pages
- [ ] Set up Google Search Console and submit sitemap

### P2 -- Week 3-4
- [ ] Add Article JSON-LD template for blog posts
- [ ] Implement RSS feed (when blog launches)
- [ ] Audit and configure redirects
- [ ] Implement docs search (Pagefind or Algolia)
- [ ] Add `changeFrequency` and `priority` to sitemap entries

### P3 -- Month 2+
- [ ] Set up automated Lighthouse CI checks
- [ ] Implement hreflang tags if multi-language support is planned
- [ ] Add structured data testing to CI pipeline
- [ ] Monitor Google Search Console for crawl errors and coverage issues

---

## Validation Tools

| Tool | Purpose | URL |
|------|---------|-----|
| Google Rich Results Test | Validate JSON-LD structured data | search.google.com/test/rich-results |
| Schema.org Validator | Validate schema markup | validator.schema.org |
| Google Search Console | Monitor indexing, coverage, CWV | search.google.com/search-console |
| Ahrefs Site Audit | Technical SEO audit | ahrefs.com/site-audit |
| Screaming Frog | Crawl site for technical issues | screamingfrog.co.uk |
| Chrome DevTools | Lighthouse audit, CWV measurement | Built into Chrome |
| OpenGraph Debugger | Test OG images and metadata | opengraph.xyz |
| Twitter Card Validator | Test Twitter card rendering | cards-dev.twitter.com/validator |

---

*Document version: 1.0 -- Created 2026-07-06*
