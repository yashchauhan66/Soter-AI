/**
 * Final pass of the docs shell migration: the two guides the main codemod could
 * not match automatically.
 *
 * `migrate-docs-shell.mjs` keys on the exact intro-paragraph class string. These
 * two pages used `text-slate-300` instead of `text-slate-200` and (in the case of
 * quickstart) carried an extra `HowTo` JSON-LD script, so the single regex did not
 * apply. Rather than loosening that regex — which risks a silent mis-slice on the
 * other 16 files — this script handles the two exceptions by locating the end of
 * the intro paragraph explicitly.
 *
 * Run with: node scripts/codemod/migrate-docs-shell-exceptions.mjs
 * Idempotent.
 */

import { readFileSync, writeFileSync } from "node:fs";

const TARGETS = [
  {
    file: "app/docs/quickstart/page.tsx",
    route: "/docs/quickstart",
    /** Last words of the intro paragraph the shell now replaces. */
    introEndsWith: "and unsafe model output.",
  },
  {
    file: "app/docs/rest-api/page.tsx",
    route: "/docs/rest-api",
    introEndsWith: "and working examples for 7+ programming languages.",
  },
];

for (const target of TARGETS) {
  let source = readFileSync(target.file, "utf8");

  if (source.includes("DocsPageShell")) {
    console.log(`skip     ${target.route} (already migrated)`);
    continue;
  }

  const start = source.indexOf('<main className="py-16">');
  const anchor = source.indexOf(target.introEndsWith);

  if (start === -1 || anchor === -1) {
    console.error(`FAILED   ${target.route}: could not locate header bounds`);
    process.exitCode = 1;
    continue;
  }

  const closeParagraph = source.indexOf("</p>", anchor);
  if (closeParagraph === -1) {
    console.error(`FAILED   ${target.route}: intro paragraph is unterminated`);
    process.exitCode = 1;
    continue;
  }

  // Replace the whole header block with the shell opening tag.
  source = `${source.slice(0, start)}<DocsPageShell path="${target.route}">${source.slice(closeParagraph + 4)}`;

  // Legacy footer pager — the shell renders its own.
  source = source.replace(
    /\n\s*<div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">[\s\S]*?<\/div>\n/,
    "\n",
  );

  // Closing tags.
  source = source.replace(/\s*<\/div>\s*<\/main>\s*\);/, "\n    </DocsPageShell>\n  );");

  // Imports: add the shell, drop what it now owns.
  source = source.replace(
    /^(import .*from "@\/components\/ui\/CodeBlock";)$/m,
    '$1\nimport { DocsPageShell } from "@/components/docs/DocsPageShell";',
  );
  source = source.replace(/^import \{ DocViewTracker \} from "@\/components\/docs\/DocViewTracker";\r?\n/m, "");
  source = source.replace(/\nconst breadcrumbSchema = \{[\s\S]*?\n\};\n/, "\n");
  if (!/<Link\b/.test(source)) source = source.replace(/^import Link from "next\/link";\r?\n/m, "");
  if (!/safeJsonLd\(/.test(source)) {
    source = source.replace(/^import \{ safeJsonLd \} from "@\/lib\/seo\/jsonLd";\r?\n/m, "");
  }

  writeFileSync(target.file, source, "utf8");
  console.log(`migrated ${target.route}`);
}
