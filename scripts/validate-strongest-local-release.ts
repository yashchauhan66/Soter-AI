import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface Step {
  id: string;
  command: string;
  args: string[];
  required: boolean;
}

interface StepResult extends Step {
  status: "PASS" | "FAIL";
  durationMs: number;
  exitCode: number | null;
}

const steps: Step[] = [
  { id: "root-typecheck", command: "npm", args: ["run", "typecheck"], required: true },
  { id: "guard-core-typecheck", command: "npm", args: ["--prefix", "packages/guard-core", "run", "typecheck"], required: true },
  { id: "guard-core-test", command: "npm", args: ["--prefix", "packages/guard-core", "run", "test"], required: true },
  { id: "guard-core-build", command: "npm", args: ["--prefix", "packages/guard-core", "run", "build"], required: true },
  { id: "broker-typecheck", command: "npm", args: ["--prefix", "apps/local-ai-broker", "run", "typecheck"], required: true },
  { id: "broker-test", command: "npm", args: ["--prefix", "apps/local-ai-broker", "run", "test"], required: true },
  { id: "vscode-extension-typecheck", command: "npm", args: ["--prefix", "packages/vscode-extension", "run", "typecheck"], required: true },
  { id: "vscode-extension-test", command: "npm", args: ["--prefix", "packages/vscode-extension", "run", "test"], required: true },
  { id: "vscode-extension-build", command: "npm", args: ["--prefix", "packages/vscode-extension", "run", "build"], required: true },
  { id: "vscode-isolated-install", command: "node", args: ["scripts/test-vscode-family.mjs", "code"], required: true },
  { id: "manifest-permissions", command: "npm", args: ["run", "validate:extension-permissions"], required: true },
  { id: "dependency-audit-high", command: "npm", args: ["audit", "--audit-level=high"], required: true },
  { id: "full-test-suite", command: "npm", args: ["test"], required: true },
  { id: "security-99-evidence-advisory", command: "npm", args: ["run", "validate:security-99"], required: true },
  { id: "security-100-evidence-advisory", command: "npm", args: ["run", "validate:security-100"], required: true },
];

const startedAt = new Date().toISOString();
const results: StepResult[] = [];

for (const step of steps) {
  const started = Date.now();
  console.log(`\n[strongest-local] ${step.id}: ${step.command} ${step.args.join(" ")}`);
  const child = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  const result: StepResult = {
    ...step,
    status: child.status === 0 ? "PASS" : "FAIL",
    durationMs: Date.now() - started,
    exitCode: child.status,
  };
  results.push(result);
  if (result.status === "FAIL" && step.required) break;
}

const security99 = readJson("reports/security-99-evidence-gates.json");
const security100 = readJson("reports/security-100-evidence-gates.json");
const failed = results.filter((result) => result.status === "FAIL");
const passed = results.length - failed.length;
const completedAt = new Date().toISOString();
const outDir = path.join(process.cwd(), "reports");
mkdirSync(outDir, { recursive: true });

const report = {
  generatedAt: completedAt,
  startedAt,
  completedAt,
  localGatePassed: failed.length === 0,
  passed,
  total: results.length,
  results,
  claimEligibility: {
    security99Score: numberValue(security99?.score),
    canClaim99Plus: Boolean(security99?.canClaim99Plus),
    security100Score: numberValue(security100?.score),
    canClaim100: Boolean(security100?.canClaim100),
  },
};

writeFileSync(path.join(outDir, "strongest-local-release-gate.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(path.join(outDir, "strongest-local-release-gate.md"), renderMarkdown(report), "utf8");

console.log(`\n[strongest-local] ${failed.length === 0 ? "PASS" : "FAIL"}: ${passed}/${results.length} required local steps passed.`);
console.log(`[strongest-local] Security 99 score: ${report.claimEligibility.security99Score ?? "unknown"}/100, claim allowed: ${report.claimEligibility.canClaim99Plus ? "yes" : "no"}`);
console.log(`[strongest-local] Security 100 score: ${report.claimEligibility.security100Score ?? "unknown"}/100, claim allowed: ${report.claimEligibility.canClaim100 ? "yes" : "no"}`);
console.log("[strongest-local] Reports written: reports/strongest-local-release-gate.json and reports/strongest-local-release-gate.md");

if (failed.length > 0) process.exit(1);

function readJson(relativePath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function renderMarkdown(value: typeof report): string {
  const lines = [
    "# Strongest Local Release Gate",
    "",
    `Generated: ${value.generatedAt}`,
    "",
    `- Local gate passed: **${value.localGatePassed ? "yes" : "no"}**`,
    `- Required local steps passed: **${value.passed}/${value.total}**`,
    `- Security 99 score: **${value.claimEligibility.security99Score ?? "unknown"}/100**`,
    `- 99+ claim allowed: **${value.claimEligibility.canClaim99Plus ? "yes" : "no"}**`,
    `- Security 100 score: **${value.claimEligibility.security100Score ?? "unknown"}/100**`,
    `- 100/100 claim allowed: **${value.claimEligibility.canClaim100 ? "yes" : "no"}**`,
    "",
    "| Step | Status | Command | Duration ms |",
    "| --- | --- | --- | --- |",
    ...value.results.map((result) => `| ${result.id} | ${result.status} | \`${result.command} ${result.args.join(" ")}\` | ${result.durationMs} |`),
    "",
    "This local gate proves build, test, packaging, audit, and isolated VS Code install health. It does not replace external pentest, live deployment, signed provenance, OS enforcement, enterprise extension-control, or recovery-drill attestations.",
    "",
  ];
  return lines.join("\n");
}
