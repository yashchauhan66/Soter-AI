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
import { SITE_URL, SITE_NAME, ORGANIZATION_ID, FOUNDER_ID } from "@/lib/seo/schema";
import { ogCardUrl } from "@/lib/og/cards";

/** True when a title already names the brand in the current or the earlier spelling. */
const BRAND_IN_TITLE = /soterai/i;

/** Default social share image (1200×630). Overridable per page. */
export const DEFAULT_OG_IMAGE = "/og-card/default.png";

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
  const cut = clean.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(" ");
  // Strip trailing punctuation so we don't produce "… ,…" or "word.…".
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!-]+$/, "")}…`;
}

export interface PageMetaInput {
  /**
   * Page <title>. The root layout appends the current display brand via its
   * template, unless the title already names the brand, in which case it is
   * emitted as-is. Keep the complete rendered title within 60 characters.
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
  /**
   * Optional share-card headline for Open Graph and Twitter, when it should read
   * differently from the search title. Defaults to `title`.
   */
  ogTitle?: string;
  /** Optional share-card description. Defaults to `description`. */
  ogDescription?: string;
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
  // Each known page has its own share card (lib/og/cards.ts). Others get the default card.
  ogImage = ogCardUrl(path),
  noindex = false,
  keywords,
  isArticle = false,
  datePublished,
  ogTitle,
  ogDescription,
}: PageMetaInput): Metadata {
  const url = path.startsWith("http") ? path : `${SITE_URL}${path}`;
  const cardTitle = ogTitle ?? title;
  const cardDescription = ogDescription ?? description;
  const images = [{ url: ogImage, width: 1200, height: 630, alt: cardTitle }];

  // The root layout's title template appends the current display brand to every plain-string
  // title. When the title already names the brand, in either spelling
  // ("SoterAI" or the domain "soterai.in"), the
  // suffix would show the brand twice and waste SERP pixel budget, so mark the
  // title absolute to opt out of the template.
  const titleMeta: Metadata["title"] = BRAND_IN_TITLE.test(title)
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
      title: cardTitle,
      description: cardDescription,
      images,
      // Emit publication timestamp for article-type pages so social platforms
      // and search engines recognise the content as editorial with a date.
      ...(isArticle && datePublished ? { publishedTime: datePublished } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: cardTitle,
      description: cardDescription,
      images: [ogImage],
      // No twitter:site or twitter:creator. There is no verified @soterai account on X
      // (twitter.com/soterai returned 404 on 2026-09-08), and pointing the tag at a handle
      // someone else may own would credit them with our pages.
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
  operatingSystem?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    applicationCategory: opts.category ?? "SecurityApplication",
    operatingSystem: opts.operatingSystem ?? "Windows, macOS, Linux",
    offers: {
      "@type": "Offer",
      // The Free plan. Paid plans are billed in INR only, so INR is the one
      // currency this site can honestly state (see lib/billing/razorpay.ts).
      price: "0",
      priceCurrency: "INR",
      url: `${SITE_URL}/pricing`,
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
    // BlogPosting is the schema.org subtype of Article for blog posts and case notes.
    "@type": "BlogPosting",
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${opts.path}` },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    image: opts.image ? `${SITE_URL}${opts.image}` : `${SITE_URL}${DEFAULT_OG_IMAGE}`,
    // A named person, not the organisation: the founder writes and runs the product.
    author: { "@type": "Person", "@id": FOUNDER_ID, name: "Yash Chauhan", url: `${SITE_URL}/about` },
    publisher: { "@id": ORGANIZATION_ID },
  };
}
