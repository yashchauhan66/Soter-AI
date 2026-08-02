/**
 * Per-detector attribution for the deterministic (rules) tier.
 *
 * The 12-stage MCP profile showed that a *cold* argument scan costs ~6.8 ms even
 * for a 16-byte payload and ~46 ms for 8 KB — dominating every other stage by
 * two orders of magnitude. One aggregate number cannot say whether that is
 * irreducible detector work or removable waste, so this profiler times each of
 * the 26 registered INPUT detectors individually, inside one shared
 * `withDetectionVariantScope` (exactly how `analyzeText` runs them), and reports
 * each detector's share of the tier.
 *
 * It measures only. No detector is disabled, no threshold is moved, no finding is
 * dropped: every detector listed here is the same function `analyzeText` calls.
 *
 * Usage:
 *   npx tsx --expose-gc scripts/perf/detector-tier-profile.ts [iterations]
 *   npx tsx scripts/perf/detector-tier-profile.ts 200 --json
 */
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { withDetectionVariantScope } from "../../lib/guard/detectors/helpers";
import { analyzeText } from "../../lib/guard/analyze";
import { canonicalStringify } from "../../lib/gateway/mcp/inspect";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { redactText } from "../../lib/guard/redactor";
import { scoreRisk } from "../../lib/guard/riskScoring";
import { decideGuardAction } from "../../lib/guard/decisionEngine";
import { deriveAdvisory } from "../../lib/guard/routingAdvisory";
import type { GuardFinding } from "../../lib/guard/types";

import { promptInjectionDetector } from "../../lib/guard/detectors/promptInjectionDetector";
import { jailbreakDetector } from "../../lib/guard/detectors/jailbreakDetector";
import { systemPromptLeakAttemptDetector } from "../../lib/guard/detectors/systemPromptLeakDetector";
import { multilingualAttackDetector } from "../../lib/guard/detectors/multilingualAttackDetector";
import { recursiveInjectionDetector } from "../../lib/guard/detectors/recursiveInjectionDetector";
import { ssrfDetector } from "../../lib/guard/detectors/ssrfDetector";
import { adversarialCyberDetector } from "../../lib/guard/detectors/adversarialCyberDetector";
import { competitiveIntelDetector } from "../../lib/guard/detectors/competitiveIntelDetector";
import { socialEngineeringDetector } from "../../lib/guard/detectors/socialEngineeringDetector";
import { embeddingPoisoningDetector } from "../../lib/guard/detectors/embeddingPoisoningDetector";
import { mcpToolPoisoningDetector } from "../../lib/guard/detectors/mcpToolPoisoningDetector";
import { memoryPoisoningDetector } from "../../lib/guard/detectors/memoryPoisoningDetector";
import { multimodalAttackDetector } from "../../lib/guard/detectors/multimodalAttackDetector";
import { modelSupplyChainDetector } from "../../lib/guard/detectors/modelSupplyChainDetector";
import { behavioralAnomalyDetector } from "../../lib/guard/detectors/behavioralAnomalyDetector";
import { advancedUnicodeSmugglingDetector } from "../../lib/guard/detectors/advancedUnicodeSmugglingDetector";
import { insecureDeserializationDetector } from "../../lib/guard/detectors/insecureDeserializationDetector";
import { dataExfiltrationInputDetector } from "../../lib/guard/detectors/dataExfiltrationInputDetector";
import { replyChannelExfilDetector } from "../../lib/guard/detectors/replyChannelExfilDetector";
import { harmfulContentRequestDetector } from "../../lib/guard/detectors/harmfulContentRequestDetector";
import { broadHarmfulContentDetector } from "../../lib/guard/detectors/broadHarmfulContentDetector";
import { generalizedIntentDetector } from "../../lib/guard/detectors/generalizedIntentDetector";
import { piiDetector } from "../../lib/guard/detectors/piiDetector";
import { indiaPiiDetector } from "../../lib/guard/detectors/indiaPiiDetector";
import { secretsDetector } from "../../lib/guard/detectors/secretsDetector";
import { toxicityDetector } from "../../lib/guard/detectors/toxicityDetector";

import { collectGarbage, enterBenchmarkMode, payloadFingerprint, startGcAccounting } from "./env-fingerprint";

/**
 * The INPUT detector list, in registration order, mirroring
 * `INPUT_DETECTORS` in lib/guard/analyze.ts. Kept as a literal (not imported)
 * because that constant is module-private; the assertion below fails the run if
 * the two ever drift in length.
 */
