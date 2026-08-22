/**
 * Measures what the offline engine actually catches, on corpora it was not
 * written against.
 *
 * The 54-item unit suite asserts behaviour on inputs chosen by the person who
 * wrote the rules, which measures self-consistency rather than protection. This
 * scores the engine on the repo's held-out evaluation sets and reports two
 * different recalls, because they differ and only one of them protects anyone:
 *
 *   finding recall  — an attack rule fired at all.
 *   routed recall   — the item reaches the Flagged output. This is the number
 *                     that matters: enforcement is built on the branch, and the
 *                     node routes on `blocked`, which for a local verdict is
 *                     `action === "BLOCK"`. An attack scored REVIEW has findings
 *                     attached and still travels down Safe.
 *
 * Run: node scripts/measure-local-engine.cjs [--limit N]
 */
const fs = require("fs");
const path = require("path");

const enginePath = path.join(__dirname, "..", "test-build", "nodes", "SoterGuard", "shared", "localEngine.js");
let engine;
try {
  engine = require(enginePath);
} catch {
  console.error("Compiled engine not found. Run `npm run test:unit` first (it emits test-build/).");
  process.exit(2);
}

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const ATTACK_LABELS = new Set([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "DATA_EXFILTRATION",
  "ATTACK",
]);
const PRIVACY_LABELS = new Set(["PII", "SECRET", "SECRET_LEAK"]);
const BENIGN_LABELS = new Set(["SAFE", "BENIGN"]);

// Privacy findings are enumerated because they are the ones with distinct
// handling (redaction rather than blocking). Everything else the engine can emit
// counts as an attack finding, derived rather than listed: the first version of
// this script hardcoded a guessed list that omitted seven types the engine
// actually emits (MEMORY_POISONING, CODE_INJECTION, ADVANCED_SMUGGLING,
// SQL_INJECTION, SSRF_ATTEMPT, MULTIMODAL_INJECTION, SYSTEM_PROMPT_LEAKAGE) and
// listed six it never does, which under-counted both recall and false positives.
const PRIVACY_FINDING_TYPES = new Set(["PII_DETECTED", "SECRET_DETECTED", "INDIA_PII_DETECTED"]);
const isAttackType = (type) => !PRIVACY_FINDING_TYPES.has(type);

function readJsonl(relativePath) {
  const full = path.join(repoRoot, relativePath);
  if (!fs.existsSync(full)) return null;
  const rows = [];
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* skip a malformed line rather than abort the whole corpus */
    }
  }
  return rows;
}

function score(rows, corpusName) {
  const buckets = new Map();
  const bySource = new Map();
  const misses = [];
  const falsePositives = [];

  let index = 0;
  for (const row of rows) {
    if (index >= LIMIT) break;
    index += 1;
    const text = typeof row.text === "string" ? row.text : "";
    if (!text.trim()) continue;
    const label = String(row.label || "UNKNOWN").toUpperCase();

    const analysis = engine.analyzeLocal(text, "INPUT");
    const findingTypes = new Set(analysis.findings.map((finding) => finding.type));
    const attackFinding = [...findingTypes].some((type) => isAttackType(type));
    const privacyFinding = [...findingTypes].some((type) => PRIVACY_FINDING_TYPES.has(type));
    // The node's routing rule for a local verdict, verbatim: `blocked` is set
    // only when `analysis.allowed` is false, which is only when action is BLOCK.
    const routedToFlagged = analysis.allowed === false;

    const key = label;
    if (!buckets.has(key)) {
      buckets.set(key, { label, total: 0, finding: 0, routed: 0, review: 0, redactOnly: 0 });
    }
    const bucket = buckets.get(key);
    bucket.total += 1;

    // A single blended recall figure hides the thing a reader needs to know:
    // whether the engine is weak everywhere, or strong on the attack shapes a
    // workflow actually receives and blind on one game-like corpus that needs
    // session state the engine does not have.
    const sourceKey = String(row.source || "unknown");
    const attackRow = ATTACK_LABELS.has(label);
    const privacyRow = PRIVACY_LABELS.has(label);
    if (attackRow || privacyRow) {
      if (!bySource.has(sourceKey)) bySource.set(sourceKey, { source: sourceKey, total: 0, finding: 0, routed: 0 });
      const sourceBucket = bySource.get(sourceKey);
      sourceBucket.total += 1;
      if (attackRow ? attackFinding : privacyFinding) sourceBucket.finding += 1;
      if (routedToFlagged) sourceBucket.routed += 1;
    }

    if (ATTACK_LABELS.has(label)) {
      if (attackFinding) bucket.finding += 1;
      if (routedToFlagged) bucket.routed += 1;
      if (attackFinding && !routedToFlagged) bucket.review += 1;
      if (!attackFinding && misses.length < 25) misses.push({ label, text: text.slice(0, 140), source: row.source });
    } else if (PRIVACY_LABELS.has(label)) {
      if (privacyFinding) bucket.finding += 1;
      if (routedToFlagged) bucket.routed += 1;
      if (privacyFinding && !routedToFlagged) bucket.redactOnly += 1;
      if (!privacyFinding && misses.length < 25) misses.push({ label, text: text.slice(0, 140), source: row.source });
    } else if (BENIGN_LABELS.has(label)) {
      // For a benign row the interesting failure is being treated as an attack.
      // A privacy finding on benign text is redaction doing its job, so it is
      // counted separately rather than called a false positive.
      if (attackFinding) bucket.finding += 1;
      if (routedToFlagged) bucket.routed += 1;
      if (privacyFinding && !attackFinding) bucket.redactOnly += 1;
      if (attackFinding && falsePositives.length < 25) {
        falsePositives.push({ text: text.slice(0, 140), types: [...findingTypes].join(","), source: row.source });
      }
    }
  }

  return { corpusName, buckets: [...buckets.values()], misses, falsePositives, scanned: index, bySource };
}

