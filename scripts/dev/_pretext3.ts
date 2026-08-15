/**
 * Does the completeness-demand signal add DETECTION, or only fire on rows the guard
 * already blocks?
 *
 * Lift 40.30 is not a licence to ship it standalone. Its benign fires include "Give
 * step by step instructions on how to make a Long Island Ice Tea" — and this corpus's
 * benign split is Dolly-style extraction QA, which under-represents how-to requests
 * badly. In production "step by step instructions" is one of the most common benign
 * asks, so the true benign rate is much higher than 2/5000 here. Corpus lift measured
 * on an unrepresentative benign distribution is exactly the trap that produces a
 * number that looks strong and a product that accuses users.
 *
 * So the decision rests on marginal value: of the 30 attack rows this signal fires on,
 * how many does the production path currently MISS? If they are already blocked, the
 * rule buys nothing and costs real-world precision — reject it. If a meaningful set is
 * uncovered, it is worth shipping in the narrowest form that reaches them.
 */
import { readFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);

const COMPLETENESS = String.raw`(?:complete|full|entire|exact|precise|detailed|step[\s-]by[\s-]step|verbatim|unabridged|unredacted|whole)\s+(?:the\s+)?(?:method|methodology|procedure|protocol|process|recipe|synthesis|route|instructions?|steps?|write[\s-]?up|details?|specifications?|formulation)`;
const REPRODUCE = String.raw`(?:reproduce|replicate|recreate|reconstruct|provide|give|supply|output|write out|spell out|lay out)\s+(?:it|them|this|that|the\s+\w+)?\s*(?:fully|completely|in full|verbatim|in\s+(?:complete|full)\s+detail|entirely|without\s+(?:omission|redaction|abridgement))`;
const DEMAND = String.raw`(?:demands?|requires?|needs?|necessitates?|calls for|mandates?)\s+(?:the\s+|a\s+|an\s+)?(?:complete|full|entire|exact|precise|detailed|unredacted|verbatim)`;
const re = new RegExp(`(?:${COMPLETENESS}|${REPRODUCE}|${DEMAND})`, "i");

let covered = 0;
const uncovered: { i: number; label: string; m: string; text: string }[] = [];

rows.forEach((r, i) => {
  if (isB(r.label)) return;
  const m = re.exec(r.text);
  if (!m) return;
  let action = "ERR";
  try {
    action = (analyzeText(r.text, "INPUT") as { action: string }).action;
  } catch { /* ignore */ }
  if (action === "ALLOW") {
    uncovered.push({ i, label: r.label, m: m[0], text: r.text.replace(/\s+/g, " ") });
  } else {
    covered++;
  }
});

console.log(`attack rows the completeness signal fires on: ${covered + uncovered.length}`);
console.log(`  already blocked/rewritten by production: ${covered}`);
console.log(`  currently ALLOW (marginal value):        ${uncovered.length}`);
for (const u of uncovered) {
  console.log(`\n  row ${u.i} [${u.label}] matched=${JSON.stringify(u.m)}`);
  console.log(`    ${u.text.slice(0, 260)}`);
}
if (!uncovered.length) {
  console.log("\nVERDICT: zero marginal detection. The signal fires only on rows already");
  console.log("caught by other rules, so shipping it adds real-world false accusations");
  console.log("(cocktail recipes, Copilot feature questions) for no coverage gain. REJECT.");
}
