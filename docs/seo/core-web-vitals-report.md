# Phase 12 -- Core Web Vitals Predicted Analysis

> **Goal:** Predict Core Web Vitals performance for the SoterAI Next.js 15 website based on its architecture, and provide optimization recommendations to achieve target scores.

> **Note:** This is a predicted analysis based on the codebase architecture. Actual Lighthouse scores require a deployed URL. Run `npx lighthouse https://soterai.in --output html --output-path ./lighthouse-report.html` against the production deployment to validate these predictions.

---

## Architecture Summary

| Aspect | Implementation | CWV Impact |
|--------|---------------|------------|
| Framework | Next.js 15 (App Router) | Positive -- SSR/SSG, automatic code splitting |
| Rendering | Server-Side Rendering (SSR) | Positive -- fast FCP and LCP |
| Fonts | Self-hosted via `next/font/local` | Positive -- no Google Fonts network requests, no FOIT |
| Styling | Tailwind CSS | Positive -- purged CSS, small bundle |
| Images | Mixed (needs audit for `next/image` usage) | Variable |
| Analytics | Google Analytics (gtag) | Minor negative -- third-party script |
| Deployment | Vercel (assumed) | Positive -- edge CDN, automatic optimization |

---

## Core Web Vitals Predictions

### LCP (Largest Contentful Paint)

**Target:** < 2.5 seconds  
**Prediction:** LIKELY PASS (1.5-2.2s estimated)

**Positive factors:**
- SSR delivers fully rendered HTML on first response
- Self-hosted fonts via `next/font/local` eliminate font-loading network round trips
- Tailwind CSS is inlined/purged, so no large CSS downloads block rendering
- Next.js automatic code splitting keeps initial JS payload small
- No heavy above-the-fold images detected in the futuristic console-style hero

**Risk factors:**
- The hero section uses animated elements (console typing effect, gradient backgrounds) -- if these are client-side JS-rendered, LCP may be delayed until hydration completes
- If the LCP element is a large image or SVG animation, it needs priority loading
- Server response time depends on hosting tier and SSR complexity

**Recommendations:**
1. Identify the LCP element on each key page (likely the hero heading or console container)
2. If the LCP element is an image, add `priority` prop to the `next/image` component
3. If the LCP element is text, ensure the font is preloaded (next/font/local handles this automatically)
4. Add `fetchPriority="high"` to above-the-fold images
5. Minimize server-side data fetching in the root layout (move non-critical fetches to child routes)

```tsx
// Example: Prioritize hero image if used
import Image from 'next/image';

<Image
  src="/hero-banner.webp"
  alt="SoterAI — Local AI Security"
  width={1280}
  height={640}
  priority // Preloads this image, improving LCP
  fetchPriority="high"
/>
```

---

### INP (Interaction to Next Paint)

**Target:** < 200ms (good), < 500ms (needs improvement)  
**Prediction:** LIKELY PASS (estimated < 150ms)

**Positive factors:**
- Marketing/docs site with minimal interactive elements
- Tailwind CSS does not use heavy JS-based styling
- Next.js App Router streams HTML, reducing hydration blocking
- No heavy client-side state management detected (no Redux, no Zustand on marketing pages)

**Risk factors:**
- The `/playground` and `/demo` pages likely have complex interactive elements
- Dashboard pages (if server-rendered with client interactivity) may have hydration delays
- Animated gradient backgrounds or particle effects can cause jank during interaction

**Recommendations:**
1. Audit all `onClick`, `onChange`, and `onSubmit` handlers for expensive synchronous operations
2. Use `React.startTransition` for non-urgent state updates
3. Debounce search inputs (docs search, if implemented)
4. Avoid `useEffect` chains that trigger cascading re-renders
5. Profile the demo/playground pages specifically -- these are the most interaction-heavy

