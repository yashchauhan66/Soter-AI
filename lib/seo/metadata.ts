/**
 * Reusable per-page metadata + structured-data helpers.
 *
 * The root layout (`app/layout.tsx`) sets the site-wide defaults: metadataBase,
 * title template, default OpenGraph/Twitter images, robots, icons, etc. These
 * helpers layer *page-specific* metadata on top so every important route carries
 * a unique title, description, canonical URL, and OG/Twitter card without
 * repeating boilerplate in each file.
 *
 * Use `buildMetadata()` in a page's `export const metadata`, and the *Ld helpers
 * to emit page-scoped JSON-LD (SoftwareApplication, FAQPage, Article, …) that
 * references the canonical Organization/WebSite nodes from `schema.ts`.
 */
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, ORGANIZATION_ID } from "@/lib/seo/schema";

/** Default social share image (1200×630). Overridable per page. */
export const DEFAULT_OG_IMAGE = "/og/soterai-og.png";

/**
 * Trim a description to a SERP-safe length without cutting mid-word.
 *
 * Google truncates around 155–160 characters, so anything longer is spent
 * rendering an ellipsis rather than a reason to click. Use this when the source
 * text is authored for the page body (e.g. a service's longDescription) and is
 * reused as the meta description.
 */
export function clampDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Strip trailing punctuation so we don't produce "… ,…" or "word.…".
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!-]+$/, "")}…`;
}

export interface PageMetaInput {
  /**
   * Page <title>. The root layout appends " | SoterAI" via its template, unless
   * the title already names the brand — then it is emitted as-is.
   */
  title: string;
  /** Meta description (aim for 150–160 chars). */
  description: string;
  /** Site-relative path, e.g. "/mcp-security". Used for canonical + OG url. */
  path: string;
  /** Optional OG/Twitter image path (defaults to the brand share image). */
  ogImage?: string;
  /** Set true for legal/utility pages that should not be indexed. */
  noindex?: boolean;
  /** Optional keyword hints (marketing/topic pages). */
  keywords?: string[];
  /**
   * Set true for blog posts and case studies.
   * Emits OG type:"article", publishedTime, and twitter:creator so
   * social shares and rich results treat the page as editorial content.
   */
  isArticle?: boolean;
  /** ISO date string, e.g. "2026-07-06". Used when isArticle is true. */
  datePublished?: string;
}

/**
 * Build a complete Next.js `Metadata` object for a page: unique title,
 * description, canonical URL, and matching OpenGraph + Twitter cards.
 * Pass `isArticle: true` and `datePublished` for blog posts to emit the
 * correct OG type and publication timestamp.
 */
export function buildMetadata({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  keywords,
  isArticle = false,
  datePublished,
}: PageMetaInput): Metadata {
  const url = path.startsWith("http") ? path : `${SITE_URL}${path}`;
  const images = [{ url: ogImage, width: 1200, height: 630, alt: title }];

  // The root layout's title template appends " | SoterAI" to every plain-string
  // title. When the title already names the brand — "SoterAI vs Lakera",
  // "About SoterAI" — that renders it twice and wastes SERP pixel budget, so
  // mark it absolute to opt out of the template. There is no case where showing
  // the brand twice in one title is preferable.
  const titleMeta: Metadata["title"] = title.includes(SITE_NAME)
    ? { absolute: title }
    : title;

  return {
    title: titleMeta,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: isArticle ? "article" : "website",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images,
      // Emit publication timestamp for article-type pages so social platforms
      // and search engines recognise the content as editorial with a date.
      ...(isArticle && datePublished ? { publishedTime: datePublished } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: "@soterai",
      // twitter:creator signals editorial authorship for article-type pages.
      ...(isArticle ? { creator: "@soterai" } : {}),
    },
  };
}

/**
 * SoftwareApplication JSON-LD for a product/feature page. Ties back to the
 * canonical Organization node so search engines resolve publisher identity.
 */
export function softwareApplicationLd(opts: {
  name: string;
  description: string;
  path: string;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    applicationCategory: opts.category ?? "SecurityApplication",
    operatingSystem: "Windows, macOS, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** FAQPage JSON-LD from a list of Q&A pairs. */
export function faqPageLd(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Article JSON-LD for blog posts. */
export function articleLd(opts: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${opts.path}` },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    image: opts.image ? `${SITE_URL}${opts.image}` : `${SITE_URL}${DEFAULT_OG_IMAGE}`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@id": ORGANIZATION_ID },
  };
}
