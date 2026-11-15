export interface DocsSearchHeading {
  id: string;
  title: string;
  text: string;
}

export interface DocsSearchDocument {
  href: string;
  title: string;
  section: string;
  kind: "guide" | "service";
  summary: string;
  body: string;
  keywords: string[];
  headings: DocsSearchHeading[];
}

export interface DocsSearchResult {
  href: string;
  title: string;
  section: string;
  kind: DocsSearchDocument["kind"];
  heading?: string;
  excerpt: string;
}

const DOCS_PATH = /^\/docs(?:\/[a-zA-Z0-9_-]+)*$/;
const SECTION_ID = /^[a-zA-Z0-9_-]+$/;
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

/** Validate the public, same-origin index before using a URL as navigation. */
export function parseDocsIndex(value: unknown): DocsSearchDocument[] | null {
  if (!value || typeof value !== "object") return null;
  const index = value as Record<string, unknown>;
  if (index.version !== 1 || !Array.isArray(index.pages) || index.pages.length === 0 || index.pages.length > 1000) return null;
  const seen = new Set<string>();
  for (const candidate of index.pages) {
    if (!candidate || typeof candidate !== "object") return null;
    const page = candidate as Record<string, unknown>;
    if (!text(page.href, 256) || !DOCS_PATH.test(page.href) || seen.has(page.href)) return null;
    if (!text(page.title, 200) || !page.title.trim() || !text(page.section, 120) || !text(page.summary, 2000) || !text(page.body, 200000)) return null;
    if (page.kind !== "guide" && page.kind !== "service") return null;
    if (!Array.isArray(page.keywords) || page.keywords.length > 100 || !page.keywords.every((keyword) => text(keyword, 200))) return null;
    if (!Array.isArray(page.headings) || page.headings.length > 200) return null;
    const anchors = new Set<string>();
    for (const candidateHeading of page.headings) {
      if (!candidateHeading || typeof candidateHeading !== "object") return null;
      const heading = candidateHeading as Record<string, unknown>;
      if (!text(heading.id, 200) || !SECTION_ID.test(heading.id) || anchors.has(heading.id)) return null;
      if (!text(heading.title, 300) || !text(heading.text, 100000)) return null;
      anchors.add(heading.id);
    }
    seen.add(page.href);
  }
  return index.pages as DocsSearchDocument[];
}

function excerpt(source: string, terms: string[]): string {
  const clean = source.replace(/\s+/g, " ").trim();
  const lower = normalize(clean);
  const positions = terms.map((term) => lower.indexOf(term)).filter((position) => position >= 0);
  const start = positions.length ? Math.max(0, Math.min(...positions) - 52) : 0;
  const end = Math.min(clean.length, start + 185);
  return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

/** Local full-text matching. One result per document avoids a noisy hit wall. */
export function searchDocs(pages: readonly DocsSearchDocument[], query: string, limit = 8): DocsSearchResult[] {
  const cap = Math.max(0, Math.min(20, Number.isFinite(limit) ? Math.floor(limit) : 8));
  if (!cap) return [];
  const normalized = normalize(query.slice(0, 160));
  const terms = [...new Set(normalized.match(/[\p{L}\p{N}_]+/gu) ?? [])];
  if (!terms.length) {
    return [...pages]
      .sort((a, b) => Number(b.href === "/docs/quickstart") - Number(a.href === "/docs/quickstart"))
      .slice(0, cap)
      .map((page) => ({ href: page.href, title: page.title, section: page.section, kind: page.kind, excerpt: page.summary }));
  }
  return pages.flatMap((page, order) => {
    const title = normalize(page.title);
    const aliases = normalize(page.keywords.join(" "));
    const content = normalize(`${page.title} ${page.summary} ${page.keywords.join(" ")} ${page.body} ${page.headings.map((heading) => `${heading.title} ${heading.text}`).join(" ")}`);
    if (!terms.every((term) => content.includes(term))) return [];
    let score = title === normalized ? 150 : title.startsWith(normalized) ? 120 : title.includes(normalized) ? 100 : 0;
    score += terms.reduce((value, term) => value + (title.includes(term) ? 20 : 0) + (aliases.includes(term) ? 12 : 0), 0);
    const headingTerms = terms.filter((term) => !title.includes(term) && !aliases.includes(term));
    const headings = page.headings
      .map((item) => ({ item, text: normalize(`${item.title} ${item.text}`), title: normalize(item.title) }))
      .sort((a, b) => terms.filter((term) => b.title.includes(term)).length - terms.filter((term) => a.title.includes(term)).length);
    // Preserve full-query matches; document context alone must not pick a section.
    const heading = headings.find((item) => terms.every((term) => item.text.includes(term)))?.item
      ?? (headingTerms.length ? headings.find((item) => headingTerms.every((term) => item.text.includes(term)))?.item : undefined);
    if (heading) score += 10;
    return [{ score, order, hit: {
      href: heading ? `${page.href}#${heading.id}` : page.href,
      title: page.title,
      section: page.section,
      kind: page.kind,
      ...(heading ? { heading: heading.title } : {}),
      excerpt: excerpt(heading?.text || page.body || page.summary, terms),
    } satisfies DocsSearchResult }];
  }).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, cap).map((row) => row.hit);
}
