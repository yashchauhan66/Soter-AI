/**
 * Design-drift audit for data tables.
 *
 * Reports every `<table>` in app/ and components/ that still styles itself with
 * raw utility classes instead of the shared primitives in
 * `components/ui/DataTable.tsx`.
 *
 * Why this is a script rather than a lint rule: the signal is a *combination* of
 * markup and class strings across multiple lines, which ESLint's per-node
 * traversal cannot express without a custom AST rule. This runs in ~1s and gives
 * an exact remaining count, so table migration can proceed incrementally with a
 * number that goes down instead of a vague "some pages are inconsistent".
 *
 * Usage: node scripts/audit-table-drift.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components"];

/** Files that legitimately contain a raw <table>. */
const ALLOWED = new Set([
  // Docs pages render reference tables inside prose, not console data grids.
  "app/docs/rest-api/page.tsx",
  "app/docs/api-contract/page.tsx",
  "app/docs/wordpress/page.tsx",
  "app/comparison/page.tsx",
  // Print/PDF output cannot use the sticky-header primitive.
  "components/dashboard/WhiteLabelReportPrint.tsx",
  // The primitives themselves.
  "components/ui/DataTable.tsx",
  // Chart.tsx emits an sr-only data table as the accessible alternative.
  "components/ui/Chart.tsx",
]);

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of collect(root)) {
    const rel = relative(process.cwd(), file).replaceAll("\\", "/");
    if (ALLOWED.has(rel)) continue;

    const source = readFileSync(file, "utf8");
    if (!source.includes("<table")) continue;

    // A migrated file imports the primitives and uses <THead>/<TH>.
    const migrated = source.includes("@/components/ui/DataTable") && /<THead[\s>]/.test(source);
    if (migrated) continue;

    const tables = (source.match(/<table/g) ?? []).length;
    const theadClasses = [...source.matchAll(/<thead className="([^"]*)"/g)].map((m) => m[1]);

    findings.push({ file: rel, tables, theadClasses });
  }
}

if (findings.length === 0) {
  console.log("All data tables use the shared primitives.");
} else {
  const total = findings.reduce((sum, f) => sum + f.tables, 0);
  console.log(`${total} raw table(s) across ${findings.length} file(s) not yet on the primitives:\n`);

  for (const f of findings.sort((a, b) => b.tables - a.tables)) {
    console.log(`${f.file}  (${f.tables} table${f.tables > 1 ? "s" : ""})`);
    for (const cls of f.theadClasses) console.log(`    thead: "${cls}"`);
  }

  // Distinct <thead> styles is the number that actually measures drift: one
  // codebase should not have eleven ways to render a table header.
  const distinct = new Set(findings.flatMap((f) => f.theadClasses));
  console.log(`\nDistinct <thead> class strings remaining: ${distinct.size}`);
}
