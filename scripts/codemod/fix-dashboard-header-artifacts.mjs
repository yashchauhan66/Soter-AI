/**
 * One-off fixup for two pages the header codemod produced imperfect output for.
 *
 * `migrate-dashboard-headers.mjs` matched the eyebrow + h1 pair correctly but
 * emitted the replacement at the original indentation depth, which left a
 * misaligned `<PageHeader>` block inside the `!active` early-return branch of
 * `browser-extension/page.tsx`. It also copied the h1 text into the eyebrow,
 * producing "Browser Extension / Browser Extension".
 *
 * Fixing this in the codemod would mean teaching it to infer indentation and
 * section names, which is not worth it for two occurrences. Scripted rather than
 * hand-edited so the change is reviewable and repeatable.
 *
 * Run with: node scripts/codemod/fix-dashboard-header-artifacts.mjs
 * Idempotent.
 */

import { readFileSync, writeFileSync } from "node:fs";

const FIXES = [
  {
    file: "app/dashboard/browser-extension/page.tsx",
    find: [
      "        <PageHeader",
      '        eyebrow="Browser Extension"',
      '        title="Browser Extension"',
      "      />",
    ].join("\n"),
    replace: '        <PageHeader eyebrow="AI Usage Governance" title="Browser Extension" />',
  },
  {
    file: "app/dashboard/browser-extension/page.tsx",
    find: '<section className="card p-6 text-slate-200">',
    replace: '<section className="card p-6 text-slate-300">',
  },
];

let applied = 0;

for (const fix of FIXES) {
  const original = readFileSync(fix.file, "utf8");

  // Normalise line endings for matching, then restore CRLF on write so the file
  // does not flip line-ending style and produce a whole-file diff.
  const usesCrlf = original.includes("\r\n");
  const normalised = original.replace(/\r\n/g, "\n");

  if (!normalised.includes(fix.find)) {
    console.log(`skip  ${fix.file} (pattern already fixed or absent)`);
    continue;
  }

  const updated = normalised.replace(fix.find, fix.replace);
  writeFileSync(fix.file, usesCrlf ? updated.replace(/\n/g, "\r\n") : updated, "utf8");
  applied += 1;
  console.log(`fixed ${fix.file}`);
}

console.log(`\n${applied} fix(es) applied.`);
