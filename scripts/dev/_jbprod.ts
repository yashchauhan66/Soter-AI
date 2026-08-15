/** Do the rules-tier jailbreak misses survive the FULL production path (rules + ML)?
 *  The failing tests call analyzeText() directly, which is rules-only. Fixing a gap
 *  production does not have would be tuning to a harness, not hardening a product. */
import * as path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";
(async () => {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");
  if (resolveMlAugmentMode() === "off") { console.error("[FATAL] ML tier off"); process.exit(2); }
  const { JAILBREAK_EXPANDED } = await import("../../lib/classifiers/datasets/expanded/jailbreakExpanded");
  const rows = JAILBREAK_EXPANDED as Array<{id:string;text:string}>;
  let rulesHit=0, e2eHit=0; const stillMiss:string[]=[]; const byFam=new Map<string,{n:number;r:number;e:number}>();
  for (const r of rows) {
    const before:any = analyzeText(r.text, "INPUT");
    const after:any = await augmentWithMl(before, r.text, "INPUT");
    const rh = before.action !== "ALLOW", eh = after.action !== "ALLOW";
    if (rh) rulesHit++; if (eh) e2eHit++; if (!eh) stillMiss.push(r.id);
    const n=Number(r.id.split("-")[1]), s=Math.floor((n-1)/30)*30+1, k=`jb-${s}..${s+29}`;
    const t=byFam.get(k)??{n:0,r:0,e:0}; t.n++; if(rh)t.r++; if(eh)t.e++; byFam.set(k,t);
  }
  const p=(a:number,b:number)=>((a/b)*100).toFixed(1);
  console.log(`\nrules-only  ${p(rulesHit,rows.length)}%    production (rules+ML)  ${p(e2eHit,rows.length)}%   n=${rows.length}`);
  console.log(`\nper family:`);
  for (const [k,t] of [...byFam].sort()) console.log(`  ${k}  rules ${p(t.r,t.n).padStart(5)}%   prod ${p(t.e,t.n).padStart(5)}%${t.e<t.n?`   STILL MISSING ${t.n-t.e}`:""}`);
  console.log(`\nsurvives full production path (real gap): ${stillMiss.length}`);
  if (stillMiss.length) console.log("  " + stillMiss.join(", "));
})();
