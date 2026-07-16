import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluateSecurity99Evidence } from "../lib/enterprise/securityEvidenceGate";

const strict = process.argv.includes("--strict");
const result = evaluateSecurity99Evidence();
const outDir = path.join(process.cwd(), "reports");
mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, "security-99-evidence-gates.json");
writeFileSync(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, "utf8");

const lines = [
  "# Security 99 Evidence Gates",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- Evidence-gated score: **${result.score}/100**`,
  `- 99+ claim allowed: **${result.canClaim99Plus ? "yes" : "no"}**`,
  "",
  "| Gate | Status | Evidence | Reason |",
  "| --- | --- | --- | --- |",
  ...result.gates.map((gate) => `| ${gate.label} | ${gate.status} | \`${gate.evidencePath}\` | ${gate.reason} |`),
  "",
  "## Next Actions",
  "",
  ...(result.nextActions.length ? result.nextActions.map((action) => `- ${action}`) : ["- None. All security 99 gates passed."]),
  "",
];

const mdPath = path.join(outDir, "security-99-evidence-gates.md");
writeFileSync(mdPath, lines.join("\n"), "utf8");

console.log(`Security evidence score: ${result.score}/100`);
console.log(`99+ claim allowed: ${result.canClaim99Plus ? "yes" : "no"}`);
console.log(`JSON written: ${path.relative(process.cwd(), jsonPath)}`);
console.log(`Markdown written: ${path.relative(process.cwd(), mdPath)}`);

if (strict && !result.canClaim99Plus) {
  process.exit(1);
}
