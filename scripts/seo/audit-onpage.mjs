#!/usr/bin/env node
/**
 * On-page SEO audit over the public App Router pages.
 *
 * Static analysis only: it parses the `buildMetadata({...})` / `metadata` object
 * literals out of each page (or its segment layout) and reports the mechanical
 * SEO defects that are cheap to fix and expensive to leave broken:
 *
 *   - title length (Google truncates the SERP link at ~580px ≈ 60 chars, and the
 *     root layout appends " | SoterAI" = 10 more)
 *   - description length (truncated ~155-160 chars)
 *   - duplicate titles / descriptions across routes (cannibalisation signal)
 *   - pages missing from app/sitemap.ts
 *   - body copy word count (thin-content signal)
 *   - <h1> count per page (must be exactly 1)
 *   - <img> without alt
 *
 * Usage: node scripts/seo/audit-onpage.mjs [--json]
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

/** Route segments that are never indexed, so they are out of scope. */
const PRIVATE_SEGMENTS = new Set([
  "dashboard",
  "admin",
  "api",
  "signin",
  "signup",
  "forgot-password",
  "reset-password",
  "verify-email",
]);

/** Title suffix the root layout's template appends. */
const TITLE_SUFFIX = " | SoterAI";
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;
const THIN_CONTENT_WORDS = 300;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (entry === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

/** app/(public)/scanner/page.tsx -> /scanner ; app/page.tsx -> / */
function routeOf(pageFile) {
  let route = relative(APP, dirname(pageFile)).split(/[\\/]/).filter(Boolean);
  // Route groups like (public) are not part of the URL.
  route = route.filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")));
  return "/" + route.join("/");
}

function isPrivate(route) {
  const first = route.split("/").filter(Boolean)[0];
  return first !== undefined && PRIVATE_SEGMENTS.has(first);
}

/**
 * Pull a string value for `key` out of a source file. Handles single/double
 * quotes and template literals, and tolerates the value spanning lines.
 */
function extractString(src, key) {
  const re = new RegExp(`${key}\\s*:\\s*(["'\`])([\\s\\S]*?)\\1\\s*,`, "m");
  const m = src.match(re);
  if (!m) return null;
  return m[2].replace(/\s*\n\s*/g, " ").trim();
}

/** Source that owns a route's metadata: the page, else its segment layout. */
function metadataSourceFor(pageFile) {
  const pageSrc = readFileSync(pageFile, "utf8");
  if (/export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(pageSrc)) {
    return { file: pageFile, src: pageSrc };
  }
  const layout = join(dirname(pageFile), "layout.tsx");
  if (existsSync(layout)) {
    const layoutSrc = readFileSync(layout, "utf8");
    if (/export\s+const\s+metadata|generateMetadata/.test(layoutSrc)) {
      return { file: layout, src: layoutSrc };
    }
  }
  return { file: pageFile, src: pageSrc };
}

/** Rough visible-word count: strip imports, JSX tags, and code-ish noise. */
function wordCount(src) {
  const text = src
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}()[\];=<>|&$`]/g, " ");
  return text.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w)).length;
}

/**
 * The page title as the layout template will see it.
 *
 * Three shapes are valid: a plain string (the root template appends the brand),
 * `{ absolute: "..." }` (the template is bypassed, so the brand must already be
 * in the string), and a plain string handed to `buildMetadata()` — which marks
 * brand-containing titles absolute for you (see lib/seo/metadata.ts). Report
 * which, because the length budget differs by the 10-char suffix.
 */
function extractTitle(src) {
  const abs = src.match(/title:\s*\{\s*absolute:\s*(["'`])([\s\S]*?)\1/m);
  if (abs) return { text: abs[2].replace(/\s*\n\s*/g, " ").trim(), absolute: true };
  const plain = extractString(src, "title");
  if (!plain) return null;
  const viaHelper = /buildMetadata\(/.test(src) && plain.includes("SoterAI");
  return { text: plain, absolute: viaHelper };
}

const sourceCache = new Map();
function readCached(file) {
  if (!sourceCache.has(file)) sourceCache.set(file, readFileSync(file, "utf8"));
  return sourceCache.get(file);
}

