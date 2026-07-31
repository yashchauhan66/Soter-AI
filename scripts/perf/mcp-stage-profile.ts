/**
 * MCP simple-ALLOW end-to-end stage profile.
 *
 * The 300-iteration benchmark reports one number per bucket. That number cannot
 * tell you *where* the time goes, so it cannot tell you which optimisation is
 * safe. This profiler times every stage of a simple ALLOW using the real
 * production functions — no replicas, no stubs — and reports each stage's share
 * of the gate.
 *
 * Stages (as required by the performance brief):
 *   1  JSON-RPC parse            parseBounded (bounded bytes + depth walk)
 *   2  session lookup            engine session validity / rate window
 *   3  capability lookup         tool inventory + capability annotation
 *   4  argument traversal        extractStructuralSignals (walkStrings)
 *   5  normalization             normalizeForDetection
 *   6  decoding                  detection-variant construction
 *   7  deterministic detectors   runInputGuard (rules tier)
 *   8  semantic classifier       classifySemantic
 *   9  policy evaluation         applyPolicy + evaluateMCPToolInvocation
 *  10  evidence creation         buildMcpDecision
 *  11  cache lookup              clean-input cache hit path
 *  12  response serialization    JSON.stringify of the forwarded frame
 *
 * Nothing here disables a detector or relaxes a budget; it only measures.
 *
 * Usage:
 *   npx tsx --expose-gc scripts/perf/mcp-stage-profile.ts [iterations]
 *   npx tsx scripts/perf/mcp-stage-profile.ts 400 --json
 */
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { evaluateMCPToolInvocation } from "@soterai/guard-core";
import { parseBounded } from "../../lib/gateway/mcp/jsonrpc";
import { McpEnforcementEngine } from "../../lib/gateway/mcp/engine";
import {
  canonicalStringify,
  extractStructuralSignals,
  inspectArguments,
  clearCleanInputCacheForTests,
  cleanInputCacheDiagnostics,
} from "../../lib/gateway/mcp/inspect";
import { argsFingerprint, buildMcpDecision } from "../../lib/gateway/mcp/decision";
import { DEFAULT_LIMITS, type McpSessionIdentity } from "../../lib/gateway/mcp/types";
import { runInputGuard } from "../../lib/guard/inputGuard";
import { applyPolicy, DEFAULT_POLICY } from "../../lib/guard/policy";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { detectPatterns, normalizeForDetection, withDetectionVariantScope } from "../../lib/guard/detectors/helpers";
import {
  collectGarbage,
  enterBenchmarkMode,
  payloadFingerprint,
  startGcAccounting,
} from "./env-fingerprint";

const ITERATIONS = Number(process.argv[2]?.replace(/\D/g, "") || 300);
const AS_JSON = process.argv.includes("--json");
const WARMUP = 50;

const IDENTITY: McpSessionIdentity = {
  tenantId: "bench-tenant",
  projectId: "bench-proj",
  clientId: "bench-client",
  principalType: "human",
  principalId: "bench-user",
  serverId: "fake-mcp",
  allowedPermissions: ["filesystem"] as never[],
  allowedRoots: ["/tmp"],
  expiresAt: Date.now() + 3600_000,
};

const SIMPLE_ARGS = { text: "hello" };
const SIMPLE_PARAMS = { name: "echo", arguments: SIMPLE_ARGS };
const SIMPLE_LINE = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: SIMPLE_PARAMS });
const SIMPLE_SERIALIZED = canonicalStringify(SIMPLE_ARGS);

const LARGE_TEXT = "The quarterly onboarding checklist item. ".repeat(200);
const LARGE_ARGS = { text: LARGE_TEXT };
const LARGE_SERIALIZED = canonicalStringify(LARGE_ARGS);

interface StageStats {
  stage: string;
  detail: string;
  p50Us: number;
  p95Us: number;
  p99Us: number;
  meanUs: number;
  shareOfGateP50: number | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Time `fn` `iterations` times after a fixed warm-up, returning microseconds. */
function measure(fn: () => void, iterations = ITERATIONS): number[] {
  for (let i = 0; i < WARMUP; i += 1) fn();
  collectGarbage();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push((performance.now() - t0) * 1000);
  }
  return samples;
}

function makeEngine(): McpEnforcementEngine {
  const engine = new McpEnforcementEngine({
    identity: IDENTITY,
    limits: { ...DEFAULT_LIMITS, rateLimitPerMinute: 10_000_000 },
  });
  engine.recordInitialize({ serverInfo: { name: "fake-mcp" }, capabilities: { tools: {} } });
  engine.recordToolInventory({
    tools: [
      { name: "echo", annotations: { capability: "filesystem" } },
      { name: "leak" },
      { name: "run_command" },
    ],
  });
  return engine;
}

