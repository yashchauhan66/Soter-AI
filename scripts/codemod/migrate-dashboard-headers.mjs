/**
 * Codemod: migrate dashboard page headers onto `PageHeader`.
 *
 * 42 of the 84 dashboard pages opened with the same three-element block:
 *
 *     <p className="eyebrow">Event delivery</p>
 *     <h1 className="mt-2 text-3xl font-bold">Webhooks</h1>
 *     <p className="mb-7 mt-3 text-slate-200">Receive signed notifications…</p>
 *
 * 41 used the identical H1 class string. Editing 42 files by hand would
 * reintroduce exactly the inconsistency this is meant to remove, so the
 * transformation is scripted, refuses to write a file it cannot fully match, and
 * prints a per-file report.
 *
 * Run with: node scripts/codemod/migrate-dashboard-headers.mjs
 * Idempotent — already-migrated files are skipped.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DASHBOARD_DIR = join(process.cwd(), "app", "dashboard");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

/** Escape a literal for embedding inside a JSX string attribute. */
function attr(value) {
  return value.replace(/"/g, "&quot;");
}

const report = { migrated: [], skipped: [], unmatched: [] };

for (const file of walk(DASHBOARD_DIR)) {
  const original = readFileSync(file, "utf8");
  let source = original;
  const name = relative(process.cwd(), file);

  if (source.includes("PageHeader")) {
    report.skipped.push(name);
    continue;
  }

  /**
   * Eyebrow + H1, with an optional following description paragraph.
   *
   * The description is matched non-greedily and only when it is the immediate
   * next sibling — a page whose H1 is followed by a component rather than a
   * paragraph still migrates, just without a description.
   */
  const pattern = new RegExp(
    String.raw`<p className="eyebrow">([\s\S]*?)</p>\s*` +
      String.raw`<h1 className="[^"]*">([\s\S]*?)</h1>` +
      String.raw`(?:\s*<p className="(?:mb-7 mt-3|mt-3|mt-4)[^"]*">([\s\S]*?)</p>)?`,
  );

  const match = source.match(pattern);
  if (!match) {
    report.unmatched.push(name);
    continue;
  }

  const [full, eyebrowRaw, titleRaw, descriptionRaw] = match;

  // Only migrate plain-text headers. If the eyebrow or title contains JSX or an
  // interpolation, a naive string swap would corrupt it — leave those for manual
  // review rather than guessing.
  if (/[<{]/.test(eyebrowRaw) || /[<{]/.test(titleRaw)) {
    report.unmatched.push(`${name} (dynamic eyebrow/title)`);
    continue;
  }

  const eyebrow = eyebrowRaw.trim().replace(/\s+/g, " ");
  const title = titleRaw.trim().replace(/\s+/g, " ");
  const description = descriptionRaw?.trim().replace(/\s+/g, " ");

  // A description containing JSX has to stay as a child expression rather than
  // becoming a string attribute.
  const descriptionIsJsx = description ? /[<{]/.test(description) : false;

  let replacement = `<PageHeader\n        eyebrow="${attr(eyebrow)}"\n        title="${attr(title)}"`;
  if (description && !descriptionIsJsx) {
    replacement += `\n        description="${attr(description)}"`;
  }
  replacement += descriptionIsJsx
    ? `\n      >\n        {/* Description retained as JSX because it contains markup. */}\n      </PageHeader>`
    : "\n      />";

  // When the description had markup, keep the original paragraph in place after
  // the header instead of silently dropping content.
  if (descriptionIsJsx && descriptionRaw) {
    replacement += `\n      <p className="mb-7 max-w-prose leading-7 text-slate-400">${descriptionRaw}</p>`;
  }

  source = source.replace(full, replacement);

  // Import, inserted after the final existing import line.
  const importLine = 'import { PageHeader } from "@/components/dashboard/PageHeader";';
  if (!source.includes(importLine)) {
    const imports = [...source.matchAll(/^import .*?;$/gm)];
    if (imports.length === 0) {
      report.unmatched.push(`${name} (no import block)`);
      continue;
    }
    const last = imports[imports.length - 1];
    const at = last.index + last[0].length;
    source = `${source.slice(0, at)}\n${importLine}${source.slice(at)}`;
  }

  if (source !== original) {
    writeFileSync(file, source, "utf8");
    report.migrated.push(name);
  }
}

console.log(`migrated: ${report.migrated.length}`);
for (const name of report.migrated) console.log(`  ${name}`);
console.log(`\nalready migrated: ${report.skipped.length}`);
console.log(`no standard header (left untouched): ${report.unmatched.length}`);
for (const name of report.unmatched) console.log(`  ${name}`);
