/**
 * Follow-up pass for the docs shell migration.
 *
 * `migrate-docs-shell.mjs` removed the `<DocViewTracker />` element (it now lives
 * in the docs layout so it fires once per navigation rather than once per page
 * component) and the inline breadcrumb `<script>`, but left some imports and the
 * now-dead `breadcrumbSchema` constant behind — the original regexes assumed LF
 * line endings and these files are CRLF.
 *
 * Also drops `Link` imports that no longer have a JSX reference, which the shell
 * migration created by absorbing the back-link and the footer pager.
 *
 * Run with: node scripts/codemod/clean-docs-imports.mjs
 * Idempotent.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS_DIR = join(process.cwd(), "app", "docs");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

let changed = 0;

for (const file of walk(DOCS_DIR)) {
  const original = readFileSync(file, "utf8");
  let source = original;

  // Only touch migrated pages; the hub and service directory keep their own layout.
  if (!source.includes("DocsPageShell")) continue;

  // Dead `breadcrumbSchema` constant — the shell derives breadcrumbs from the
  // navigation tree now, so a second hand-maintained copy could only drift.
  // `[\r\n]` rather than `\n` because these files are CRLF.
  if (!/breadcrumbSchema[^=]/.test(source.replace(/const breadcrumbSchema/, ""))) {
    source = source.replace(/[\r\n]+const breadcrumbSchema = \{[\s\S]*?[\r\n]\};[\r\n]/, "\n");
  }

  // Unused DocViewTracker import (element already removed).
  if (!/<DocViewTracker\s*\/>/.test(source)) {
    source = source.replace(/^import \{ DocViewTracker \} from "@\/components\/docs\/DocViewTracker";\r?\n/m, "");
  }

  // Unused Link import.
  if (!/<Link\b/.test(source)) {
    source = source.replace(/^import Link from "next\/link";\r?\n/m, "");
  }

  // Unused safeJsonLd import.
  if (!/safeJsonLd\(/.test(source)) {
    source = source.replace(/^import \{ safeJsonLd \} from "@\/lib\/seo\/jsonLd";\r?\n/m, "");
  }

  // Collapse a run of blank lines left behind by the removals.
  source = source.replace(/(\r?\n){3,}/g, "\n\n");

  if (source !== original) {
    writeFileSync(file, source, "utf8");
    changed += 1;
    console.log(`cleaned ${relative(process.cwd(), file)}`);
  }
}

console.log(`\n${changed} file(s) cleaned.`);
