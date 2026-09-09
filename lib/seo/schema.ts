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

/**
 * `sameAs` profiles for the Organization node.
 *
 * These are the off-site URLs search engines and AI answer engines use to
 * reconcile "SoterAI" into a single entity. Every URL here MUST resolve — a
 * 404 in `sameAs` weakens entity consolidation instead of strengthening it, so
 * only list distribution channels that are actually published.
 *
 * Kept in sync with `packages/sdk/package.json#name` ("@soterai/core") and
 * `packages/python-sdk/pyproject.toml#name` ("soter"). The source repository is
 * private, so it is deliberately absent.
 */
const ORG_SAME_AS = [
  // Open VSX — the IDE Guard extension is published here (see README SDK table)
  "https://open-vsx.org/extension/soterai/soterai-ide-guard",
  // VS Code Marketplace — entity-confirms the IDE Guard product
  "https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard",
  // npm — the published JS SDK is @soterai/core (NOT @soterai/sdk)
  "https://www.npmjs.com/package/@soterai/core",
  // PyPI — the published Python SDK
  "https://pypi.org/project/soter/",
  // n8n community node — automation-ecosystem entity signal
  "https://www.npmjs.com/package/n8n-nodes-soterai",
  // NOTE: the GitHub repository is intentionally NOT listed. It went private on
  // 2026-09-04, so the URL now 404s for crawlers — which per the rule above
  // would weaken entity consolidation rather than strengthen it.
  //
  // NOTE: twitter.com/soterai is also absent — verified 404 on 2026-09-08 (both
  // twitter.com and x.com; a known-good handle returned 200 in the same run, so
  // this is a missing account, not bot-blocking). Re-add once the handle exists.
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

/**
 * The site-wide structured-data graph injected from the root layout.
 * Kept intentionally small; page graphs add the page-specific entities.
 */
export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [organizationNode, websiteNode],
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
