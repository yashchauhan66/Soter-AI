import { detectSecrets } from "./src/detectors/SecretDetector";
import { redactForSharing, findSurvivingSecrets } from "./src/Redactor";

// NOTE: high_entropy_token requires a QUOTED value. Previous probe was invalid
// because it used unquoted text, so no pattern matched at all.
const real: Array<[string, string]> = [
  ["test-prefixed real", 'API_KEY = "test_sk_live_9f8e7d6c5b4a3210abcdef"'],
  ["0-padded real",     'API_KEY = "00000000Q1w2e3r4t5y6u7i8o9p0"'],
];
const keepSuppressed: Array<[string, string]> = [
  ["short low-entropy", 'API_KEY = "testtest"'],
  ["sample short",      'API_KEY = "sample"'],
];

console.log("-- should DETECT (over-suppression fixed) --");
for (const [n, t] of real) {
  const d = detectSecrets(t);
  console.log(n.padEnd(20), "| findings:", d.matches.length, "| types:", d.matches.map(m => m.type).join(",") || "-", "| survivors:", JSON.stringify(findSurvivingSecrets(redactForSharing(t, d.matches))));
}
console.log("-- should stay SUPPRESSED (no FP regression) --");
for (const [n, t] of keepSuppressed) {
  const d = detectSecrets(t);
  console.log(n.padEnd(20), "| findings:", d.matches.length);
}
