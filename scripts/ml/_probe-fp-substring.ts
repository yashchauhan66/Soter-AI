/**
 * Show the EXACT substring each false-positive rule matched.
 *
 * WHY
 *   diagnose-fpr.ts says "Emergency authority pressure fired on a question about
 *   a Haitian politician". That is the symptom. The repair depends entirely on
 *   WHICH characters matched: a missing \b is a one-character fix, an over-broad
 *   alternation is a rule rewrite, and a genuinely ambiguous prompt is neither.
 *
 *   npx tsx scripts/ml/_probe-fp-substring.ts
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string; source?: string };

// The exact patterns diagnose-fpr.ts attributed the most FPs to, copied verbatim
// from the detectors so this probe reads the same regex production does.
const SUSPECTS: Array<{ file: string; label: string; re: RegExp }> = [
  {
    file: "promptInjectionDetector.ts:71",
    label: "Emergency authority pressure",
    re: /(?:professional|doctor|nurse|police officer|law enforcement|government|hostage|icu|patient).{0,180}(?:die|lives depend|every second|immediately|exact lethal dosage|specific chemical formula)/i,
  },
];

const rows: Row[] = readFileSync("datasets/crossdist-eval-v2.jsonl", "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Row)
  .filter((r) => r.label === "SAFE");

for (const s of SUSPECTS) {
  console.log(`\n=== ${s.label}  (${s.file}) ===`);
  let hits = 0;
  for (const r of rows) {
    const m = s.re.exec(r.text);
    if (!m) continue;
    hits += 1;
    if (hits > 6) continue;
    // Which alternative in each group actually matched: that is the defect.
    const matched = m[0].replace(/\s+/g, " ");
    console.log(`\n  MATCHED: "${matched.slice(0, 150)}"`);
    console.log(`  in     : "${r.text.slice(0, 100).replace(/\s+/g, " ")}..."`);
  }
  console.log(`\n  total benign rows matched: ${hits}/${rows.length}`);
}