const corpora = [
  ["datasets/crossdist-eval-v3.jsonl", "crossdist-eval-v3 (in-scope: injection / leak / PII / benign)"],
  ["datasets/meta-instructional-benign-heldout.jsonl", "meta-instructional benign held-out (over-defense probe)"],
  ["datasets/external/jailbreakbench.jsonl", "JailbreakBench (content-harm — OUT of this tier's threat model)"],
  ["datasets/external/harmbench.jsonl", "HarmBench (content-harm — OUT of this tier's threat model)"],
];

const started = Date.now();
let totalScanned = 0;
const reports = [];
for (const [relativePath, name] of corpora) {
  const rows = readJsonl(relativePath);
  if (!rows) {
    console.log(`skipped (not found): ${relativePath}`);
    continue;
  }
  const report = score(rows, name);
  totalScanned += report.scanned;
  reports.push(report);
}

function pct(numerator, denominator) {
  if (!denominator) return "     n/a";
  return `${((numerator / denominator) * 100).toFixed(2).padStart(6)}%`;
}

for (const report of reports) {
  console.log(`\n=== ${report.corpusName} ===`);
  console.log(`${"label".padEnd(28)}${"rows".padStart(7)}${"finding".padStart(10)}${"routed".padStart(10)}   note`);
  console.log("-".repeat(84));
  for (const bucket of report.buckets.sort((a, b) => b.total - a.total)) {
    const isBenign = BENIGN_LABELS.has(bucket.label);
    let note = "";
    if (isBenign) {
      note = `false-positive rate; ${bucket.redactOnly} redaction-only (not flagged)`;
    } else if (bucket.review > 0) {
      note = `${bucket.review} detected but routed to SAFE`;
    } else if (bucket.redactOnly > 0) {
      note = `${bucket.redactOnly} redacted, not blocked (by design)`;
    }
    console.log(
      `${bucket.label.padEnd(28)}${String(bucket.total).padStart(7)}` +
        `${pct(bucket.finding, bucket.total).padStart(10)}${pct(bucket.routed, bucket.total).padStart(10)}   ${note}`,
    );
  }
  if (report.bySource && report.bySource.size > 1) {
    console.log(`\n  attack/privacy recall by corpus source:`);
    console.log(`  ${"source".padEnd(32)}${"rows".padStart(7)}${"finding".padStart(10)}${"routed".padStart(10)}`);
    for (const bucket of [...report.bySource.values()].sort((a, b) => b.total - a.total)) {
      console.log(
        `  ${bucket.source.padEnd(32)}${String(bucket.total).padStart(7)}` +
          `${pct(bucket.finding, bucket.total).padStart(10)}${pct(bucket.routed, bucket.total).padStart(10)}`,
      );
    }
  }
  if (report.falsePositives.length) {
    console.log(`\n  benign rows treated as attacks (first ${report.falsePositives.length}):`);
    for (const fp of report.falsePositives.slice(0, 8)) {
      console.log(`    [${fp.types}] ${JSON.stringify(fp.text.slice(0, 110))}`);
    }
  }
  if (report.misses.length) {
    console.log(`\n  undetected attack rows (first ${Math.min(8, report.misses.length)} of ${report.misses.length} sampled):`);
    for (const miss of report.misses.slice(0, 8)) {
      console.log(`    [${miss.label}] ${JSON.stringify(miss.text.slice(0, 110))}`);
    }
  }
}

console.log(
  `\nscanned ${totalScanned} rows in ${((Date.now() - started) / 1000).toFixed(1)}s ` +
    `(${(((Date.now() - started) * 1000) / Math.max(1, totalScanned)).toFixed(0)}us/row)`,
);
console.log(
  "\nfinding = an attack (or privacy) rule fired.  routed = the item reaches the Flagged output.\n" +
    "Where those two differ, the engine saw the attack and the workflow's enforcement branch did not.",
);