/** Resolve a first-party "@/..." import specifier to a file on disk. */
function resolveLocal(spec) {
  if (!spec.startsWith("@/")) return null;
  const base = join(ROOT, spec.slice(2));
  for (const cand of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * Sources of the first-party modules a page imports, one level deep.
 *
 * Many routes here render their heading through a shared component
 * (`FeatureLanding`, `BlogArticle`, `ReadinessPage`, …) that takes the copy as a
 * data object. Auditing only the page file reports those as "no <h1>" even
 * though the rendered HTML has exactly one — so the checks below look through
 * the imports before reporting a missing heading.
 */
function importedSources(src) {
  const out = [];
  for (const m of src.matchAll(/^import\s[\s\S]*?from\s+["'](@\/[^"']+)["']/gm)) {
    const file = resolveLocal(m[1]);
    if (file) out.push({ file, src: readCached(file) });
  }
  return out;
}

/**
 * Does a module render visible content (vs. being pure utility/data)?
 *
 * Used to decide whether an imported module's words should count toward a page's
 * content length. A content component (`ReadinessPage`, `FeatureLanding`, …)
 * carries `className` and JSX tags; a utility module (`metadata.ts`, `schema.ts`)
 * does not. Counting the latter would inject ~230 phantom "words" of identifiers
 * into every page that imports `buildMetadata`, which could push a genuinely thin
 * page over the threshold and hide it.
 */
function rendersContent(src) {
  return /className=/.test(src) || /<\/[A-Za-z]/.test(src) || /\/>/.test(src);
}

const sitemapSrc = readFileSync(join(APP, "sitemap.ts"), "utf8");
const sitemapRoutes = new Set(
  [...sitemapSrc.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1])
);
// Dynamic families the sitemap derives from a registry rather than listing.
const DERIVED_PREFIXES = ["/docs/services/", "/blog/"];

const findings = [];
const titles = new Map();
const descs = new Map();
const rows = [];

for (const pageFile of walk(APP)) {
  const route = routeOf(pageFile);
  if (isPrivate(route)) continue;
  const rel = relative(ROOT, pageFile).replace(/\\/g, "/");
  const isDynamic = route.includes("[");

  const { file: metaFile, src: metaSrc } = metadataSourceFor(pageFile);
  const pageSrc = readFileSync(pageFile, "utf8");

  const title = extractTitle(metaSrc);
  const description = extractString(metaSrc, "description");
  const noindex = /noindex:\s*true/.test(metaSrc) || /index:\s*false/.test(metaSrc);

  // --- title length + brand duplication -----------------------------------
  let renderedTitle = null;
  if (title) {
    // A plain-string title always gets " | SoterAI" appended by the root
    // layout's `title.template`; an absolute one opts out of it. So a plain
    // title that already names the brand renders it TWICE — never skip the
    // suffix for those, that is exactly the bug being caught here.
    const rendered = title.absolute ? title.text : title.text + TITLE_SUFFIX;
    renderedTitle = rendered;
    if (!title.absolute && title.text.includes("SoterAI")) {
      findings.push({
        severity: "high",
        kind: "brand-suffix-duplicated",
        route,
        file: relative(ROOT, metaFile).replace(/\\/g, "/"),
        detail: `title names the brand and is not absolute, so the layout template renders it twice — "${rendered}"`,
      });
    }
    if (rendered.length > TITLE_MAX) {
      findings.push({
        severity: "medium",
        kind: "title-too-long",
        route,
        file: relative(ROOT, metaFile).replace(/\\/g, "/"),
        detail: `${rendered.length} chars (max ${TITLE_MAX}) — "${rendered}"`,
      });
    }
    const key = title.text.toLowerCase();
    titles.set(key, [...(titles.get(key) ?? []), route]);
  }

  // --- description length -------------------------------------------------
  // Skip noindex routes: their snippet never reaches a SERP, so its length is
  // not a finding. (The h1 and sitemap checks below already gate the same way.)
  if (description && !noindex) {
    if (description.length > DESC_MAX) {
      findings.push({
        severity: "low",
        kind: "description-too-long",
        route,
        file: relative(ROOT, metaFile).replace(/\\/g, "/"),
        detail: `${description.length} chars (max ${DESC_MAX})`,
      });
    } else if (description.length < DESC_MIN) {
      findings.push({
        severity: "low",
        kind: "description-too-short",
        route,
        file: relative(ROOT, metaFile).replace(/\\/g, "/"),
        detail: `${description.length} chars (min ${DESC_MIN})`,
      });
    }
    const key = description.toLowerCase();
    descs.set(key, [...(descs.get(key) ?? []), route]);
  }

  // --- sitemap coverage ---------------------------------------------------
  const derived = DERIVED_PREFIXES.some((p) => route.startsWith(p));
  if (!noindex && !isDynamic && !derived && !sitemapRoutes.has(route)) {
    findings.push({
      severity: "high",
      kind: "missing-from-sitemap",
      route,
      file: "app/sitemap.ts",
      detail: `indexable route not listed in the sitemap`,
    });
  }

  // --- h1 count -----------------------------------------------------------
  const h1s = (pageSrc.match(/<h1[\s>]/g) ?? []).length;
  // A page with no literal <h1> may still render exactly one through a shared
  // layout component, so only report it when no imported component emits one.
  const h1Provider =
    h1s === 0
      ? importedSources(pageSrc).find((dep) => /<h1[\s>]/.test(dep.src))
      : undefined;
  if (!noindex && h1s === 0 && !h1Provider) {
    findings.push({
      severity: "medium",
      kind: "no-h1",
      route,
      file: rel,
      detail: "no <h1> in the page component",
    });
  } else if (h1s > 1) {
    findings.push({
      severity: "medium",
      kind: "multiple-h1",
      route,
      file: rel,
      detail: `${h1s} <h1> elements`,
    });
  }

  // --- img alt ------------------------------------------------------------
  for (const m of pageSrc.matchAll(/<(img|Image)\s([^>]*?)\/?>/g)) {
    if (!/\balt\s*=/.test(m[2])) {
      findings.push({
        severity: "medium",
        kind: "img-missing-alt",
        route,
        file: rel,
        detail: `<${m[1]}> without alt`,
      });
    }
  }

  // --- thin content -------------------------------------------------------
  // Count the page's own words plus those of the first-party *content* modules
  // it imports. Many routes are a thin shell over a shared component or content
  // module (`ReadinessPage`, `publicContent`, …), so a page-local count reports
  // them as thin when the rendered page is substantial. Utility modules
  // (`metadata.ts`, `schema.ts`) are excluded via rendersContent(), or their
  // ~230 identifier "words" would inflate every page that imports buildMetadata.
  const words =
    wordCount(pageSrc) +
    importedSources(pageSrc)
      .filter((dep) => rendersContent(dep.src))
      .reduce((sum, dep) => sum + wordCount(dep.src), 0);
  if (!noindex && !isDynamic && words < THIN_CONTENT_WORDS) {
    findings.push({
      severity: "medium",
      kind: "thin-content",
      route,
      file: rel,
      detail: `~${words} content words (target > ${THIN_CONTENT_WORDS})`,
    });
  }

  // Report the title as a browser renders it, suffix included.
  rows.push({ route, title: renderedTitle, description, words, noindex, h1s });
}

// --- blog registry --------------------------------------------------------
// Blog routes build their metadata from `lib/blog/posts.ts`, so the per-page
// scan above sees `post.title` rather than a string and can check nothing. Audit
// the registry directly, or 8 of the highest-intent routes stay a blind spot.
{
  const src = readCached(join(ROOT, "lib/blog/posts.ts")).replace(/\r/g, "");
  const registry = src.slice(src.indexOf("BLOG_POSTS"));
  let parsed = 0;
  for (const block of registry.split(/^ {2}\{$/m).slice(1)) {
    const field = (key) => {
      const m = block.match(new RegExp(`\\b${key}:\\s*\\n?\\s*"([^"]+)"`));
      return m?.[1] ?? null;
    };
    const slug = field("slug");
    if (!slug) continue;
    parsed++;
    const route = `/blog/${slug}`;
    const file = "lib/blog/posts.ts";

    // seoTitle wins when present; both are plain strings, so the layout appends.
    const serpTitle = field("seoTitle") ?? field("title");
    const rendered = `${serpTitle}${TITLE_SUFFIX}`;
    if (rendered.length > TITLE_MAX) {
      findings.push({
        severity: "medium",
        kind: "title-too-long",
        route,
        file,
        detail: `${rendered.length} chars (max ${TITLE_MAX}) — "${rendered}". Add or shorten seoTitle.`,
      });
    }
    const description = field("description");
    if (description && description.length > DESC_MAX) {
      findings.push({
        severity: "low",
        kind: "description-too-long",
        route,
        file,
        detail: `${description.length} chars (max ${DESC_MAX})`,
      });
    }
  }
  // A regex parse that silently matched nothing would report a clean blog
  // forever. Fail loudly instead if the registry's shape ever drifts.
  if (parsed === 0) {
    findings.push({
      severity: "high",
      kind: "audit-blind",
      route: "/blog/*",
      file: "lib/blog/posts.ts",
      detail: "parsed 0 posts from BLOG_POSTS — the blog title/description checks did not run",
    });
  }
}

// --- duplicates across routes --------------------------------------------
for (const [key, routes] of titles) {
  if (routes.length > 1) {
    findings.push({
      severity: "high",
      kind: "duplicate-title",
      route: routes.join(", "),
      file: "-",
      detail: `${routes.length} routes share the title "${key}"`,
    });
  }
}
for (const [key, routes] of descs) {
  if (routes.length > 1) {
    findings.push({
      severity: "high",
      kind: "duplicate-description",
      route: routes.join(", "),
      file: "-",
      detail: `${routes.length} routes share one description`,
    });
  }
}

// --- sitemap entries with no matching route (would emit 404s to Google) ---
const liveRoutes = new Set(rows.map((r) => r.route));
for (const route of sitemapRoutes) {
  const derived = DERIVED_PREFIXES.some((p) => route.startsWith(p));
  if (!derived && !liveRoutes.has(route)) {
    findings.push({
      severity: "high",
      kind: "sitemap-route-missing",
      route,
      file: "app/sitemap.ts",
      detail: "listed in sitemap but no page.tsx resolves it",
    });
  }
}

const order = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.kind.localeCompare(b.kind));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ findings, rows }, null, 2));
} else {
  const counts = findings.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {});
  console.log(`Routes audited: ${rows.length}`);
  console.log(`Findings: ${findings.length}\n`);
  for (const [kind, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${kind}`);
  }
  console.log("");
  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] ${f.kind}\n      route: ${f.route}\n      file:  ${f.file}\n      ${f.detail}\n`);
  }
}