```tsx
// Example: Use startTransition for non-urgent updates
import { startTransition } from 'react';

function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (value: string) => {
    setQuery(value); // Urgent: update input immediately
    startTransition(() => {
      setResults(search(value)); // Non-urgent: can be deferred
    });
  };

  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

---

### CLS (Cumulative Layout Shift)

**Target:** < 0.1  
**Prediction:** LIKELY PASS (estimated < 0.05)

**Positive factors:**
- Tailwind CSS utilities define explicit dimensions (no content-dependent sizing)
- Self-hosted fonts with `next/font/local` include `font-display: swap` with size-adjust, minimizing FOUT layout shift
- Next.js `<Image>` component reserves space automatically (prevents image-load shifts)
- No visible third-party ad or embed injections

**Risk factors:**
- Dynamically loaded content (e.g., pricing tables, comparison data) could shift layout if not server-rendered
- Toast notifications or banners that push content down
- Cookie consent banners (if any) that are not overlay-positioned
- Lazy-loaded sections that change height on load

**Recommendations:**
1. Ensure all images use `next/image` with explicit `width` and `height` props
2. Reserve space for dynamically loaded content using skeleton loaders or `min-height`
3. Position toast notifications as fixed/absolute overlays, never in document flow
4. If using a cookie consent banner, position it as a fixed bottom overlay
5. Avoid inserting content above the fold after initial render

```tsx
// Example: Reserve space for dynamic content
function PricingSection() {
  return (
    <div style={{ minHeight: '600px' }}> {/* Reserve space */}
      <Suspense fallback={<PricingSkeleton />}>
        <PricingTable />
      </Suspense>
    </div>
  );
}
```

---

## Lighthouse Score Predictions

### Performance: Target 90+ (Predicted: 85-95)

| Factor | Impact | Status |
|--------|--------|--------|
| First Contentful Paint | High | GOOD -- SSR delivers HTML fast |
| Largest Contentful Paint | High | GOOD -- self-hosted fonts, SSR |
| Total Blocking Time | Medium | NEEDS AUDIT -- depends on JS bundle size |
| Cumulative Layout Shift | Medium | GOOD -- Tailwind + next/image |
| Speed Index | Medium | GOOD -- SSR renders above-fold content quickly |

**JS Bundle Size Audit:**
```bash
# Run this against the production build
ANALYZE=true npx next build
# or
npx @next/bundle-analyzer
```

Key areas to check:
- Are any heavy libraries (moment.js, lodash full, chart libraries) in the client bundle?
- Are dashboard-only libraries being loaded on marketing pages?
- Is the Prisma client accidentally being bundled into client-side code?
- Are all `'use client'` boundaries placed as low as possible in the component tree?

**Estimated bundle breakdown (marketing pages):**
| Chunk | Expected Size | Target |
|-------|-------------|--------|
| Next.js runtime | ~80KB gzipped | Acceptable |
| React runtime | ~40KB gzipped | Acceptable |
| Tailwind CSS | ~10-15KB gzipped (purged) | Good |
| App code (marketing) | ~20-40KB gzipped | Good if optimized |
| Google Analytics | ~30KB | Consider lazy loading |
| Total | ~180-210KB gzipped | Target: < 200KB |

---

### Accessibility: Target 95+ (Predicted: 85-92)

| Check | Expected Status | Action |
|-------|----------------|--------|
| Color contrast | NEEDS AUDIT -- futuristic dark theme may have low-contrast text | Verify all text meets WCAG AA (4.5:1 for normal, 3:1 for large) |
| Alt text on images | NEEDS AUDIT | Add descriptive alt text to all images |
| Heading hierarchy | LIKELY GOOD -- standard page structure | Verify no skipped heading levels |
| Keyboard navigation | NEEDS AUDIT | Test all interactive elements with Tab/Enter |
| ARIA labels | NEEDS AUDIT | Add labels to icon-only buttons, form inputs |
| Focus indicators | NEEDS AUDIT -- custom focus styles may override defaults | Ensure visible focus rings on all interactive elements |
| Skip navigation | LIKELY MISSING | Add "Skip to main content" link |
| Language attribute | LIKELY SET | Verify `<html lang="en">` in root layout |

**Priority accessibility fixes:**
```tsx
// 1. Add skip navigation link
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded">
  Skip to main content
</a>

// 2. Ensure focus visibility
// In tailwind.config.js or global CSS:
// *:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

// 3. Add aria-labels to icon buttons
<button aria-label="Toggle AI Safe Mode">
  <ShieldIcon />
