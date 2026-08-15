/**
 * The standalone "completeness demand" conjunct measured 2 benign / 30 attacks,
 * lift 40.30 — it acts alone under fusion and catches 15x more attacks than the
 * academic-AND-completeness conjunction (2 attacks). Before accepting it, the two
 * benign fires have to be read: a lift of 40 is not a licence to accuse ordinary
 * requests, and "give me the full details" is a thing real users say.
 *
 * Prints both benign fires in full plus a sample of the attacks, so the rule is
 * judged on the text it acts on rather than on its ratio.
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);

const COMPLETENESS = String.raw`(?:complete|full|entire|exact|precise|detailed|step[\s-]by[\s-]step|verbatim|unabridged|unredacted|whole)\s+(?:the\s+)?(?:method|methodology|procedure|protocol|process|recipe|synthesis|route|instructions?|steps?|write[\s-]?up|details?|specifications?|formulation)`;
const REPRODUCE = String.raw`(?:reproduce|replicate|recreate|reconstruct|provide|give|supply|output|write out|spell out|lay out)\s+(?:it|them|this|that|the\s+\w+)?\s*(?:fully|completely|in full|verbatim|in\s+(?:complete|full)\s+detail|entirely|without\s+(?:omission|redaction|abridgement))`;
const DEMAND = String.raw`(?:demands?|requires?|needs?|necessitates?|calls for|mandates?)\s+(?:the\s+|a\s+|an\s+)?(?:complete|full|entire|exact|precise|detailed|unredacted|verbatim)`;

const re = new RegExp(`(?:${COMPLETENESS}|${REPRODUCE}|${DEMAND})`, "i");

const ben: { i: number; text: string; m: string }[] = [];
const atk: { i: number; label: string; m: string }[] = [];
rows.forEach((r, i) => {
  const m = re.exec(r.text);
  if (!m) return;
  if (isB(r.label)) ben.push({ i, text: r.text.replace(/\s+/g, " "), m: m[0] });
  else atk.push({ i, label: r.label, m: m[0] });
});

console.log(`BENIGN FIRES (${ben.length}) — read these, they decide the rule:`);
for (const x of ben) {
  console.log(`\n  row ${x.i}  matched=${JSON.stringify(x.m)}`);
  console.log(`    ${x.text.slice(0, 320)}`);
}

console.log(`\n\nATTACK FIRES (${atk.length}), first 14:`);
for (const x of atk.slice(0, 14)) {
  console.log(`  row ${String(x.i).padStart(4)} [${x.label.slice(0, 26).padEnd(26)}] matched=${JSON.stringify(x.m)}`);
}

const byLabel = new Map<string, number>();
for (const x of atk) byLabel.set(x.label, (byLabel.get(x.label) ?? 0) + 1);
console.log("\nattack labels covered:");
for (const [l, n] of [...byLabel.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${l}`);
}
