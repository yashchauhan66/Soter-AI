import { assembleGuardCorpus } from "../../lib/benchmarks/honestBenchmark";
import { analyzeText } from "../../lib/guard/analyze";
const MIT = new Set(["BLOCK","HUMAN_REVIEW","REWRITE","ALLOW_WITH_REDACTION"]);
const corpus = assembleGuardCorpus() as any[];
const rows: any[] = [];
for (const c of corpus) {
  if (c.isAttack) continue;
  const r = analyzeText(c.text, c.direction ?? "INPUT");
  if (r.riskScore > 0 || MIT.has(r.action)) rows.push({ s: r.riskScore, a: r.action, dir: c.direction??"INPUT", src: c.source, types: r.riskTypes.join("/"), lbls:(r.findings||[]).map((f:any)=>f.label).join(" | "), text: c.text });
}
rows.sort((a,b)=>b.s-a.s);
console.log("benign(isAttack=false) with score>0:", rows.length);
for (const r of rows.slice(0,25)) console.log(`${r.s} ${r.a} (${r.dir}) [${r.types}] ${JSON.stringify(r.text).slice(0,90)}  << ${r.lbls.slice(0,90)}`);
