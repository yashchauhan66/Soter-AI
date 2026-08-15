/**
 * Which crossdist BENIGN rows does academicPretextDetector fire on, and what does
 * the rest of the guard already say about them?
 *
 * The eval reports an aggregate FPR delta. That number cannot distinguish "one
 * unlucky row" from "a systematic pattern in ordinary prose", and only the second
 * is a reason to abandon the detector. So this prints the rows themselves.
 */
import { readFileSync } from "node:fs";
import { academicPretextDetector } from "../../lib/guard/detectors/academicPretextDetector";
import { analyzeText } from "../../lib/guard/analyze";

type Row = { text: string; label: string; source?: string };

const rows: Row[] = readFileSync("datasets/crossdist-eval-v3.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);

const isBenign = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const benign = rows.filter((r) => isBenign(r.label));
const attacks = rows.filter((r) => !isBenign(r.label));

let bFire = 0, aFire = 0;
const hits: Array<{ text: string; source?: string; actionNow: string }> = [];
for (const r of benign) {
  if (!academicPretextDetector(r.text).length) continue;
  bFire++;
  const res: any = analyzeText(r.text, "INPUT");
  hits.push({ text: r.text, source: r.source, actionNow: `${res.action}/${res.riskScore ?? 0}` });
}
for (const r of attacks) if (academicPretextDetector(r.text).length) aFire++;

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(2) : "0.00");
console.log(`\nbenign rows ${benign.length}   attack rows ${attacks.length}`);
console.log(`detector fires on benign ${bFire} (${pct(bFire, benign.length)}%)`);
console.log(`detector fires on attack ${aFire} (${pct(aFire, attacks.length)}%)`);
const lift = bFire ? (aFire / attacks.length) / (bFire / benign.length) : Infinity;
console.log(`lift ${Number.isFinite(lift) ? lift.toFixed(1) + "x" : "inf (never fired on benign)"}`);
console.log(`fuseEvidence would ${bFire / benign.length <= 0.001 || lift >= 10 ? "TRUST this rule to act alone" : "DEMOTE this rule to advisory"}\n`);

for (const h of hits) {
  console.log(`[${h.actionNow}] ${h.source ?? "?"}`);
  console.log(`   ${h.text.slice(0, 220).replace(/\s+/g, " ")}`);
}
