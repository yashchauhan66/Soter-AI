import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluateSecurity100Evidence } from "../lib/enterprise/security100EvidenceGate";

const strict = process.argv.includes("--strict");
const result = evaluateSecurity100Evidence();
const outDir = path.join(process.cwd(), "reports");
mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, "security-100-evidence-gates.json");
writeFileSync(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, "utf8");

const lines = [
  "# Security 100 Evidence Gates",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- Evidence-gated score: **${result.score}/100**`,
  `- 100/100 claim allowed: **${result.canClaim100 ? "yes" : "no"}**`,
  "",
  "| Gate | Status | Evidence | Reason |",
  "| --- | --- | --- | --- |",
  ...result.gates.map((gate) => `| ${gate.label} | ${gate.status} | \`${gate.evidencePath}\` | ${gate.reason} |`),
  "",
  "## Next Actions",
  "",
  ...(result.nextActions.length ? result.nextActions.map((action) => `- ${action}`) : ["- None. All security 100 gates passed."]),
  "",
];

const mdPath = path.join(outDir, "security-100-evidence-gates.md");
writeFileSync(mdPath, lines.join("\n"), "utf8");

console.log(`Security evidence score: ${result.score}/100`);
console.log(`100/100 claim allowed: ${result.canClaim100 ? "yes" : "no"}`);
console.log(`JSON written: ${path.relative(process.cwd(), jsonPath)}`);
console.log(`Markdown written: ${path.relative(process.cwd(), mdPath)}`);

if (strict && !result.canClaim100) {
  process.exit(1);
}
