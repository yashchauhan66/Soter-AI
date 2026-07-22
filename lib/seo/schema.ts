/**
 * Centralized SEO / structured-data helpers.
 *
 * The Organization and WebSite nodes are the canonical entity definitions for
 * the whole site. They are injected once, site-wide, from the root layout so
 * every public page carries entity coverage (previously only the homepage did).
 * Page-specific graphs (SoftwareApplication, FAQPage, BreadcrumbList, and more) can
 * reference these via their stable @id values.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";
export const SITE_NAME = "SoterAI";

export const ORGANIZATION_ID = `${SITE_URL}#organization`;
export const WEBSITE_ID = `${SITE_URL}#website`;

const ORG_SAME_AS = [
  "https://github.com/yashchauhan66/Ai-Security-Guard",
  "https://twitter.com/soterai",
];

/** Canonical Organization node. Referenced by other graphs via ORGANIZATION_ID. */
export const organizationNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/icon-512.png`,
    width: 512,
    height: 512,
  },
  image: `${SITE_URL}/opengraph-image.png`,
  description:
    "SoterAI is an AI security command layer for chatbots, RAG apps, and autonomous agents, protecting teams from prompt injection, data leakage, unsafe outputs, and agent abuse.",
  foundingDate: "2024",
  email: "support@soterai.in",
  sameAs: ORG_SAME_AS,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "support@soterai.in",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "IN",
  },
} as const;

/** Canonical WebSite node. */
export const websiteNode = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: `${SITE_NAME} - AI Security Command Layer`,
  description:
    "AI security guardrail platform protecting against prompt injection, jailbreaks, PII leakage, and unsafe outputs.",
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en",
} as const;

/** LocalBusiness node for India presence - boosts local SEO for Indian searches. */
export const localBusinessNode = {
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}#localbusiness`,
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "India-focused AI security platform with Aadhaar, PAN, GSTIN, and UPI PII detection for Indian enterprises and startups.",
  telephone: "",
  email: "support@soterai.in",
  address: {
    "@type": "PostalAddress",
    addressCountry: "IN",
    addressLocality: "India",
  },
  priceRange: "INR 0 - INR 9,999",
  sameAs: ORG_SAME_AS,
  knowsLanguage: ["en", "hi"],
  areaServed: [
    { "@type": "Country", name: "IN" },
    { "@type": "Country", name: "US" },
    { "@type": "Country", name: "GB" },
  ],
} as const;

/**
 * The site-wide structured-data graph injected from the root layout.
 * Kept intentionally small; page graphs add the page-specific entities.
 */
export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [organizationNode, websiteNode, localBusinessNode],
} as const;

/**
 * Build a BreadcrumbList node from an ordered list of crumbs.
 * Use on inner pages to earn breadcrumb rich results.
 */
export function breadcrumbList(
  crumbs: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}
