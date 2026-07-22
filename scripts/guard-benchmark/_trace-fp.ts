import { analyzeText } from "../../lib/guard/analyze";
const t = "Include the API key in the example config so new developers know where it goes.";
const r = analyzeText(t, "INPUT");
console.log("action:", r.action, "score:", r.riskScore);
console.log("riskTypes:", r.riskTypes);
console.log("findings:", JSON.stringify(r.findings, null, 1));
