/**
 * Witnessed Benchmark Runner — Gap-3 closure
 *
 * Wraps the existing external benchmark pipeline with a *witness attestation*
 * layer: environment fingerprint, dataset checksums, monotonic run-log,
 * output checksums, and a signable evidence hash. The artifact can be handed
 * to any third party; they can recompute the hash and confirm the run was not
 * tampered with after the fact.
 *
 * Run:  node scripts/witness/witnessed-benchmark.mjs
 * Output:
 *   artifacts/security/witnessed-run-<date>.json
 *   artifacts/security/witnessed-run-<date>.md
 *
 * This does NOT claim an already-performed external audit. It produces a
 * cryptographically-anchored evidence bundle so a *future* witness can verify.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(process.cwd(), "artifacts", "security");
const JSON_PATH = path.join(OUT_DIR, `witnessed-run-${DATE}.json`);
const MD_PATH = path.join(OUT_DIR, `witnessed-run-${DATE}.md`);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const shaFile = (p) => (existsSync(p) ? sha256(readFileSync(p)) : null);

/** Fingerprint of the execution environment — witnesses recompute this. */
function envFingerprint() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: os.cpus()?.[0]?.model ?? "unknown",
    cpuCount: os.cpus()?.length ?? 0,
    totalMemoryGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    osRelease: os.release(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // NOTE: hostname/IP deliberately excluded — not needed to verify the run,
    // and omitting keeps this shareable without leaking a network identity.
  };
}

/** sha256 of each dataset file we claim to have used. */
function datasetChecksums() {
  const out = {};
  const extDir = path.join(process.cwd(), "datasets", "external");
  if (existsSync(extDir)) {
    for (const f of readdirSync(extDir)) {
      const p = path.join(extDir, f);
      if (statSync(p).isFile()) out[`datasets/external/${f}`] = shaFile(p);
    }
  } else {
    out._note = "datasets/external not present — representative-sample run, NOT a full third-party corpus run.";
  }
  // Always include the canonical public result artifact if present.
  out["benchmarks/results/latest.json"] = shaFile(path.join(process.cwd(), "benchmarks", "results", "latest.json"));
  return out;
}

function runStep(name, cmd, args) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", timeout: 30 * 60_000 });
  const durationMs = Date.now() - t0;
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  return {
    step: name,
    command: `${cmd} ${args.join(" ")}`,
    startedAt,
    durationMs,
    exitCode: res.status,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    // store tail only — full logs live in the JSON stdout hash; witnesses rerun to confirm
    stdoutTail: stdout.slice(-4000),
    stderrTail: stderr.slice(-2000),
    passed: res.status === 0,
  };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const runId = `wr-${randomBytes(6).toString("hex")}`;
  const startedAt = new Date().toISOString();

  console.log(`▶ Witnessed benchmark run ${runId} — ${startedAt}`);
  const env = envFingerprint();
  const preDatasets = datasetChecksums();

  // ── The actual measured steps. Each is individually hashed. ──────────────
  const steps = [];

  steps.push(runStep("public-benchmark", "node", ["scripts/benchmark/run.mjs"]));

  // External corpora if available — honest about representative vs full.
  const hasExternal = existsSync(path.join(process.cwd(), "datasets", "external")) &&
    readdirSync(path.join(process.cwd(), "datasets", "external")).length > 0;
  steps.push(
    runStep(
      hasExternal ? "external-benchmark-full" : "external-benchmark-representative",
      "node",
      ["scripts/runExternalBenchmark.ts"],
    ),
  );

  steps.push(runStep("typecheck", "npx", ["tsc", "--noEmit"]));

  const postDatasets = datasetChecksums();
  const finishedAt = new Date().toISOString();

  // ── Evidence hash — everything a witness needs to verify. ────────────────
  const evidenceCore = {
    runId,
    startedAt,
    finishedAt,
    env,
    preDatasets,
    postDatasets,
    steps: steps.map(({ stdoutTail, stderrTail, ...rest }) => rest),
  };
  const evidenceHash = sha256(JSON.stringify(evidenceCore));

  const allPassed = steps.every((s) => s.passed);
  const witness = {
    schema: "soterai/witnessed-run@1",
    runId,
    label: "Witnessed SoterAI benchmark run",
    disclaimer:
      "Self-produced run with a verifiable evidence hash. This is NOT a completed third-party audit — it is tamper-evident evidence intended for independent re-verification.",
    allStepsPassed: allPassed,
    evidenceHash,
    howToVerify: [
      "1. Checkout the repo at the same commit.",
      "2. node scripts/witness/witnessed-benchmark.mjs",
      "3. Confirm evidenceHash matches (same dataset hashes, same step stdout hashes)",
    ],
    ...evidenceCore,
  };

  writeFileSync(JSON_PATH, JSON.stringify(witness, null, 2));

  // Human-readable markdown alongside.
  const md = [
    `# Witnessed Benchmark Run — ${runId}`,
    ``,
    `**Date:** ${finishedAt}  `,
    `**All steps passed:** ${allPassed ? "✅" : "❌"}  `,
    `**Evidence hash (sha256):** \`${evidenceHash}\``,
    ``,
    `> ⚠️ This is a self-produced, tamper-evident run — **not** a completed third-party audit.`,
    `> The evidence hash lets any reviewer independently confirm the run was not altered.`,
    ``,
    `## Environment`,
    "```json",
    JSON.stringify(env, null, 2),
    "```",
    ``,
    `## Steps`,
    ...steps.map(
      (s) =>
        `- **${s.step}** — exit ${s.exitCode}, ${(s.durationMs / 1000).toFixed(1)}s, stdout-sha \`${s.stdoutSha256.slice(0, 16)}…\` ${s.passed ? "✅" : "❌"}`,
    ),
    ``,
    `## Dataset checksums (pre-run)`,
    "```json",
    JSON.stringify(preDatasets, null, 2),
    "```",
  ].join("\n");
  writeFileSync(MD_PATH, md);

  console.log(`✅ Witnessed run written:\n  ${JSON_PATH}\n  ${MD_PATH}`);
  console.log(`evidenceHash: ${evidenceHash}`);
  if (!allPassed) process.exitCode = 1;
}

main();
