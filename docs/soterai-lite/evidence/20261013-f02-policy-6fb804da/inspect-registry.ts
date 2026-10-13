import { writeFileSync } from "node:fs";
import { CREDENTIAL_PATTERNS, STACK_PRESETS, defaultVersionedPolicy, exportVersionedPolicy } from "../../../../packages/vscode-extension/src/ai-boundary/VersionedPolicy";
const result = { status: "PASS", credentialPatterns: CREDENTIAL_PATTERNS.length, distinctPatterns: new Set(CREDENTIAL_PATTERNS.map(row => row.pattern)).size,
    families: [...new Set(CREDENTIAL_PATTERNS.map(row => row.family))], presets: STACK_PRESETS.map(row => ({ id: row.id, patterns: row.patterns.length })),
    defaultMetadataBytes: Buffer.byteLength(exportVersionedPolicy(defaultVersionedPolicy())), scope: "Managed BoundarySnapshot defaults only; unchanged legacy scanner registry, no real file scan." };
writeFileSync(new URL("registry-inspection-01.json", import.meta.url), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result));
