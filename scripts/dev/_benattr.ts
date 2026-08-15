/**
 * Attribute every benign false positive in the applied state to the rule that
 * caused it, counting only findings the decision layer actually TRUSTS.
 *
 * Needed because the applied FPR (3.18%) sits above the 2.84% that _rowlevel.ts
 * measured for the boundary edits alone. The extra rows are either a cost of the
 * widened instruction-invalidation rule — which measured 0 benign fires as a bare
 * regex, but the detector re-runs every rule over decoded variants (leet, unicode,
 * compact, base64) that the bare-regex probe never exercised — or they predate it.
 * Guessing which would be exactly the kind of unverified claim this pass exists to
 * eliminate.
 *
 * advisoryOnly findings are excluded: they contribute zero score and cannot be the
 * reason a row left ALLOW.
 */
import { readFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);

const byRule = new Map<string, { n: number; rows: number[] }>();
const WATCH = /Instruction invalidation|Adaptive jailbreak optimizer/i;
const watched: { i: number; label: string; matched: string; text: string }[] = [];

rows.forEach((r, i) => {
  if (!isB(r.label)) return;
  let res: { action: string; findings: { label: string; advisoryOnly?: boolean; matched?: string }[] };
  try {
    res = analyzeText(r.text, "INPUT") as typeof res;
  } catch { return; }
  if (res.action === "ALLOW") return;
  const trusted = (res.findings ?? []).filter((f) => !f.advisoryOnly);
  for (const f of trusted) {
    const e = byRule.get(f.label) ?? { n: 0, rows: [] };
    e.n++;
    if (e.rows.length < 3) e.rows.push(i);
    byRule.set(f.label, e);
    if (WATCH.test(f.label)) {
      watched.push({ i, label: f.label, matched: (f.matched ?? "").slice(0, 80), text: r.text.replace(/\s+/g, " ").slice(0, 130) });
    }
  }
});

const sorted = [...byRule.entries()].sort((a, b) => b[1].n - a[1].n);
console.log("benign FPs by trusted rule (applied state):");
for (const [label, e] of sorted.slice(0, 20)) {
  console.log(`  ${String(e.n).padStart(4)}  ${label.slice(0, 60).padEnd(62)} e.g. rows ${e.rows.join(",")}`);
}
console.log(`\n${sorted.length} distinct trusted rules produce benign FPs`);

console.log(`\nrules changed this pass, on benign rows: ${watched.length} fires`);
for (const w of watched.slice(0, 12)) {
  console.log(`  row ${w.i} [${w.label}] matched=${JSON.stringify(w.matched)}`);
  console.log(`      ${w.text}`);
}
if (!watched.length) {
  console.log("  none — the widened instruction-invalidation and narrowed optimizer rules");
  console.log("  cost zero benign rows, so the 17-row gap predates them.");
}
