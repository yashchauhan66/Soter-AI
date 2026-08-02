// Compliance-as-code: generates SOC2 control-evidence report from capabilities.json
// Usage: node scripts/compliance/report.mjs  -> writes artifacts/security/soc2-control-report.md
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const caps = JSON.parse(readFileSync("artifacts/security/capabilities.json", "utf8"));
const TSC_MAP = {
  "credential-brokering": "CC6.1", "context-minimization": "C1.1", "content-safety": "CC7.1",
  "gateway-enforcement": "CC6.6", "mcp-enforcement": "CC6.6", "audit-evidence": "CC7.2",
};

const ts = new Date().toISOString();
let md = `# SoterAI — SOC2 Control Evidence Report (auto-generated)\n\n`;
md += `Generated: ${ts}\nRegistry: v${caps.generatedFor} · honest=${caps.honest}\n`;
md += `Evidence hash: ${createHash("sha256").update(JSON.stringify(caps)).digest("hex")}\n\n`;
md += `## Control inventory (${caps.capabilities.length} controls)\n\n`;
md += `| Capability | Level | TSC criterion | Pre-exec block | Test evidence | Known bypasses (disclosed) |\n|---|---|---|---|---|---|\n`;
for (const c of caps.capabilities) {
  md += `| ${c.id} | ${c.level} | ${TSC_MAP[c.category] ?? "CC-series"} | ${c.preExecutionBlock ? "yes" : "no"} | ${(c.evidenceTestIds ?? []).join(", ") || "—"} | ${(c.knownBypasses ?? []).length} |\n`;
}
md += `\n## Counts\n\n${Object.entries(caps.counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`;
md += `\n*This report is machine-generated from the honest capability registry. UNSUPPORTED and DETECTION_ONLY items are disclosed, not hidden — this is itself a SOC2 control-strength differentiator.*\n`;

mkdirSync("artifacts/security", { recursive: true });
writeFileSync("artifacts/security/soc2-control-report.md", md);
console.log("Wrote artifacts/security/soc2-control-report.md —", caps.capabilities.length, "controls");
