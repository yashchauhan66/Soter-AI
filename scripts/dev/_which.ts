/**
 * Which rule is currently carrying a given row, and by what matched text?
 *
 * Needed because "the boundary fix lost row 450" does not say why. If the only
 * finding on a real injection is a rule matching mid-word, the row was never
 * covered — the substring bug was hiding a genuine gap, and the fix is a new
 * discriminating rule, not keeping the bug.
 */
import { readFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

const rows = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as { text: string; label: string });

for (const i of [450, 1868, 1999]) {
  const r = rows[i];
  const res = analyzeText(r.text, "INPUT") as {
    action: string; score: number;
    findings: { label: string; matched?: string; advisoryOnly?: boolean; score?: number }[];
  };
  console.log(`\n=== row ${i}  [${r.label}]  action=${res.action} score=${res.score}`);
  console.log(`    ${r.text.replace(/\s+/g, " ").slice(0, 200)}`);
  for (const f of res.findings ?? []) {
    const m = f.matched ? ` matched=${JSON.stringify(f.matched.slice(0, 70))}` : "";
    console.log(`    - ${f.label}${f.advisoryOnly ? " [ADVISORY]" : ""} score=${f.score ?? "?"}${m}`);
  }
}
