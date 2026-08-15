#!/usr/bin/env node
// Latency measurement harness: report measured p50/p90/p99 for the guard
// engine and, separately, for the deployed API. The two are reported apart
// deliberately, because conflating them is how a fast engine gets advertised
// with a slow number.
//
// Usage:
//   node scripts/dev/measure-guard-latency.ts [iterations] [apiKey]
//
// When apiKey is omitted, only the local engine is measured. When supplied,
// both local and deployed API are measured in sequence.

import { analyzeText } from "../../lib/guard/analyze";

const ITERATIONS = Number(process.argv[2]) || 500;
const API_KEY = process.argv[3];
const API_BASE = process.env.SOTERAI_API_BASE || "https://soterai.in/api";

// A realistic distribution: mostly short user messages, some long ones, a few
// complex payloads. All benign so they exercise the full pipeline without
// short-circuiting on a hard block.
const CORPUS = [
  "Hello, can you help me with a refund for order #45821?",
  "I need to update my billing information and change my subscription plan.",
  "What are your business hours on Saturday?",
  "The tracking number you sent doesn't work, can you check the status?",
  "Thanks for your help, that solved the problem!",
  "I'm trying to understand how your API pricing works — is there a free tier?",
  "Can you explain the difference between the PRO and ENTERPRISE plans?",
  "My invoice amount seems wrong, I was charged twice for the same month.",
  "How do I cancel my subscription if I no longer need the service?",
  "I have a technical question about integrating your SDK with Next.js.",
  "What payment methods do you accept for international customers?",
  "The documentation says to use environment variables but I'm not sure which ones.",
  "I need to generate an API key for our staging environment, where do I do that?",
  "Is there a webhook I can subscribe to for real-time updates on order status?",
  "Your support team responded really quickly last time, thank you!",
  "I'm getting a 429 error on the production API, is there an outage?",
  "Can you help me debug why my guard integration keeps returning ALLOW for everything?",
  "The latency on the OUTPUT guard seems higher than INPUT, is that expected?",
  "I want to add PII redaction to our chat logs without blocking the entire message.",
  "Does the semantic detection tier require any external dependencies or GPU?",
  // Long ones
  "I'm building a customer support chatbot for our e-commerce platform and I need to make sure it doesn't leak sensitive data like credit card numbers or personal identification. I saw that you have PII detection but I'm wondering if it covers Indian Aadhaar numbers and PANs as well, because we have a lot of customers from India. Also, does the guard work in real-time or do I need to batch the requests? Our chat volume is around 5000 messages per day during peak hours, mostly in English but sometimes in Hindi or Hinglish. What plan would you recommend for that scale?",
  "We're migrating from another AI safety provider and one of the features we used heavily was the ability to define custom blocked topics. For example, we run a financial advice assistant and we want to block any questions about gambling, cryptocurrency trading advice, or get-rich-quick schemes, but allow general questions about savings accounts and retirement planning. I see you have a customBlockedTopics field in the policy but I'm not sure if it's substring matching or something more sophisticated. Can it handle edge cases like 'I want to save for retirement with bitcoin' where bitcoin appears but the context is not a trading request?",
  "Last week I filed a support ticket about false positives on the jailbreak detector — it was flagging ordinary customer complaints that contained phrases like 'ignore my previous order' or 'forget what I said earlier' as JAILBREAK even though they were clearly benign. Your team responded that you added some negation rules to fix it, and I can confirm the problem is gone now. I just wanted to follow up and say thank you for the quick fix, and also ask whether that fix is documented somewhere so I can understand what patterns are safe to use in our training examples for the support team.",
];

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((sorted.length * p) / 100) - 1;
  return sorted[Math.max(0, index)];
}

function stats(samples: number[]): { p50: number; p90: number; p99: number; mean: number } {
  const sorted = samples.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  return {
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    mean: Math.round(sum / sorted.length),
  };
}

async function measureLocalEngine(iterations: number): Promise<number[]> {
  const latencies: number[] = [];
  console.error(`Measuring local engine over ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    const text = CORPUS[i % CORPUS.length];
    const start = Date.now();
    analyzeText(text, "INPUT");
    const elapsed = Date.now() - start;
    latencies.push(elapsed);

    if ((i + 1) % 100 === 0) {
      process.stderr.write(`  ${i + 1}/${iterations}\r`);
    }
  }
  process.stderr.write("\n");
  return latencies;
}

async function measureDeployedApi(apiKey: string, iterations: number): Promise<number[]> {
  const latencies: number[] = [];
  console.error(`\nMeasuring deployed API at ${API_BASE} over ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    const text = CORPUS[i % CORPUS.length];
    const start = Date.now();

    try {
      const response = await fetch(`${API_BASE}/guard/input`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        console.error(`  API error at iteration ${i + 1}: ${response.status} ${response.statusText}`);
        continue;
      }

      // The server-side time is in X-Soter-Latency-Ms, but we're measuring
      // wall-clock including network, which is what a real caller experiences.
      const elapsed = Date.now() - start;
      latencies.push(elapsed);

      if ((i + 1) % 100 === 0) {
        process.stderr.write(`  ${i + 1}/${iterations}\r`);
      }
    } catch (error) {
      console.error(`  Network error at iteration ${i + 1}:`, error);
    }
  }
  process.stderr.write("\n");
  return latencies;
}

async function main() {
  console.log("SoterAI Guard Latency Measurement");
  console.log("==================================\n");
  console.log(`Corpus: ${CORPUS.length} messages (realistic distribution)`);
  console.log(`Iterations: ${ITERATIONS}\n`);

  const local = await measureLocalEngine(ITERATIONS);
  const localStats = stats(local);

  console.log("\nLocal Engine (rule-based detection tier only):");
  console.log(`  p50: ${localStats.p50}ms`);
  console.log(`  p90: ${localStats.p90}ms`);
  console.log(`  p99: ${localStats.p99}ms`);
  console.log(`  mean: ${localStats.mean}ms`);

  if (API_KEY) {
    const deployed = await measureDeployedApi(API_KEY, ITERATIONS);
    if (deployed.length > 0) {
      const deployedStats = stats(deployed);
      console.log("\nDeployed API (includes network, TLS, database):");
      console.log(`  p50: ${deployedStats.p50}ms`);
      console.log(`  p90: ${deployedStats.p90}ms`);
      console.log(`  p99: ${deployedStats.p99}ms`);
      console.log(`  mean: ${deployedStats.mean}ms`);

      const overhead = deployedStats.p50 - localStats.p50;
      console.log(`\nNetwork + infrastructure overhead: ~${overhead}ms at p50`);
    } else {
      console.log("\nDeployed API measurement failed (no successful requests).");
    }
  } else {
    console.log("\nTo measure the deployed API, pass an API key:");
    console.log(`  node scripts/dev/measure-guard-latency.ts ${ITERATIONS} <your-api-key>`);
  }

  console.log(`\nMeasured on ${new Date().toISOString().split("T")[0]}`);
  console.log("These numbers are what should be published in the docs.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
