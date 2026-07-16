import { existsSync } from "node:fs";

import { ENTERPRISE_PROOF_KIT, summarizeProofKit } from "../lib/enterprise/proofKit";

const requiredIds = new Set([
  "honest-benchmark",
  "independent-benchmark",
  "external-pentest",
  "load-proof",
  "razorpay-proof",
  "saml-proof",
  "scim-proof",
  "tenant-isolation-proof",
  "runtime-marketplace-proof",
  "support-ops-proof",
]);

const failures: string[] = [];
const ids = new Set<string>();

for (const item of ENTERPRISE_PROOF_KIT) {
  if (ids.has(item.id)) failures.push(`Duplicate proof id: ${item.id}`);
  ids.add(item.id);
  if (!requiredIds.has(item.id)) failures.push(`Unexpected proof id: ${item.id}`);
  if (!item.label.trim()) failures.push(`${item.id} has no label`);
  if (!item.evidencePath.trim()) failures.push(`${item.id} has no evidence path`);
  if (!existsSync(item.evidencePath)) failures.push(`${item.id} evidence path does not exist: ${item.evidencePath}`);
  if (item.passCriteria.length < 3) failures.push(`${item.id} needs at least three pass criteria`);
  if (item.blocks.length === 0) failures.push(`${item.id} must block at least one readiness dimension`);
}

for (const id of requiredIds) {
  if (!ids.has(id)) failures.push(`Missing proof id: ${id}`);
}

const summary = summarizeProofKit();
if (summary.readinessScore < 70) failures.push(`Proof kit readiness score too low: ${summary.readinessScore}`);
if (summary.externalVendorRequired < 1) failures.push("External vendor requirement must remain explicit");
if (summary.needsEnvironment < 1) failures.push("Live environment requirements must remain explicit");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Enterprise proof kit valid: ${summary.readinessScore}/100 proof-readiness score across ${summary.total} items.`);
