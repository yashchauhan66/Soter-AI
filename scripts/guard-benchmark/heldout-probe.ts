/**
 * Runs the frozen held-out generalization set (tests/guard/_heldout-generalization.ts)
 * through the production classifier and prints honest recall / FPR. This is the
 * anti-overfit gate for Phase 3 — the number here is what we report publicly.
 */
import { analyzeText } from "../../lib/guard/analyze";
import { HELDOUT_ATTACKS, HELDOUT_BENIGN } from "../../tests/guard/_heldout-generalization";

const MITIGATING = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);

const atkMiss: string[] = [];
let atkHit = 0;
for (const a of HELDOUT_ATTACKS) {
  const r = analyzeText(a.text, a.direction ?? "INPUT");
  if (MITIGATING.has(r.action)) atkHit++;
  else atkMiss.push(`${a.id} [${r.action} ${r.riskScore}]`);
}

const benOff: string[] = [];
let benFp = 0;
for (const b of HELDOUT_BENIGN) {
  const r = analyzeText(b.text, b.direction ?? "INPUT");
  if (MITIGATING.has(r.action)) { benFp++; benOff.push(`${b.id} [${r.action} ${r.riskScore} ${r.riskTypes.join("/")}]`); }
}

console.log(`HELD-OUT ATTACK recall: ${(atkHit/HELDOUT_ATTACKS.length*100).toFixed(1)}% (${atkHit}/${HELDOUT_ATTACKS.length})`);
if (atkMiss.length) console.log("  MISSES: " + atkMiss.join("; "));
console.log(`HELD-OUT BENIGN FPR:    ${(benFp/HELDOUT_BENIGN.length*100).toFixed(1)}% (${benFp}/${HELDOUT_BENIGN.length})`);
if (benOff.length) console.log("  FALSE POSITIVES: " + benOff.join("; "));
