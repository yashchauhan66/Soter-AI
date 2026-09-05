import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";

/**
 * Documentation structure invariants.
 *
 * The docs used to be 18 independent pages, each hand-rolling its own back-link,
 * heading, breadcrumb JSON-LD, and pager. They drifted apart, and nothing caught
 * it. These tests encode the structure so the next guide added cannot regress it.
 */

const root = process.cwd();
const DOCS_DIR = join(root, "app", "docs");

/** Pages that keep a bespoke layout: the hub, the directory, and the [id] route. */
const EXEMPT = new Set(["page.tsx", join("services", "page.tsx"), join("services", "[id]", "page.tsx")]);

function guidePages(): Array<{ file: string; route: string; source: string }> {
  const out: Array<{ file: string; route: string; source: string }> = [];

  const walk = (dir: string, prefix = "") => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = prefix ? join(prefix, entry) : entry;
      if (statSync(full).isDirectory()) walk(full, rel);
      else if (entry === "page.tsx" && !EXEMPT.has(rel)) {
        const segment = rel.replace(new RegExp(`\\${sep}page\\.tsx$`), "");
        out.push({
          file: relative(root, full),
          route: `/docs/${segment.split(sep).join("/")}`,
          source: readFileSync(full, "utf8"),
        });
      }
    }
  };

  walk(DOCS_DIR);
  return out;
}

test("every docs guide is registered in the navigation tree", async () => {
  const { DOCS_PAGES } = await import("../lib/docs/navigation");
  const registered = new Set(DOCS_PAGES.map((page) => page.href));

  for (const page of guidePages()) {
    assert.ok(
      registered.has(page.route),
      `${page.file} is not in DOCS_SECTIONS — it would be invisible in the sidebar and search`,
    );
  }
});

test("every navigation entry points at a real page", async () => {
  const { DOCS_PAGES } = await import("../lib/docs/navigation");

  for (const page of DOCS_PAGES) {
    const segments = page.href.replace(/^\//, "").split("/");
    const file = join(root, "app", ...segments, "page.tsx");
    assert.doesNotThrow(() => readFileSync(file, "utf8"), `${page.href} has no page at ${file}`);
  }
});

test("every guide uses the shared shell instead of its own header", () => {
  for (const page of guidePages()) {
    assert.match(page.source, /<DocsPageShell path="/, `${page.file} should render DocsPageShell`);

    // These are the specific duplications the shell replaced. If any reappears,
    // that page has started drifting from the others again.
    assert.doesNotMatch(page.source, /← Back to/, `${page.file} still has a hand-rolled back-link`);
    assert.doesNotMatch(page.source, /container-docs/, `${page.file} still sets its own container width`);
    assert.doesNotMatch(page.source, /const breadcrumbSchema/, `${page.file} still hand-maintains breadcrumb JSON-LD`);
    assert.doesNotMatch(page.source, /<h1\b/, `${page.file} should let the shell render the H1`);
  }
});

test("every guide declares an honest scope note", async () => {
  const { DOCS_SCOPE } = await import("../lib/docs/scope");
  const { DOCS_PAGES } = await import("../lib/docs/navigation");

  for (const page of DOCS_PAGES) {
    const scope = DOCS_SCOPE[page.href];
    assert.ok(scope, `${page.href} has no entry in lib/docs/scope.ts`);
    assert.ok(scope.length > 0, `${page.href} has an empty scope note`);

    for (const item of scope) {
      // A scope note that reads like marketing is worse than none: it looks like
      // a caveat while promising coverage.
      assert.doesNotMatch(
        item,
        /100% secure|fully secure|guarantees? (?:complete|full|total)|completely secure/i,
        `${page.href} scope note contains an absolute security claim: "${item}"`,
      );
    }
  }
});

test("navigation labels and time estimates are usable", async () => {
  const { DOCS_PAGES } = await import("../lib/docs/navigation");

  const seen = new Set<string>();
  for (const page of DOCS_PAGES) {
    assert.ok(!seen.has(page.href), `duplicate navigation entry for ${page.href}`);
    seen.add(page.href);

    // A sidebar label that wraps to two lines defeats the point of a sidebar.
    assert.ok(page.label.length <= 30, `${page.href} label is too long for the sidebar: "${page.label}"`);
    assert.ok(page.summary.length >= 30, `${page.href} summary is too short to be useful`);
    assert.ok(page.minutes > 0 && page.minutes <= 30, `${page.href} has an implausible time estimate`);
  }
});

/**
 * The `<h2>` pattern below is what all 17 guides used to write by hand, 89 times.
 * It produced no `id`, so no section was linkable and no table of contents could
 * be built without maintaining a second copy of the outline per page.
 */
const RAW_SECTION_HEADING = /<h2 className="text-2xl font-bold">/;
const DOCS_HEADING_CALL = /<DocsHeading(?:\s[^>]*)?>(.*?)<\/DocsHeading>/g;

/** The entities these headings actually contain; JSX decodes them before render. */
function decodeJsxText(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

test("guides use DocsHeading so every section is linkable", () => {
  for (const page of guidePages()) {
    assert.doesNotMatch(
      page.source,
      RAW_SECTION_HEADING,
      `${page.file} has a hand-written section heading — it emits no id, so the section ` +
        "cannot be linked to and will not appear in the On this page rail. Use <DocsHeading>.",
    );

    const headings = [...page.source.matchAll(DOCS_HEADING_CALL)];
    assert.ok(headings.length > 0, `${page.file} renders no DocsHeading — the guide has no navigable structure`);
  }
});

test("heading anchors are unique and non-empty within a guide", async () => {
  const { docsSlug } = await import("../lib/docs/slug");

  for (const page of guidePages()) {
    const slugs = [...page.source.matchAll(DOCS_HEADING_CALL)].map((match) => ({
      text: match[1],
      slug: docsSlug(decodeJsxText(match[1])),
    }));

    const seen = new Map<string, string>();
    for (const entry of slugs) {
      // A heading made entirely of punctuation or emoji would produce `id=""`,
      // which is invalid and silently drops the entry from the rail.
      assert.notEqual(entry.slug, "", `${page.file}: heading "${entry.text}" produces an empty anchor`);

      const previous = seen.get(entry.slug);
      assert.equal(
        previous,
        undefined,
        `${page.file}: "${entry.text}" and "${previous}" both slug to "#${entry.slug}" — ` +
          "duplicate DOM ids, and the anchor would jump to whichever comes first",
      );
      seen.set(entry.slug, entry.text);
    }
  }
});

test("the table of contents offset matches the heading scroll margin", () => {
  const toc = readFileSync(join(root, "components", "docs", "DocsToc.tsx"), "utf8");
  const css = readFileSync(join(root, "app", "globals.css"), "utf8");

  const offset = /const HEADING_OFFSET = (\d+);/.exec(toc);
  assert.ok(offset, "DocsToc.tsx no longer declares HEADING_OFFSET");

  const rule = /\.docs-h2 \{[^}]*scroll-mt-(\d+)[^}]*\}/.exec(css);
  assert.ok(rule, ".docs-h2 no longer sets a scroll-mt — clicked anchors will land under the sticky header");

  // Tailwind's spacing scale is 0.25rem per step, and 1rem is 16px here.
  assert.equal(
    Number(offset[1]),
    Number(rule[1]) * 4,
    "HEADING_OFFSET and .docs-h2's scroll-mt have drifted apart. The rail decides which " +
      "section is current using HEADING_OFFSET, so a mismatch highlights the section above " +
      "the one the reader just clicked.",
  );
});
