import { analyzeText } from "../../lib/guard/analyze";
const text = process.argv[2];
const dir = (process.argv[3] as any) || "INPUT";
const r = analyzeText(text, dir);
console.log("ACTION", r.action, "SCORE", r.riskScore, "TYPES", r.riskTypes.join(","));
console.log("FINDINGS:", JSON.stringify(r.findings?.map((f:any)=>({t:f.type,l:f.label,s:f.score})), null, 1));
