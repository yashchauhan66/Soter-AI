# Core Web Vitals — Measured Report (Production)

> **Status:** MEASURED on the live production site. These are real Lighthouse
> lab results against `https://soterai.in`, not predictions. The earlier
> `core-web-vitals-report.md` was a *predicted* analysis; this document supersedes
> it with measured data and is explicit about where measured results miss target.

**Measured:** 2026-07-06
**Target URL:** https://soterai.in (HTTP 200, live)
**Tool:** Lighthouse 12.8.2 (headless Chrome), desktop and mobile presets
**Artifacts:** [`lighthouse/soterai-desktop.report.html`](./lighthouse/soterai-desktop.report.html) · [`lighthouse/soterai-mobile.report.html`](./lighthouse/soterai-mobile.report.html) (+ `.report.json` for each)

---

## Category scores

| Category | Target | Desktop (measured) | Mobile (measured) |
|----------|--------|--------------------|-------------------|
| Performance | > 90 | **96** ✅ | **63** ❌ |
| Accessibility | > 95 | **87** ❌ | **87** ❌ |
| Best Practices | > 95 | **100** ✅ | **100** ✅ |
| SEO | > 95 | **100** ✅ | **100** ✅ |

## Core Web Vitals & lab metrics

| Metric | Target | Desktop | Mobile |
|--------|--------|---------|--------|
| LCP (Largest Contentful Paint) | < 2.5 s | **1.1 s** ✅ | **4.9 s** ❌ |
| CLS (Cumulative Layout Shift) | < 0.1 | **0** ✅ | **0** ✅ |
| TBT (Total Blocking Time)¹ | < 200 ms | **40 ms** ✅ | **540 ms** ❌ |
| FCP (First Contentful Paint) | — | 0.8 s | 2.8 s |
| Speed Index | — | 1.5 s | 3.5 s |
| TTFB (server response) | low | ~140 ms | ~130 ms |
| Total transferred | < ~500 KB | — | 621 KiB |

¹ **INP** (Interaction to Next Paint) is a *field* metric and is not produced by
Lighthouse lab runs. TBT is the lab proxy shown here. Real INP requires field
data (e.g. CrUX / PageSpeed Insights field panel or RUM), which needs sustained
traffic and is noted as a follow-up below.

---

## Honest interpretation

- **Desktop is strong and passes every target**: Performance 96, LCP 1.1 s, CLS 0,
  TBT 40 ms, SEO 100, Best Practices 100.
- **Mobile Performance does not meet target (63 vs > 90).** The driver is
  render/JS cost on the throttled mobile preset: LCP 4.9 s (target < 2.5 s) and
  TBT 540 ms. CLS remains perfect (0). This is the single most important measured
  gap and is **not** hidden or rounded up.
- **Accessibility is 87 on both presets (target > 95).** Three weighted audits
  fail (see below). These are real, fixable issues.
- **SEO 100 / Best Practices 100 on both presets** — the per-page metadata,
  canonical URLs, sitemap, robots, and structured-data work is validated by the
  measured SEO score.

## Accessibility — failing audits (both presets)

| Audit | Meaning | Suggested fix |
|-------|---------|---------------|
| `button-name` | One or more buttons have no accessible name | Add `aria-label` to icon-only buttons |
| `color-contrast` | Some text/background pairs are below WCAG AA | Raise contrast on low-emphasis slate text on dark backgrounds |
| `target-size` | Some tap targets are smaller/closer than 24–48 px | Increase hit area / spacing on small mobile controls |

These are pre-existing, site-wide theme/markup issues, independent of the new SEO
and landing-page work added in this pass. They are the recommended next
accessibility fix set.

## Mobile performance — recommended fixes (measured-driven)

1. Reduce main-thread JS on first load (TBT 540 ms) — audit `use client`
   boundaries on the homepage and defer non-critical client components.
2. Improve mobile LCP (4.9 s) — confirm the LCP element (hero) is server-rendered
   text/image with `priority`, and trim above-the-fold hydration.
3. Trim transfer weight (621 KiB) — lazy-load below-the-fold sections; keep
   Google Analytics `afterInteractive`.
4. Re-measure after each change with `npx lighthouse https://soterai.in` (mobile
   preset) to confirm movement.

## Targets vs measured — summary

| Requirement | Result |
|-------------|--------|
| CWV **measured** on deployed production | ✅ Done (this report) |
| LCP < 2.5 s | ✅ Desktop · ❌ Mobile (4.9 s) |
| CLS < 0.1 | ✅ Both (0) |
| INP good | ⚠️ Not lab-measurable; needs field data |
| Lighthouse Performance > 90 | ✅ Desktop (96) · ❌ Mobile (63) |
| SEO > 95 | ✅ Both (100) |
| Accessibility > 95 | ❌ Both (87) |
| Best Practices > 95 | ✅ Both (100) |

## Reproduce

```bash
export CHROME_PATH="<path-to-chrome>"
# Desktop
npx lighthouse@12 https://soterai.in --preset=desktop \
  --output=json --output=html --output-path=docs/seo/lighthouse/soterai-desktop
# Mobile (default preset)
npx lighthouse@12 https://soterai.in \
  --output=json --output=html --output-path=docs/seo/lighthouse/soterai-mobile
```

## Follow-ups

- Capture **field** CWV (including real INP) via PageSpeed Insights field panel /
  CrUX once traffic is sufficient (~28-day window).
- Fix the three accessibility audits to lift Accessibility ≥ 95.
- Land the mobile performance fixes above and re-measure.