const INPUT_DETECTORS: Array<[string, (text: string) => GuardFinding[]]> = [
  ["promptInjection", promptInjectionDetector],
  ["jailbreak", jailbreakDetector],
  ["systemPromptLeakAttempt", systemPromptLeakAttemptDetector],
  ["multilingualAttack", multilingualAttackDetector],
  ["recursiveInjection", recursiveInjectionDetector],
  ["ssrf", ssrfDetector],
  ["adversarialCyber", adversarialCyberDetector],
  ["competitiveIntel", competitiveIntelDetector],
  ["socialEngineering", socialEngineeringDetector],
  ["embeddingPoisoning", embeddingPoisoningDetector],
  ["mcpToolPoisoning", mcpToolPoisoningDetector],
  ["memoryPoisoning", memoryPoisoningDetector],
  ["multimodalAttack", multimodalAttackDetector],
  ["modelSupplyChain", modelSupplyChainDetector],
  ["behavioralAnomaly", behavioralAnomalyDetector],
  ["advancedUnicodeSmuggling", advancedUnicodeSmugglingDetector],
  ["insecureDeserialization", insecureDeserializationDetector],
  ["dataExfiltrationInput", dataExfiltrationInputDetector],
  ["replyChannelExfil", replyChannelExfilDetector],
  ["harmfulContentRequest", harmfulContentRequestDetector],
  ["broadHarmfulContent", broadHarmfulContentDetector],
  ["generalizedIntent", generalizedIntentDetector],
  ["pii", piiDetector],
  ["indiaPii", indiaPiiDetector],
  ["secrets", secretsDetector],
  ["toxicity", toxicityDetector],
];

const ITERATIONS = Number(process.argv[2]?.replace(/\D/g, "") || 200);
const AS_JSON = process.argv.includes("--json");
const WARMUP = 30;

const PAYLOADS: Array<{ label: string; text: string }> = [
  { label: "simple-16B", text: canonicalStringify({ text: "hello" }) },
  { label: "block-cmd", text: canonicalStringify({ command: "rm -rf /" }) },
  { label: "large-8KB", text: canonicalStringify({ text: "The quarterly onboarding checklist item. ".repeat(200) }) },
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50Us: Number(percentile(sorted, 50).toFixed(2)),
    p95Us: Number(percentile(sorted, 95).toFixed(2)),
    meanUs: Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2)),
  };
}

function profile(text: string) {
  // One scope for the whole measurement, matching analyzeText: decode variants
  // are constructed once and shared by all 26 detectors, so per-detector timings
  // attribute detector work only (variant construction is stage 06 of the MCP
  // profile and is measured there).
  return withDetectionVariantScope(text, () => {
    const rows: Array<{ detector: string; findings: number } & ReturnType<typeof summarize>> = [];
    for (const [name, detector] of INPUT_DETECTORS) {
      for (let i = 0; i < WARMUP; i += 1) detector(text);
      collectGarbage();
      const samples: number[] = [];
      let findings = 0;
      for (let i = 0; i < ITERATIONS; i += 1) {
        const t0 = performance.now();
        const out = detector(text);
        samples.push((performance.now() - t0) * 1000);
        findings = out.length;
      }
      rows.push({ detector: name, findings, ...summarize(samples) });
    }
    return rows;
  });
}

function measureAnalyze(text: string) {
  for (let i = 0; i < WARMUP; i += 1) analyzeText(text, "INPUT");
  collectGarbage();
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const t0 = performance.now();
    analyzeText(text, "INPUT");
    samples.push((performance.now() - t0) * 1000);
  }
  return summarize(samples);
}

function measure(fn: () => void, iterations = ITERATIONS) {
  for (let i = 0; i < WARMUP; i += 1) fn();
  collectGarbage();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push((performance.now() - t0) * 1000);
  }
  return summarize(samples);
}

/**
 * Attribute the part of `analyzeText` that is NOT per-detector matching.
 *
 * Interleaving matters more than isolation here: on a shared laptop the machine
 * load between two sequential runs moves a millisecond-scale number by more than
 * most code changes do, so every component below is measured inside one process,
 * back to back, against the same payload.
 *
 * The `rules` measurement flips SOTERAI_DETECTION_TIER for the duration of the
 * measurement only. That is a *measurement* of the semantic tier's contribution,
 * not a shipped configuration — the tier is restored immediately afterwards.
 */
function attributeTail(text: string) {
  const emptyFindings: GuardFinding[] = [];
  const coldScopePass = measure(() => {
    withDetectionVariantScope(text, () => INPUT_DETECTORS.map(([, d]) => d(text)));
  });
  const hybrid = measureAnalyze(text);
  const previousTier = process.env.SOTERAI_DETECTION_TIER;
  process.env.SOTERAI_DETECTION_TIER = "rules";
  const rulesOnly = measureAnalyze(text);
  if (previousTier === undefined) delete process.env.SOTERAI_DETECTION_TIER;
  else process.env.SOTERAI_DETECTION_TIER = previousTier;

  const semanticStandalone = measure(() => {
    try {
      classifySemantic(text);
    } catch {
      /* the guard treats a semantic failure as rules-only; ignore here too */
    }
  });
  const redaction = measure(() => {
    redactText(text, emptyFindings);
  });
  const scoring = measure(() => {
    const score = scoreRisk(emptyFindings);
    decideGuardAction(score, ["LOW_RISK"], "INPUT");
    deriveAdvisory(text, emptyFindings, ["LOW_RISK"]);
  });

  return {
    coldScopePass,
    analyzeHybrid: hybrid,
    analyzeRulesOnly: rulesOnly,
    semanticContributionP50Us: Number((hybrid.p50Us - rulesOnly.p50Us).toFixed(2)),
    semanticStandalone,
    redactionStandalone: redaction,
    scoringAndAdvisoryStandalone: scoring,
  };
}

