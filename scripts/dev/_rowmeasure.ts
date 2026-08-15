/**
 * Row-level recall/FPR over the full production rules path.
 *
 * Per-rule fire counts are the wrong unit for a boundary fix. _bfix.ts says
 * bounding "ied" costs the explosive rule 26 attack fires — but those were fake
 * fires ("dried", "married", "specified"), so the rule was never the reason those
 * rows were caught. What matters is whether the ROW is still blocked, by any rule,
 * because that is the unit the product is judged on.
 *
 * Prints one JSON line so a driver can diff two runs.
 */
import { readFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);

let tp = 0, fp = 0, nb = 0, na = 0;
const flagged: string[] = [];
rows.forEach((r, i) => {
  const benign = isB(r.label);
  if (benign) nb++; else na++;
  let action: string;
  try { action = analyzeText(r.text, "INPUT").action; } catch { return; }
  if (action === "ALLOW") return;
  flagged.push((benign ? "b" : "a") + i);
  if (benign) fp++; else tp++;
});

console.log(JSON.stringify({ recall: tp / na, fpr: fp / nb, tp, fp, na, nb, flagged }));
