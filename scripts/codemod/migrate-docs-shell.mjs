/**
 * One-off codemod: migrate `/docs/*` guides onto `DocsPageShell`.
 *
 * Each of the 18 guides opened with the same ~10 lines (main wrapper,
 * DocViewTracker, breadcrumb JSON-LD script, container-docs div, back-link,
 * eyebrow, H1, intro paragraph) and closed with a hand-rolled prev/next pager.
 * All of that is now owned by `DocsPageShell` + `lib/docs/navigation.ts`.
 *
 * Doing this by hand across 18 files would guarantee inconsistency, so the
 * transformation is scripted and verified: the script refuses to write a file it
 * cannot fully match, and prints a per-file report.
 *
 * Run with: node scripts/codemod/migrate-docs-shell.mjs
 * This script is idempotent — already-migrated files are skipped.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = join(process.cwd(), "app", "docs");

/** Guides that keep their own bespoke layout (hub + service directory). */
const SKIP = new Set(["page.tsx", join("services", "page.tsx"), join("services", "[id]", "page.tsx")]);

function collectPages(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? join(prefix, entry) : entry;
    if (statSync(full).isDirectory()) {
      out.push(...collectPages(full, rel));
    } else if (entry === "page.tsx" && !SKIP.has(rel)) {
      out.push({ full, rel });
    }
  }
  return out;
}

/** Derive the route path from the file path: `js/page.tsx` → `/docs/js`. */
function routeFor(rel) {
  const segment = rel.replace(/[\\/]page\.tsx$/, "");
  return segment === "page.tsx" ? "/docs" : `/docs/${segment.replace(/\\/g, "/")}`;
}

const report = [];

for (const { full, rel } of collectPages(DOCS_DIR)) {
  let source = readFileSync(full, "utf8");
  const route = routeFor(rel);

  if (source.includes("DocsPageShell")) {
    report.push(`skip     ${route} (already migrated)`);
    continue;
  }

  const original = source;
  const problems = [];

  // 1. Header block: from `<main …>` through the intro paragraph that follows the
  //    H1. Non-greedy up to the first `</p>` after the `</h1>`.
  const header = /<main className="py-16">[\s\S]*?<\/h1>\s*<p className="mt-5 text-lg leading-8 text-slate-200">[\s\S]*?<\/p>/;
  if (header.test(source)) {
    source = source.replace(header, `<DocsPageShell path="${route}">`);
  } else {
    problems.push("header block did not match");
  }

  // 2. Legacy footer pager — superseded by the shell's pager.
  const pager = /\n\s*<div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">[\s\S]*?<\/div>\n/;
  if (pager.test(source)) source = source.replace(pager, "\n");

  // 3. Closing tags: `</div>\n  </main>` → `</DocsPageShell>`.
  const closing = /\s*<\/div>\s*<\/main>\s*\);/;
  if (closing.test(source)) {
    source = source.replace(closing, "\n    </DocsPageShell>\n  );");
  } else {
    problems.push("closing tags did not match");
  }

  // 4. Imports. The shell owns the breadcrumb JSON-LD and the view tracker.
  source = source
    .replace(/^import \{ DocViewTracker \} from "@\/components\/docs\/DocViewTracker";\n/m, "")
    .replace(/^import \{ safeJsonLd \} from "@\/lib\/seo\/jsonLd";\n/m, "");

  // Drop the now-unused breadcrumb schema constant.
  source = source.replace(/\nconst breadcrumbSchema = \{[\s\S]*?\n\};\n/, "\n");

  // Add the shell import after the last existing component import.
  if (!source.includes("DocsPageShell")) problems.push("shell import not inserted");
  else {
    const anchor = /^(import .*from "@\/components\/ui\/CodeBlock";)$/m;
    if (anchor.test(source)) {
      source = source.replace(anchor, `$1\nimport { DocsPageShell } from "@/components/docs/DocsPageShell";`);
    } else {
      source = source.replace(/^(import .*\n)(?![\s\S]*^import )/m, `$1import { DocsPageShell } from "@/components/docs/DocsPageShell";\n`);
    }
  }

  // Drop a now-unused `Link` import only when no JSX reference remains.
  if (!/<Link\b/.test(source)) {
    source = source.replace(/^import Link from "next\/link";\n/m, "");
  }

  if (problems.length > 0) {
    report.push(`FAILED   ${route}: ${problems.join("; ")}`);
    continue;
  }

  if (source !== original) {
    writeFileSync(full, source, "utf8");
    report.push(`migrated ${route}`);
  } else {
    report.push(`no-op    ${route}`);
  }
}

console.log(report.join("\n"));
const failures = report.filter((line) => line.startsWith("FAILED")).length;
if (failures > 0) {
  console.error(`\n${failures} file(s) need manual migration.`);
  process.exitCode = 1;
}
