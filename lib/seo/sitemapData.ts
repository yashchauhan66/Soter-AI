import { SERVICES } from "@/lib/docs/services";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { SITE_URL } from "@/lib/seo/schema";

/**
 * Sitemap data, split into segments.
 *
 * /sitemap.xml is an index that lists one child sitemap per segment
 * (/sitemaps/<segment>.xml). Segments let Search Console report indexation per kind of
 * page, so a drop in one area (for example topic pages) is visible on its own.
 *
 * This file replaces app/sitemap.ts, which held one flat list. The URL list is unchanged
 * apart from the segment it sits in.
 *
 * `lastModified` is the date the page's content last changed in a way a reader would
 * notice. It is not the crawl time, which would tell search engines every page changed on
 * every crawl. Pages without their own date use SITE_LAST_MODIFIED. Bump a date only when
 * the page changes.
 */
export const SITE_LAST_MODIFIED = "2026-09-01";

/** Date of the soterai.in redesign. Applies to pages that were rewritten in it. */
const REDESIGN = "2026-11-10";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface Entry {
  url: string;
  priority: number;
  changeFrequency: ChangeFrequency;
  /** ISO date. Falls back to SITE_LAST_MODIFIED when omitted. */
  lastModified?: string;
}

const core: Entry[] = [
  { url: "/", priority: 1.0, changeFrequency: "weekly", lastModified: REDESIGN },
  { url: "/pricing", priority: 0.8, changeFrequency: "weekly", lastModified: REDESIGN },
  { url: "/playground", priority: 0.9, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/scanner", priority: 0.8, changeFrequency: "monthly" },
  { url: "/case-studies", priority: 0.7, changeFrequency: "monthly" },
  { url: "/case-studies/prompt-injection-leaks-database", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-11-11" },
  { url: "/changelog", priority: 0.6, changeFrequency: "weekly" },
  { url: "/enterprise", priority: 0.8, changeFrequency: "monthly" },
  { url: "/enterprise/pilot", priority: 0.7, changeFrequency: "monthly" },
  { url: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { url: "/contact-sales", priority: 0.6, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/support", priority: 0.5, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/demo", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/demo-chatbot", priority: 0.6, changeFrequency: "monthly" },
  { url: "/demo/rag", priority: 0.5, changeFrequency: "monthly" },
  { url: "/demo/red-team", priority: 0.5, changeFrequency: "monthly" },
  { url: "/demo/guided", priority: 0.5, changeFrequency: "monthly" },
  { url: "/partners/agency", priority: 0.6, changeFrequency: "monthly" },
  { url: "/about", priority: 0.6, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/press", priority: 0.5, changeFrequency: "monthly" },
  { url: "/student-discount", priority: 0.6, changeFrequency: "monthly" },
];

/** Topic pages: what the product does, one problem per page. */
const topics: Entry[] = [
  { url: "/ai-agent-security", priority: 0.9, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-user-security", priority: 0.9, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/prompt-injection-protection", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/jailbreak-detection", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-data-leakage-prevention", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/rag-security", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/mcp-security", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/llm-security", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/llm-firewall", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-security-india", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/enterprise-ai-security", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-workflow-security", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-platform-security", priority: 0.8, changeFrequency: "monthly" },
  { url: "/model-supply-chain-security", priority: 0.6, changeFrequency: "monthly" },
  { url: "/vscode-ai-security", priority: 0.9, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/cursor-ai-security", priority: 0.8, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/local-ai-broker", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-safe-mode", priority: 0.6, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/ai-memory-inspector", priority: 0.6, changeFrequency: "monthly", lastModified: REDESIGN },
];

/** Where it runs: workflow guards, extensions, SDK hub. */
const integrations: Entry[] = [
  { url: "/integrations", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/integrations/n8n", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/integrations/zapier", priority: 0.7, changeFrequency: "monthly" },
  { url: "/integrations/make", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/extensions/ide", priority: 0.8, changeFrequency: "monthly" },
  { url: "/extensions/browser", priority: 0.8, changeFrequency: "monthly" },
  { url: "/extensions/browser/chrome", priority: 0.7, changeFrequency: "monthly" },
  { url: "/extensions/browser/edge", priority: 0.7, changeFrequency: "monthly" },
];

/** Evidence and trust: numbers, limits, comparisons, compliance, status. */
const evidence: Entry[] = [
  { url: "/benchmark", priority: 0.9, changeFrequency: "weekly", lastModified: "2026-07-15" },
  { url: "/benchmarks", priority: 0.9, changeFrequency: "weekly", lastModified: REDESIGN },
  { url: "/benchmark/methodology", priority: 0.6, changeFrequency: "monthly" },
  { url: "/limitations", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison", priority: 0.9, changeFrequency: "weekly", lastModified: REDESIGN },
  { url: "/comparison/lakera", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison/prompt-security", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison/hiddenlayer", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison/guardrails-ai", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison/nemo-guardrails", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison/bedrock-guardrails", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/comparison/llm-guard", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/trust", priority: 0.7, changeFrequency: "monthly", lastModified: REDESIGN },
  { url: "/security", priority: 0.6, changeFrequency: "monthly" },
  { url: "/responsible-disclosure", priority: 0.4, changeFrequency: "yearly" },
  { url: "/status", priority: 0.5, changeFrequency: "daily" },
  // The compliance hub is the entry point security reviewers land on.
  { url: "/compliance", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-09-01" },
  { url: "/compliance/owasp-llm-top-10", priority: 0.7, changeFrequency: "monthly" },
  { url: "/compliance/iso27001-readiness", priority: 0.6, changeFrequency: "monthly" },
  { url: "/compliance/soc2-readiness", priority: 0.6, changeFrequency: "monthly" },
];

const legal: Entry[] = [
  { url: "/privacy", priority: 0.5, changeFrequency: "yearly" },
  { url: "/terms", priority: 0.5, changeFrequency: "yearly" },
  { url: "/data-retention", priority: 0.4, changeFrequency: "yearly" },
  { url: "/subprocessors", priority: 0.4, changeFrequency: "yearly" },
];

const docs: Entry[] = [
  { url: "/docs", priority: 0.9, changeFrequency: "weekly" },
  { url: "/docs/quickstart", priority: 0.8, changeFrequency: "weekly", lastModified: REDESIGN },
  { url: "/docs/services", priority: 0.8, changeFrequency: "weekly" },
  { url: "/docs/soterai-lite", priority: 0.7, changeFrequency: "monthly" },
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
  // Per-service pages come from the catalog, so the sitemap never drifts from /docs/services/[id].
  ...SERVICES.map((service) => ({
    url: `/docs/services/${service.id}`,
    priority: 0.5,
    changeFrequency: "monthly" as const,
  })),
];

// Blog: index plus posts, derived from the registry so the sitemap never drifts from /blog/<slug>.
const blog: Entry[] = [
  { url: "/blog", priority: 0.7, changeFrequency: "weekly", lastModified: REDESIGN },
  ...BLOG_POSTS.map((post) => ({
    url: `/blog/${post.slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
    lastModified: post.datePublished,
  })),
];

/** Segment name -> entries. The key is the file name: /sitemaps/<key>.xml. */
export const SITEMAP_SEGMENTS: Record<string, Entry[]> = {
  core,
  topics,
  integrations,
  evidence,
  legal,
  docs,
  blog,
};

export const SEGMENT_NAMES = Object.keys(SITEMAP_SEGMENTS);

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** The newest lastModified in a segment, for the index. */
function newest(entries: Entry[]): string {
  return entries.reduce((max, e) => ((e.lastModified ?? SITE_LAST_MODIFIED) > max ? (e.lastModified ?? SITE_LAST_MODIFIED) : max), "0000-00-00");
}

export function renderSitemapIndex(): string {
  const items = SEGMENT_NAMES.map(
    (name) =>
      `  <sitemap>\n    <loc>${xmlEscape(`${SITE_URL}/sitemaps/${name}.xml`)}</loc>\n    <lastmod>${newest(SITEMAP_SEGMENTS[name])}</lastmod>\n  </sitemap>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

export function renderSitemapSegment(name: string): string | null {
  const entries = SITEMAP_SEGMENTS[name];
  if (!entries) return null;
  const items = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${e.url}`)}</loc>\n    <lastmod>${e.lastModified ?? SITE_LAST_MODIFIED}</lastmod>\n    <changefreq>${e.changeFrequency}</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}
