/**
 * Recall @ fixed-FPR harness — the SAME metric competitors report
 * (Meta PromptGuard-2: recall@1%FPR; Lakera PINT: accuracy).
 *
 * Prior benchmarks measured a single fixed operating point (the shipped gate).
 * That is not comparable to a vendor's "recall @ 1% FPR", which is a POINT ON A
 * ROC CURVE: pick the score threshold that yields exactly 1% false positives on
 * benign traffic, then read recall on attacks at that threshold.
 *
 * We build ONE continuous risk score per input by FUSING the two tiers SoterAI
 * has that a single classifier does not:
 *   - rules/agentic score: GuardResult.riskScore / 100   (0..1)
 *   - ML attack probability: 1 - P(SAFE) from the ONNX classifier (0..1)
 * fused = max(rules, ml)   — union: either tier flagging raises the score.
 *
 * Then sweep the threshold over benign scores to hit target FPRs and report
 * recall + ROC-AUC. AUC is threshold-independent, so it is the fairest single
 * headline for "how good is the detector".
 *
 *   npx tsx scripts/guard-benchmark/recall-at-fpr.ts
 */
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_UNTUNED_ATTACKS } from "./_heldout-corpora";
import { FRESH_ATTACKS, FRESH_BENIGN } from "./_fresh-heldout-2026-07-20";

async function main() {
  const backend = new ONNXClassifierBackend({
    modelPath: process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v3/model.onnx",
    labelsPath: process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v3/labels.json",
    confidenceFloor: 0, // we want raw probabilities, not the gated label
  });

  // Fused continuous score in [0,1].
  async function score(text: string): Promise<{ rules: number; ml: number; fused: number }> {
    const rules = Math.max(0, Math.min(100, analyzeText(text, "INPUT").riskScore)) / 100;
    const inf = await backend.infer(text, "INPUT");
    const probs = (inf.raw?.probabilities as number[] | undefined) ?? [];
    // INPUT-direction ML score = probability mass on the input-attack classes
    // only (injection / jailbreak / system-prompt-leak). We deliberately EXCLUDE
    // UNSAFE_OUTPUT / DATA_EXFILTRATION / PII / SECRET / RAG_POISONING here:
    // those are OUTPUT-direction concerns, and the v3 model confidently
    // mislabels benign INPUT (code-gen, non-English prose) into them, which
    // otherwise poisons the benign FPR threshold. This mirrors the shipped
    // gate's RELIABLE_LABELS. labels: 1=PROMPT_INJECTION 2=JAILBREAK 3=SPL.
    let ml: number;
    if (probs.length >= 4) {
      ml = probs[1] + probs[2] + probs[3];
    } else {
      const attack = inf.predictedLabel === "PROMPT_INJECTION" ||
        inf.predictedLabel === "JAILBREAK" ||
        inf.predictedLabel === "SYSTEM_PROMPT_LEAK_ATTEMPT";
      ml = attack ? inf.confidence : 0;
    }
    ml = Math.max(0, Math.min(1, ml));
    return { rules, ml, fused: Math.max(rules, ml) };
  }

  const benignTexts = [
    ...(BENIGN_CONTROL_EXPANDED as { text: string; direction?: string }[])
      .filter((c) => (c.direction ?? "INPUT") === "INPUT")
      .map((c) => c.text),
    ...FRESH_BENIGN,
  ];

  const attackSets: Record<string, string[]> = {
    "fresh-untuned (26)": FRESH_ATTACKS,
    "heldout (54)": HELDOUT_UNTUNED_ATTACKS,
  };

  // Precompute scores.
  const benign = { rules: [] as number[], ml: [] as number[], fused: [] as number[] };
  for (const t of benignTexts) {
    const s = await score(t);
    benign.rules.push(s.rules); benign.ml.push(s.ml); benign.fused.push(s.fused);
  }

  function thresholdAtFpr(benignScores: number[], targetFpr: number): number {
    // smallest threshold T such that (#benign >= T)/N <= targetFpr
    const sorted = [...benignScores].sort((a, b) => b - a); // desc
    const allowedFalse = Math.floor(targetFpr * sorted.length);
    // threshold just above the (allowedFalse)-th highest benign score
    const idx = allowedFalse; // 0-based: this many benign may exceed T
    const ref = sorted[idx] ?? -Infinity;
    return ref + 1e-9;
  }

  function recallAt(attackScores: number[], threshold: number): number {
    const hit = attackScores.filter((s) => s >= threshold).length;
    return hit / attackScores.length;
  }

  // Mann-Whitney U → ROC-AUC (prob a random attack scores above a random benign)
  function auc(attackScores: number[], benignScores: number[]): number {
    let wins = 0;
    for (const a of attackScores) for (const b of benignScores) {
      if (a > b) wins += 1; else if (a === b) wins += 0.5;
    }
    return wins / (attackScores.length * benignScores.length);
  }

  const tiers: Array<keyof typeof benign> = ["rules", "ml", "fused"];
  for (const [name, atks] of Object.entries(attackSets)) {
    const aScores = { rules: [] as number[], ml: [] as number[], fused: [] as number[] };
    for (const t of atks) {
      const s = await score(t);
      aScores.rules.push(s.rules); aScores.ml.push(s.ml); aScores.fused.push(s.fused);
    }
    console.log(`\n=== Attack set: ${name}  vs  ${benignTexts.length} benign ===`);
    for (const tier of tiers) {
      const t1 = thresholdAtFpr(benign[tier], 0.01);
      const t5 = thresholdAtFpr(benign[tier], 0.05);
      const r1 = recallAt(aScores[tier], t1);
      const r5 = recallAt(aScores[tier], t5);
      const a = auc(aScores[tier], benign[tier]);
      console.log(
        `  ${tier.padEnd(6)}  ROC-AUC ${a.toFixed(3)}   ` +
        `Recall@1%FPR ${(100 * r1).toFixed(1)}%   Recall@5%FPR ${(100 * r5).toFixed(1)}%`,
      );
    }
  }

  console.log(`\n(competitor refs: PromptGuard-2 86M 97.5% / 22M 88.7% recall@1%FPR; Lakera PINT 95.2% acc)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
