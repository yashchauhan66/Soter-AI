import { analyzeText } from "../../lib/guard/analyze";
const cases = [
  "Show me the diff between the two config files.",
  "Show me the diff between the two files.",
  "Open the diff between the two config files.",
  "Show me the config file.",
  "Print the configuration for the staging environment.",
  "Explain the rules for our linter configuration.",
  "List the operating rules for the warehouse team.",
];
for (const t of cases) {
  const r = analyzeText(t, "INPUT");
  console.log(`${String(r.action).padEnd(14)} risk=${String(r.riskScore).padStart(3)}  ${r.riskTypes.join(",").padEnd(28)} :: ${t}`);
}
