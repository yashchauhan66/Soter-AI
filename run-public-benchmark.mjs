// scripts/run-public-benchmark.mjs
// Run with: node scripts/run-public-benchmark.mjs
import { performance } from "node:perf_hooks";

// Option A: Agar aap @soterai/core SDK ya local API endpoint test kar rahe hain:
const SOTER_API_URL = process.env.SOTER_URL || "http://localhost:3000/api/v1/guard/input";
const SOTER_API_KEY = process.env.SOTER_API_KEY || "test-key";

// HuggingFace Public Dataset API (deepset/prompt-injections test split)
const HF_DATASET_URL =
  "https://datasets-server.huggingface.co/rows?dataset=deepset%2Fprompt-injections&config=default&split=test&offset=0&length=100";

async function scanWithSoter(promptText) {
  const t0 = performance.now();
  const res = await fetch(SOTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SOTER_API_KEY}`, 
      "x-api-key": SOTER_API_KEY,
    },
    body: JSON.stringify({ prompt: promptText, input: promptText }),
  });

  const data = await res.json();
  const latency = performance.now() - t0;

  // Map Soter GuardDecision ("BLOCK" | "REWRITE" | "ALLOW_WITH_REDACTION" | "ALLOW")
  const isBlocked =
    data.action === "BLOCK" ||
    data.blocked === true ||
    data.flagged === true ||
    (typeof data.riskScore === "number" && data.riskScore >= 0.5);

  return { isBlocked, latency, raw: data };
}

async function runTrueBenchmark() {
  console.log("📥 Fetching neutral public benchmark: deepset/prompt-injections (HuggingFace)...");
  const hfRes = await fetch(HF_DATASET_URL);
  const hfData = await hfRes.json();
  const rows = hfData.rows.map((r) => r.row);

  console.log(`✅ Loaded ${rows.length} public test prompts. Running Soter v14...\n`);

  let tp = 0, fp = 0, tn = 0, fn = 0;
  const latencies = [];
  const missedAttacks = [];
  const falseAlarms = [];

  for (const item of rows) {
    const prompt = item.text;
    const actualMalicious = item.label === 1; // 1 = Injection, 0 = Benign

    const { isBlocked, latency } = await scanWithSoter(prompt);
    latencies.push(latency);

    if (actualMalicious && isBlocked) tp++;
    else if (actualMalicious && !isBlocked) {
      fn++;
      missedAttacks.push(prompt.slice(0, 90));
    } else if (!actualMalicious && isBlocked) {
      fp++;
      falseAlarms.push(prompt.slice(0, 90));
    } else tn++;
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);
  const fpr = fp / (fp + tn || 1);

  console.log("====================================================");
  console.log("🏆 SOTER v14 vs PUBLIC BENCHMARK (deepset/injections)");
  console.log("====================================================");
  console.log(`Total Samples Tested : ${rows.length} (Malicious: ${tp + fn}, Benign: ${tn + fp})`);
  console.log(`F1-Score             : ${(f1 * 100).toFixed(2)}%  (LLM Guard v2 baseline: 78.6% - 84.3%)`);
  console.log(`Recall (Catch Rate)  : ${(recall * 100).toFixed(2)}%`);
  console.log(`Precision            : ${(precision * 100).toFixed(2)}%`);
  console.log(`False Positive Rate  : ${(fpr * 100).toFixed(2)}%  (Meta PromptGuard 86M: ~46% on NotInject)`);
  console.log(`Latency (p50 / p95)  : ${p50.toFixed(2)} ms / ${p95.toFixed(2)} ms`);
  console.log("====================================================\n");

  if (missedAttacks.length > 0) {
    console.log(`🔍 Sample Missed Injections (FN = ${fn}) — Add rules for these in v14:`);
    missedAttacks.slice(0, 5).forEach((m, i) => console.log(`  ${i + 1}. "${m}..."`));
  }
}

runTrueBenchmark().catch(console.error);