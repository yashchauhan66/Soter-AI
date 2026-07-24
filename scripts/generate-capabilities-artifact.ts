// Generates artifacts/security/capabilities.json from the single-source-of-truth
// CapabilityRegistry. Refuses to write a dishonest artifact: if the registry
// violates the honesty invariant, this exits non-zero and writes nothing.
//
// Run: npx tsx scripts/generate-capabilities-artifact.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertHonestLevels, capabilitiesSnapshot } from "../packages/guard-core/src/CapabilityRegistry";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const outPath = resolve(repoRoot, "artifacts/security/capabilities.json");

// Fail closed: never emit an artifact that overstates protection.
assertHonestLevels();

const snapshot = capabilitiesSnapshot();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

console.log(`Wrote ${snapshot.capabilities.length} capabilities (honest=${snapshot.honest}) to ${outPath}`);
console.log("Level distribution:", JSON.stringify(snapshot.counts));
