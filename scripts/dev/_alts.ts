/**
 * Which alternative inside a rule is doing the damage?
 *
 * A rule with lift 0 is not uniformly bad — it is usually one or two alternatives
 * that fire on ordinary prose while the rest never fire at all. Splitting the
 * alternation and scoring each branch separately says which to cut, instead of
 * guessing or deleting the whole rule.
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const nb = rows.filter((r) => isB(r.label)).length;
const na = rows.length - nb;

function score(re: RegExp) {
  let b = 0, a = 0;
  for (const r of rows) if (re.test(r.text)) { if (isB(r.label)) b++; else a++; }
  return { b, a, lift: b === 0 ? Infinity : (a / na) / (b / nb) };
}

const RULES: Record<string, string[]> = {
  "Chemistry dual-use evasion": [
    "synthesis pathway", "energetic organic compounds", "rapid exothermic oxidation",
    "exact synthesis steps", "dangerous reactions", "quantities", "exact recipe",
  ],
  "Cyber dual-use evasion": [
    "technical methodology", "unauthorized access", "restricted computational infrastructure",
    "working proof-of-concept exploit", "specific attack would be executed", "full technical detail",
  ],
  "Medical toxicity evasion": [
    "pharmacological mechanism", "iatrogenic respiratory depression", "therapeutic margins",
    "exact LD50", "lethal dose", "administration method", "dosage combinations",
  ],
  "Abstract harm evasion": [
    "non-consensual biometric data collection", "population scale", "mass surveillance",
    "information hazard theory", "canonical example", "instantiating one",
    "catastrophic harm", "all relevant state variables",
  ],
};

for (const [label, alts] of Object.entries(RULES)) {
  const whole = score(new RegExp(`(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i"));
  console.log(`\n=== ${label}`);
  console.log(`    WHOLE RULE   ben ${String(whole.b).padStart(3)}  atk ${String(whole.a).padStart(4)}  lift ${whole.lift === Infinity ? "inf" : whole.lift.toFixed(2)}`);
  const keep: string[] = [];
  for (const alt of alts) {
    const s = score(new RegExp(alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    const verdict = s.b === 0 && s.a === 0 ? "dead — never fires"
      : s.b > 0 && s.a === 0 ? "POISON — benign only"
      : s.lift >= 10 ? "good" : "weak";
    if (verdict === "good" || (verdict === "dead — never fires")) keep.push(alt);
    console.log(`      ${String(s.b).padStart(3)} / ${String(s.a).padStart(4)}  lift ${(s.lift === Infinity ? "inf" : s.lift.toFixed(1)).padStart(6)}  ${verdict.padEnd(20)} ${alt}`);
  }
  if (keep.length && keep.length < alts.length) {
    const pruned = score(new RegExp(`(?:${keep.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i"));
    console.log(`    AFTER PRUNE  ben ${String(pruned.b).padStart(3)}  atk ${String(pruned.a).padStart(4)}  lift ${pruned.lift === Infinity ? "inf" : pruned.lift.toFixed(2)}   (dropped: ${alts.filter((a) => !keep.includes(a)).join(", ")})`);
  }
}
