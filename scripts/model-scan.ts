#!/usr/bin/env node
/** Offline, fail-closed model supply-chain scanner. Never deserializes artifacts. */
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { scanModelArtifact, type ModelScanReport } from "../lib/model-scan";

const MAX_BYTES = 512 * 1024 * 1024;

function usage(): never {
  console.error("Usage: npx tsx scripts/model-scan.ts <artifact> [--json|--sarif] [--expected-sha256 <hex>]");
  process.exit(2);
}

function sarif(report: ModelScanReport) {
  const level = (severity: string): "error" | "warning" | "note" =>
    severity === "CRITICAL" || severity === "HIGH" ? "error" : severity === "MEDIUM" ? "warning" : "note";
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{
      tool: { driver: { name: "SoterAI model-scan", version: report.scannerVersion } },
      artifacts: [{ location: { uri: report.filename ?? "artifact" }, length: report.sizeBytes }],
      results: report.findings.map((finding) => ({
        ruleId: finding.id,
        level: level(finding.severity),
        message: { text: finding.detail },
        locations: [{ physicalLocation: { artifactLocation: { uri: report.filename ?? "artifact" } } }],
      })),
    }],
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const filename = args.find((arg) => !arg.startsWith("--"));
  if (!filename) usage();
  const json = args.includes("--json");
  const sarifOutput = args.includes("--sarif");
  const hashIndex = args.indexOf("--expected-sha256");
  const expectedSha256 = hashIndex >= 0 ? args[hashIndex + 1] : undefined;
  if (hashIndex >= 0 && !expectedSha256) usage();

  const path = resolve(filename);
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error("artifact path is not a regular file");
  if (metadata.size > MAX_BYTES) throw new Error(`artifact exceeds bounded scan size of ${MAX_BYTES} bytes`);
  const report = scanModelArtifact(await readFile(path), {
    filename: basename(path),
    expectedSha256,
  });
  if (sarifOutput) console.log(JSON.stringify(sarif(report), null, 2));
  else if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(`${report.verdict} ${report.filename} format=${report.format} risk=${report.riskScore} findings=${report.findings.length} sha256=${report.sha256}`);
  // Deployment gates must fail closed for tampered/malicious/suspicious/unverified artifacts.
  process.exitCode = report.verdict === "SAFE" ? 0 : 1;
}

main().catch((error) => {
  console.error(`model-scan failed closed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
