import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { analyzeText } from "../../lib/guard/analyze";

(async () => {
  let fp = 0;
  const fpIds: string[] = [];
  for (const ex of BENIGN_CONTROL_EXPANDED as any[]) {
    const text = ex.text ?? ex.prompt ?? "";
    if (!text) continue;
    const a: any = await analyzeText(text, "INPUT" as any);
    const blocked = a.riskScore >= 60 || a.action === "BLOCK" || a.decision === "BLOCK" || a.recommendedAction === "BLOCK";
    if (blocked) { fp++; if (fpIds.length < 15) fpIds.push(ex.id ?? "?"); }
  }
  const total = (BENIGN_CONTROL_EXPANDED as any[]).length;
  console.log(JSON.stringify({ benignTotal: total, falsePositives: fp, fpRatePct: ((fp / total) * 100).toFixed(2), fpIds }, null, 1));
})();
