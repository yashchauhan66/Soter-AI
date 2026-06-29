import type { MetadataRoute } from "next";
import { SERVICES } from "@/lib/docs/services";
import { SITE_URL } from "@/lib/seo/schema";

const siteUrl = SITE_URL;

/**
 * Baseline "last modified" for evergreen pages.
 *
 * Previously every entry used `new Date()`, which reported the crawl time —
 * telling search engines that *every* page changed on *every* crawl. That makes
 * the lastModified signal worthless (and can suppress recrawl of genuinely
 * updated pages). Instead we stamp a stable date here and override per-page for
 * content that actually changes often. Bump this when the site is meaningfully
 * updated.
 */
const SITE_LAST_MODIFIED = "2026-06-29";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

interface Entry {
  url: string;
  priority: number;
  changeFrequency: ChangeFrequency;
  /** ISO date; falls back to SITE_LAST_MODIFIED when omitted. */
  lastModified?: string;
}

const marketingPages: Entry[] = [
  { url: "/", priority: 1.0, changeFrequency: "weekly" },
  { url: "/scanner", priority: 0.8, changeFrequency: "weekly" },
  { url: "/benchmarks", priority: 0.9, changeFrequency: "weekly" },
  { url: "/comparison", priority: 0.9, changeFrequency: "weekly" },
  { url: "/pricing", priority: 0.8, changeFrequency: "weekly" },
  { url: "/playground", priority: 0.7, changeFrequency: "monthly" },
  { url: "/case-studies", priority: 0.7, changeFrequency: "monthly" },
  { url: "/case-studies/prompt-injection-leaks-database", priority: 0.6, changeFrequency: "monthly" },
  { url: "/changelog", priority: 0.6, changeFrequency: "weekly" },
  { url: "/enterprise", priority: 0.8, changeFrequency: "monthly" },
  { url: "/enterprise/pilot", priority: 0.7, changeFrequency: "monthly" },
  { url: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { url: "/contact-sales", priority: 0.6, changeFrequency: "monthly" },
  { url: "/support", priority: 0.5, changeFrequency: "monthly" },
  { url: "/demo", priority: 0.7, changeFrequency: "monthly" },
  { url: "/demo-chatbot", priority: 0.6, changeFrequency: "monthly" },
  { url: "/demo/rag", priority: 0.5, changeFrequency: "monthly" },
  { url: "/demo/red-team", priority: 0.5, changeFrequency: "monthly" },
  { url: "/partners/agency", priority: 0.6, changeFrequency: "monthly" },
];

const compliancePages: Entry[] = [
  { url: "/compliance/owasp-llm-top-10", priority: 0.7, changeFrequency: "monthly" },
  { url: "/compliance/iso27001-readiness", priority: 0.6, changeFrequency: "monthly" },
  { url: "/compliance/soc2-readiness", priority: 0.6, changeFrequency: "monthly" },
];

const legalPages: Entry[] = [
  { url: "/trust", priority: 0.6, changeFrequency: "monthly" },
  { url: "/security", priority: 0.6, changeFrequency: "monthly" },
  { url: "/responsible-disclosure", priority: 0.4, changeFrequency: "yearly" },
  { url: "/privacy", priority: 0.5, changeFrequency: "yearly" },
  { url: "/terms", priority: 0.5, changeFrequency: "yearly" },
  { url: "/data-retention", priority: 0.4, changeFrequency: "yearly" },
  { url: "/subprocessors", priority: 0.4, changeFrequency: "yearly" },
  { url: "/status", priority: 0.5, changeFrequency: "daily" },
];

const docsPages: Entry[] = [
  { url: "/docs", priority: 0.9, changeFrequency: "weekly" },
  { url: "/docs/quickstart", priority: 0.8, changeFrequency: "weekly" },
  { url: "/docs/services", priority: 0.8, changeFrequency: "weekly" },
  { url: "/docs/js", priority: 0.7, changeFrequency: "monthly" },
  { url: "/docs/python", priority: 0.7, changeFrequency: "monthly" },
  { url: "/docs/nextjs", priority: 0.7, changeFrequency: "monthly" },
  { url: "/docs/rest-api", priority: 0.7, changeFrequency: "monthly" },
  { url: "/docs/rag", priority: 0.7, changeFrequency: "monthly" },
  { url: "/docs/fastapi", priority: 0.6, changeFrequency: "monthly" },
  { url: "/docs/express", priority: 0.6, changeFrequency: "monthly" },
  { url: "/docs/generic-chatbot", priority: 0.6, changeFrequency: "monthly" },
  { url: "/docs/botpress", priority: 0.5, changeFrequency: "monthly" },
  { url: "/docs/intercom", priority: 0.5, changeFrequency: "monthly" },
  { url: "/docs/zendesk", priority: 0.5, changeFrequency: "monthly" },
  { url: "/docs/whatsapp", priority: 0.5, changeFrequency: "monthly" },
  { url: "/docs/wordpress", priority: 0.5, changeFrequency: "monthly" },
  { url: "/docs/cli", priority: 0.4, changeFrequency: "monthly" },
  { url: "/docs/best-practices", priority: 0.6, changeFrequency: "monthly" },
  { url: "/docs/api-contract", priority: 0.6, changeFrequency: "monthly" },
];

// Per-service documentation pages, derived from the catalog so the sitemap
// never drifts from the actual /docs/services/[id] routes.
const servicePages: Entry[] = SERVICES.map((service) => ({
  url: `/docs/services/${service.id}`,
  priority: 0.5,
  changeFrequency: "monthly" as const,
}));

export default function sitemap(): MetadataRoute.Sitemap {
  const allPages: Entry[] = [
    ...marketingPages,
    ...compliancePages,
    ...legalPages,
    ...docsPages,
    ...servicePages,
  ];

  return allPages.map((page) => ({
    url: `${siteUrl}${page.url}`,
    lastModified: page.lastModified ?? SITE_LAST_MODIFIED,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
