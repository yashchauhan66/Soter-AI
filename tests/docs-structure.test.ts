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