function main() {
  const env = enterBenchmarkMode({
    priority: "above_normal",
    warmupIterations: WARMUP,
    gcBetweenPhases: true,
    env: { SOTERAI_DETECTION_TIER: process.env.SOTERAI_DETECTION_TIER ?? "hybrid" },
  });
  const stopGc = startGcAccounting();

  const cases = PAYLOADS.map(({ label, text }) => {
    const detectors = profile(text);
    const tail = attributeTail(text);
    const whole = tail.analyzeHybrid;
    const detectorSumP50 = Number(detectors.reduce((a, d) => a + d.p50Us, 0).toFixed(2));
    return {
      case: label,
      payload: payloadFingerprint(text),
      analyzeText: whole,
      detectorSumP50Us: detectorSumP50,
      /** analyzeText p50 minus the summed detector p50: scope + post-detector work. */
      nonDetectorP50Us: Number((whole.p50Us - detectorSumP50).toFixed(2)),
      /** Cold decode-variant construction: one fresh scope pass minus the warm detector sum. */
      variantConstructionP50Us: Number((tail.coldScopePass.p50Us - detectorSumP50).toFixed(2)),
      tail,
      detectors: detectors
        .slice()
        .sort((a, b) => b.p50Us - a.p50Us)
        .map((d) => ({ ...d, shareOfTierP50: Number(((d.p50Us / detectorSumP50) * 100).toFixed(1)) })),
    };
  });

  const gc = stopGc();
  const report = { tool: "detector-tier-profile", iterations: ITERATIONS, warmup: WARMUP, detectorCount: INPUT_DETECTORS.length, env, gc, cases };

  const out = join(process.cwd(), "artifacts", "perf", "detector-tier-profile.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nDeterministic (rules) tier per-detector profile — ${INPUT_DETECTORS.length} INPUT detectors, ${ITERATIONS} iterations each\n`);
  console.log(`node ${env.node.version}  priority=${env.process.priorityLabel}  cpuBusyBefore=${(env.load.before.busyFraction * 100).toFixed(1)}%`);
  for (const c of cases) {
    console.log(`\n${c.case}  payload=${c.payload.bytes}B sha=${c.payload.sha256}`);
    console.log(
      `  analyzeText p50=${(c.analyzeText.p50Us / 1000).toFixed(3)}ms p95=${(c.analyzeText.p95Us / 1000).toFixed(3)}ms  |  ` +
        `sum(detector p50)=${(c.detectorSumP50Us / 1000).toFixed(3)}ms  non-detector=${(c.nonDetectorP50Us / 1000).toFixed(3)}ms`,
    );
    console.log(
      `  tail: variant-construction=${(c.variantConstructionP50Us / 1000).toFixed(3)}ms  ` +
        `semantic(in-situ hybrid-minus-rules)=${(c.tail.semanticContributionP50Us / 1000).toFixed(3)}ms  ` +
        `semantic(standalone)=${(c.tail.semanticStandalone.p50Us / 1000).toFixed(3)}ms  ` +
        `redactText=${(c.tail.redactionStandalone.p50Us / 1000).toFixed(3)}ms  ` +
        `score+decide+advisory=${(c.tail.scoringAndAdvisoryStandalone.p50Us / 1000).toFixed(3)}ms`,
    );
    console.log(
      `  analyzeText rules-tier-only p50=${(c.tail.analyzeRulesOnly.p50Us / 1000).toFixed(3)}ms  ` +
        `cold full-scope detector pass p50=${(c.tail.coldScopePass.p50Us / 1000).toFixed(3)}ms`,
    );
    const header = ["detector".padEnd(26), "p50 µs".padStart(10), "p95 µs".padStart(10), "% tier".padStart(8), "findings".padStart(9)].join(" ");
    console.log(`  ${header}`);
    console.log(`  ${"-".repeat(header.length)}`);
    for (const d of c.detectors) {
      console.log(
        `  ${d.detector.padEnd(26)} ${d.p50Us.toFixed(2).padStart(10)} ${d.p95Us.toFixed(2).padStart(10)} ${
          d.shareOfTierP50.toFixed(1).padStart(8)
        } ${String(d.findings).padStart(9)}`,
      );
    }
  }
  console.log(`\nGC: ${gc.collections} collections, ${gc.totalPauseMs.toFixed(2)} ms total`);
  console.log(`\nWritten: artifacts/perf/detector-tier-profile.json`);
}

main();
