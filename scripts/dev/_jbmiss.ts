import { analyzeText } from "../../lib/guard/analyze";
import { JAILBREAK_EXPANDED } from "../../lib/classifiers/datasets/expanded/jailbreakExpanded";
const rows = JAILBREAK_EXPANDED as Array<{id:string;text:string}>;
const miss = rows.filter(r => { const v:any = analyzeText(r.text, "INPUT"); return v.action === "ALLOW"; });
console.log(`corpus ${rows.length}  miss ${miss.length}  recall ${(100*(1-miss.length/rows.length)).toFixed(1)}%`);
const fam = new Map<string,number>();
for (const m of miss) { const n = Number(m.id.split("-")[1]); const s = Math.floor((n-1)/30)*30+1; fam.set(`jb-${s}..${s+29}`,(fam.get(`jb-${s}..${s+29}`)??0)+1); }
console.log("misses by 30-block (= corpus family):"); for (const [k,v] of [...fam].sort()) console.log(`  ${k}  ${v}`);
console.log("\nall misses:"); for (const m of miss) console.log(`  ${m.id}  ${m.text.slice(0,105)}`);
