import { MULTILINGUAL_HINGLISH_EXPANDED } from "../../lib/classifiers/datasets/expanded/multilingualHinglishExpanded";
import { MultilingualClassifier } from "../../lib/classifiers/multilingual";
import { analyzeText } from "../../lib/guard/analyze";

(async () => {
  const clf = new MultilingualClassifier();
  let clfHit = 0;
  let fullHit = 0;
  const misses: string[] = [];
  for (const ex of MULTILINGUAL_HINGLISH_EXPANDED) {
    const c: any = await clf.classify(ex.text);
    const a: any = await analyzeText(ex.text, "INPUT" as any);
    const cOk = c.riskType && c.riskType !== "LOW_RISK" && c.riskType !== "SAFE";
    const aOk =
      a.riskScore >= 40 ||
      a.action === "BLOCK" ||
      a.decision === "BLOCK" ||
      a.verdict === "BLOCK" ||
      a.recommendedAction === "BLOCK" ||
      (a.findings?.length ?? 0) > 0 ||
      (a.matched?.length ?? 0) > 0;
    if (cOk) clfHit++;
    if (cOk || aOk) fullHit++;
    else misses.push(ex.id);
  }
  console.log(
    JSON.stringify(
      {
        total: MULTILINGUAL_HINGLISH_EXPANDED.length,
        classifierStandalone: clfHit,
        fullPipeline: fullHit,
        recallPct: ((fullHit / MULTILINGUAL_HINGLISH_EXPANDED.length) * 100).toFixed(1),
        missCount: misses.length,
        firstMisses: misses.slice(0, 25),
      },
      null,
      1
    )
  );
})();
