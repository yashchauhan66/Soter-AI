import { HELDOUT_BLIND_WIDE } from "../../lib/classifiers/datasets/expanded/heldoutBlindWide";
import { MultilingualClassifier } from "../../lib/classifiers/multilingual";
import { analyzeText } from "../../lib/guard/analyze";

(async () => {
  const clf = new MultilingualClassifier();
  let hit = 0;
  const misses: { id: string; lang: string }[] = [];
  const byLang: Record<string, [number, number]> = {};
  for (const ex of HELDOUT_BLIND_WIDE) {
    const c: any = await clf.classify(ex.text);
    const a: any = await analyzeText(ex.text, "INPUT" as any);
    const cOk = c.riskType && c.riskType !== "LOW_RISK" && c.riskType !== "SAFE";
    const aOk =
      a.riskScore >= 40 || a.action === "BLOCK" || a.decision === "BLOCK" || a.recommendedAction === "BLOCK" ||
      (a.findings?.length ?? 0) > 0;
    byLang[ex.lang] = byLang[ex.lang] || [0, 0];
    byLang[ex.lang][1]++;
    if (cOk || aOk) { hit++; byLang[ex.lang][0]++; } else misses.push({ id: ex.id, lang: ex.lang });
  }
  const langs = Object.keys(byLang).sort();
  console.log(JSON.stringify({
    evalType: "HELD-OUT BLIND (independent corpus + ML classifier + full pipeline)",
    total: HELDOUT_BLIND_WIDE.length, detected: hit,
    recallPct: +((hit / HELDOUT_BLIND_WIDE.length) * 100).toFixed(1),
    languagesCovered: langs.length, perLang: byLang, misses,
  }, null, 1));
})();