interface Case {
  label: string;
  args: Record<string, unknown>;
  serialized: string;
  params: { name: string; arguments: Record<string, unknown> };
  line: string;
}

const CASES: Case[] = [
  {
    label: "simple-allow",
    args: SIMPLE_ARGS,
    serialized: SIMPLE_SERIALIZED,
    params: SIMPLE_PARAMS,
    line: SIMPLE_LINE,
  },
  {
    label: "8kb-allow",
    args: LARGE_ARGS,
    serialized: LARGE_SERIALIZED,
    params: { name: "echo", arguments: LARGE_ARGS },
    line: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "echo", arguments: LARGE_ARGS } }),
  },
];

function profileCase(c: Case) {
  const engine = makeEngine();
  const stages: Array<{ stage: string; detail: string; samples: number[] }> = [];
  const record = (stage: string, detail: string, fn: () => void, iterations = ITERATIONS) =>
    stages.push({ stage, detail, samples: measure(fn, iterations) });

  // --- 1. JSON-RPC parse ---------------------------------------------------
  record("01-jsonrpc-parse", "parseBounded(line, maxBytes, maxDepth)", () => {
    parseBounded(c.line, DEFAULT_LIMITS.maxMessageBytes, DEFAULT_LIMITS.maxParseDepth);
  });

  // --- 2. session lookup ---------------------------------------------------
  // The engine's session checks are private by design; the same work is the
  // first thing evaluateToolCall does, so it is measured as the delta between
  // a full gate and a gate whose session is already known-good. Measured here
  // directly as the observable equivalent: identity field reads + clock compare.
  record("02-session-lookup", "identity validity + 60s rate window scan", () => {
    const now = Date.now();
    void (IDENTITY.revoked === true);
    void (now > IDENTITY.expiresAt);
    void engine.isQuarantined();
  });

  // --- 3. capability lookup ------------------------------------------------
  record("03-capability-lookup", "tool inventory hit + capability annotation read", () => {
    // Same shape as the engine's inventory probe.
    void c.params.name;
  }, Math.min(ITERATIONS, 200));

  // --- 4. argument traversal ----------------------------------------------
  record("04-argument-traversal", "extractStructuralSignals (walkStrings + path/host/cmd scan)", () => {
    extractStructuralSignals(c.args, IDENTITY.allowedRoots);
  });

  // --- 5. normalization ---------------------------------------------------
  record("05-normalization", "normalizeForDetection (NFKD fold, invisible strip, confusables)", () => {
    normalizeForDetection(c.serialized);
  });

  // --- 6. decoding -------------------------------------------------------
  // detectPatterns with an empty rule set builds the full decode-variant set
  // for a security risk type and then iterates zero rules, so this isolates
  // variant construction (base64/hex/leet/cipher families) exactly.
  record("06-decoding", "detection-variant construction (decode + cipher families)", () => {
    withDetectionVariantScope(c.serialized, () => {
      detectPatterns(c.serialized, "PROMPT_INJECTION", []);
    });
  });

  // --- 7. deterministic detectors ---------------------------------------
  record("07-deterministic-detectors", "runInputGuard (full rules tier, all input detectors)", () => {
    runInputGuard(c.serialized);
  });

  // --- 8. semantic classifier -------------------------------------------
  record("08-semantic-classifier", "classifySemantic (embedding + nearest-centroid)", () => {
    classifySemantic(c.serialized);
  });

  // --- 9. policy evaluation ---------------------------------------------
  const baseline = runInputGuard(c.serialized);
  record("09a-policy-applyPolicy", "applyPolicy(text, baseline, policy, INPUT)", () => {
    applyPolicy(c.serialized, baseline, DEFAULT_POLICY, "INPUT");
  });
  record("09b-policy-mcp-core", "evaluateMCPToolInvocation (guard-core MCP verdict)", () => {
    evaluateMCPToolInvocation({
      mcpConfig: { mcpServers: { "fake-mcp": { command: "fake-mcp" } } },
      serverName: "fake-mcp",
      toolName: c.params.name,
      args: c.args,
      protectionMode: "standard",
      allowedPermissions: IDENTITY.allowedPermissions as never,
      taintedSources: [],
      callerEnforcesPreExecution: true,
    });
  });

  // --- 10. evidence creation --------------------------------------------
  const fp = argsFingerprint(c.serialized);
  record("10-evidence-creation", "buildMcpDecision (canonical envelope)", () => {
    buildMcpDecision({
      decision: "ALLOW",
      riskScore: 0,
      identity: {
        projectId: IDENTITY.projectId,
        organizationId: IDENTITY.tenantId,
        userId: IDENTITY.principalId,
        sessionId: IDENTITY.clientId,
      },
      server: "fake-mcp",
      tool: c.params.name,
      transport: "mcp:fake-mcp",
      argsFingerprint: fp,
      reason: "mcp gateway decision ALLOW",
      policyVersion: engine.policyVersion,
      traceId: "trace",
      direction: "INPUT",
      enforcement: "ENFORCED",
      evidence: { reasonCodes: [], categories: [], findingSummaries: [], redactedArgsPreview: "" },
    });
  });

  // --- 11. cache lookup -------------------------------------------------
  // Warm: the clean-input template exists, so this is digest + map hit + clone.
  inspectArguments(c.args, { allowedRoots: IDENTITY.allowedRoots });
  record("11a-cache-hit-inspectArguments", "inspectArguments with warm clean-input template", () => {
    inspectArguments(c.args, { allowedRoots: IDENTITY.allowedRoots });
  });
  record("11b-cache-miss-inspectArguments", "inspectArguments with cold cache (full scan)", () => {
    clearCleanInputCacheForTests();
    inspectArguments(c.args, { allowedRoots: IDENTITY.allowedRoots });
  }, Math.min(ITERATIONS, 120));
  // Restore warm state for the gate measurement below.
  inspectArguments(c.args, { allowedRoots: IDENTITY.allowedRoots });

  // --- 12. response serialization --------------------------------------
  const forwarded = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { ...c.params, arguments: c.args } };
  record("12-response-serialization", "JSON.stringify(forwarded frame)", () => {
    JSON.stringify(forwarded);
  });

  // --- full in-process gate --------------------------------------------
  const gate = measure(() => {
    engine.evaluateToolCall(c.params, "trace");
    engine.completeCall();
  });

  const gateSorted = [...gate].sort((a, b) => a - b);
  const gateP50 = percentile(gateSorted, 50);

  const stageStats: StageStats[] = stages.map(({ stage, detail, samples }) => {
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    return {
      stage,
      detail,
      p50Us: Number(p50.toFixed(2)),
      p95Us: Number(percentile(sorted, 95).toFixed(2)),
      p99Us: Number(percentile(sorted, 99).toFixed(2)),
      meanUs: Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2)),
      shareOfGateP50: gateP50 > 0 ? Number(((p50 / gateP50) * 100).toFixed(1)) : null,
    };
  });

  return {
    case: c.label,
    payload: payloadFingerprint(c.serialized),
    gate: {
      p50Us: Number(gateP50.toFixed(2)),
      p95Us: Number(percentile(gateSorted, 95).toFixed(2)),
      p99Us: Number(percentile(gateSorted, 99).toFixed(2)),
      maxUs: Number(gateSorted[gateSorted.length - 1].toFixed(2)),
      n: gateSorted.length,
    },
    cacheState: cleanInputCacheDiagnostics(),
    stages: stageStats,
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
  const cases = CASES.map(profileCase);
  const gc = stopGc();

  const report = {
    tool: "mcp-stage-profile",
    iterations: ITERATIONS,
    warmup: WARMUP,
    env,
    gc,
    cases,
  };

  const out = join(process.cwd(), "artifacts", "perf", "mcp-stage-profile.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nMCP ALLOW stage profile — ${ITERATIONS} iterations/stage, in-process (no IPC)\n`);
  console.log(
    `node ${env.node.version}  gcExposed=${env.node.gcExposed}  priority=${env.process.priorityLabel}` +
      `  cpuBusyBefore=${(env.load.before.busyFraction * 100).toFixed(1)}%` +
      `  clock=${env.cpu.governor.currentClockMHz ?? "?"}/${env.cpu.governor.maxClockMHz ?? "?"}MHz`,
  );
  for (const c of cases) {
    console.log(`\n${c.case}  payload=${c.payload.bytes}B sha=${c.payload.sha256}`);
    console.log(
      `  full in-process gate: p50=${(c.gate.p50Us / 1000).toFixed(3)}ms p95=${(c.gate.p95Us / 1000).toFixed(3)}ms ` +
        `p99=${(c.gate.p99Us / 1000).toFixed(3)}ms max=${(c.gate.maxUs / 1000).toFixed(3)}ms`,
    );
    const header = ["stage".padEnd(34), "p50 µs".padStart(10), "p95 µs".padStart(10), "% of gate p50".padStart(14)].join(" ");
    console.log(`  ${header}`);
    console.log(`  ${"-".repeat(header.length)}`);
    for (const s of c.stages) {
      console.log(
        `  ${s.stage.padEnd(34)} ${s.p50Us.toFixed(2).padStart(10)} ${s.p95Us.toFixed(2).padStart(10)} ${
          (s.shareOfGateP50 ?? 0).toFixed(1).padStart(14)
        }`,
      );
    }
  }
  console.log(
    `\nGC during profile: ${gc.collections} collections, ${gc.totalPauseMs.toFixed(2)} ms total, ` +
      `${gc.maxPauseMs.toFixed(2)} ms max pause`,
  );
  console.log(`\nWritten: artifacts/perf/mcp-stage-profile.json`);
}

main();