</button>
```

---

### Best Practices: Target 95+ (Predicted: 90-95)

| Check | Expected Status | Notes |
|-------|----------------|-------|
| HTTPS | PASS | Vercel/standard hosting provides HTTPS |
| No mixed content | LIKELY PASS | Verify all resources load over HTTPS |
| No vulnerable libraries | NEEDS AUDIT | Run `npm audit` regularly |
| CSP headers | NEEDS IMPLEMENTATION | Add Content Security Policy |
| HSTS | DEPENDS ON HOSTING | Configure in Vercel/hosting headers |
| No console errors | NEEDS VERIFICATION | Check production build |
| Correct image aspect ratios | NEEDS AUDIT | Verify all images |
| Permissions policy | NEEDS IMPLEMENTATION | Restrict camera, microphone, etc. |

**Recommended security headers (next.config.js or vercel.json):**
```js
// next.config.js
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];
```

---

### SEO: Target 95+ (Predicted: 92-98)

| Check | Expected Status | Notes |
|-------|----------------|-------|
| Meta title | PASS | Set in root layout metadata |
| Meta description | PASS | Set in root layout metadata |
| Canonical URL | NEEDS VERIFICATION | Check per-page canonical tags |
| robots.txt | PASS | Exists at app/robots.ts |
| Sitemap | PASS | Exists at app/sitemap.ts |
| Structured data | PARTIAL | Organization + WebSite exist; needs Product, FAQ, Article |
| Mobile-friendly | LIKELY PASS | Tailwind responsive utilities |
| Tap targets | NEEDS AUDIT | Verify minimum 48x48px touch targets |
| Font size | LIKELY PASS | Tailwind default sizes are accessible |
| Viewport meta | PASS | Next.js sets this automatically |

---

## Optimization Recommendations (Priority Order)

### P0: Critical (Do before launch)

1. **Audit JS bundle size**
   - Run `ANALYZE=true next build` and identify oversized chunks
   - Ensure no server-only code (Prisma, DynamoDB clients) leaks into client bundles
   - Move heavy libraries behind dynamic imports

2. **Verify all images use next/image**
   - Search for `<img>` tags and replace with `<Image>` from `next/image`
   - Add explicit width/height to prevent CLS
   - Use WebP/AVIF formats via next/image automatic optimization

3. **Add security headers**
   - CSP, HSTS, X-Frame-Options, Referrer-Policy
   - Critical for a security product's credibility

### P1: Important (Do in Week 1)

4. **Lazy load below-fold content**
   ```tsx
   import dynamic from 'next/dynamic';

   const HeavyFeatureSection = dynamic(() => import('./FeatureSection'), {
     loading: () => <FeatureSkeleton />,
     ssr: true, // Keep SSR for SEO, but lazy-load the JS
   });
   ```

5. **Optimize Google Analytics loading**
   ```tsx
   // Load GA only after page becomes interactive
   <Script
     src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
     strategy="afterInteractive" // Not "beforeInteractive"
   />
   ```

6. **Add preconnect hints for critical origins**
   ```tsx
   // In root layout <head>
   <link rel="preconnect" href="https://www.googletagmanager.com" />
   <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
   ```

### P2: Nice to Have (Do in Month 1)

7. **Implement ISR (Incremental Static Regeneration) for static pages**
   ```tsx
   // For pages that change infrequently (pricing, docs, comparison)
   export const revalidate = 3600; // Revalidate every hour
   ```

8. **Remove heavy animations if performance-impacting**
   - Test the console typing animation on low-end devices
   - Use `prefers-reduced-motion` media query to disable animations for users who prefer it
   ```css
   @media (prefers-reduced-motion: reduce) {
     .animate-typing { animation: none; }
     .animate-gradient { animation: none; }
   }
   ```

9. **Set up caching headers**
   ```js
   // For static assets (fonts, images)
   // Cache-Control: public, max-age=31536000, immutable

   // For HTML pages
   // Cache-Control: public, max-age=0, must-revalidate
   // (Vercel handles this automatically for Next.js)
   ```

10. **CDN optimization**
    - If on Vercel: automatic edge CDN is included
    - If self-hosted: set up CloudFront or Cloudflare in front of the origin
    - Enable Brotli compression (Vercel does this automatically)

### P3: Monitoring (Ongoing)

11. **Set up CWV monitoring**
    - Use `web-vitals` library to report CWV to analytics
    ```tsx
    // app/layout.tsx or a client component
    import { onCLS, onINP, onLCP } from 'web-vitals';

    function reportWebVitals() {
      onCLS(console.log);
      onINP(console.log);
      onLCP(console.log);
    }
    ```

12. **Set up Lighthouse CI**
    ```yaml
    # .github/workflows/lighthouse.yml
    - name: Lighthouse CI
      uses: treosh/lighthouse-ci-action@v12
      with:
        urls: |
          https://soterai.in/
          https://soterai.in/pricing
          https://soterai.in/docs
        budgetPath: ./lighthouse-budget.json
    ```

---

## Validation Checklist

Run these checks against the production deployment:

- [ ] `npx lighthouse https://soterai.in --output html` -- Performance score > 90
- [ ] `npx lighthouse https://soterai.in --output html` -- Accessibility score > 95
- [ ] `npx lighthouse https://soterai.in --output html` -- Best Practices score > 95
- [ ] `npx lighthouse https://soterai.in --output html` -- SEO score > 95
- [ ] Chrome DevTools > Performance tab > Record page load > Verify no long tasks > 100ms
- [ ] Chrome DevTools > Network tab > Verify total transfer size < 500KB (marketing pages)
- [ ] PageSpeed Insights (web.dev/measure) -- verify CWV pass in field data (requires 28 days of traffic)
- [ ] Mobile emulation test (Lighthouse mobile preset) -- verify scores hold on mobile

---

*Document version: 1.0 -- Created 2026-07-06*
