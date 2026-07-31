// Inline MCP gateway latency benchmark — multi-trial, paired, cache-aware.
//
// Measures the REAL end-to-end cost of putting the inline enforcement gateway in
// front of a live MCP server child process. The same fake server is benchmarked
// twice, INTERLEAVED within every iteration:
//
//   direct   — client speaks JSON-RPC straight to the child process
//   gateway  — client speaks JSON-RPC through McpGateway -> child process
//
// Methodology notes (each one exists because the naive version is misleading):
//
//   * Paired sampling. Enforcement overhead is measured per iteration as
//     (gateway - direct) with both calls issued back to back, and the reported
//     figure is a percentile OF THE PAIRED DELTAS. Subtracting one path's p95
//     from the other's — the previous approach — silently attributes background
//     CPU drift to policy cost; on a shared laptop that drift is larger than
//     most code changes. The leading path alternates by iteration parity so
//     "who goes first" cannot bias the delta either.
//
//   * Independent trials. Each trial gets fresh child processes and a fresh
//     engine, so no rate-limit window, circuit-breaker state, cache or JIT
//     profile carries over. Per-trial percentiles are reported along with the
//     median trial and the spread across trials, because a single 300-iteration
//     run is not reproducible evidence on its own.
//
//   * Cache state is explicit. The clean-input cache stores zero-finding
//     LOW_RISK verdicts, so re-sending one identical payload 300 times measures
//     the WARM path after iteration 1. Every ALLOW bucket therefore ships in two
//     variants: `-warm` (one repeated payload) and `-cold` (a unique payload per
//     iteration, letters-only tag so no extra decode variant is triggered, byte
//     length held constant). BLOCK and result-redact have no cache path.
//
//   * Nothing is weakened to make the numbers look better. No detector is
//     disabled, no threshold moved, no limit relaxed: the rate limit is honoured
//     by using one session per trial, exactly as a real client would.
//
// Usage:  npx tsx --expose-gc scripts/mcpLatencyBench.ts [iterations] [--trials N]
//         npx tsx scripts/mcpLatencyBench.ts 300 --trials 5 --json
//
// Exit code is non-zero if a bucket misses its absolute p95 budget on the median
// trial, if paired enforcement overhead exceeds its budget, or if any bucket did
// not take the decision path it claims to measure.

import { performance } from "node:perf_hooks";
import { PassThrough } from "node:stream";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { McpEnforcementEngine } from "../lib/gateway/mcp/engine";
import { McpGateway } from "../lib/gateway/mcp/proxy";
import { StreamTransport, ChildProcessTransport } from "../lib/gateway/mcp/stdio";
import { DEFAULT_LIMITS, RPC, type McpSessionIdentity } from "../lib/gateway/mcp/types";
import {
  clearCleanInputCacheForTests,
  cleanInputCacheDiagnostics,
} from "../lib/gateway/mcp/inspect";

import {
  collectGarbage,
  enterBenchmarkMode,
  payloadFingerprint,
  startGcAccounting,
} from "./perf/env-fingerprint";

const FAKE_SERVER = join(__dirname, "fake-mcp-server.mjs");

const ITERATIONS = Number(process.argv[2]?.replace(/\D/g, "") || 300);
const TRIALS = (() => {
  const flag = process.argv.indexOf("--trials");
  const value = flag >= 0 ? Number(process.argv[flag + 1]?.replace(/\D/g, "")) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 5;
})();
const AS_JSON = process.argv.includes("--json");
const WARMUP = 20;

/**
 * Absolute p95 budget for the GATEWAY path, in milliseconds — the number a user
 * actually waits. Checked against the median trial.
 */
const GATEWAY_P95_BUDGET_MS: Record<string, number> = {
  "allow-simple-warm": 8,
  "allow-simple-cold": 8,
  "allow-large-warm": 25,
  "allow-large-cold": 25,
  block: 8,
  "result-redact": 12,
};

/** p95 budget for the PAIRED enforcement overhead (gateway - direct), in ms. */
const OVERHEAD_P95_BUDGET_MS: Record<string, number> = {
  "allow-simple-warm": 8,
  "allow-simple-cold": 8,
  "allow-large-warm": 25,
  "allow-large-cold": 25,
  block: 8,
  "result-redact": 12,
};

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

const LARGE_TEXT = "The quarterly onboarding checklist item. ".repeat(200); // ~8KB

/** Letters-only counter so a unique payload adds no digits (digits would add a leet decode variant). */
function letterTag(value: number, width = 6): string {
  let n = value;
  let out = "";
  for (let i = 0; i < width; i += 1) {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return `u${out}`;
}

interface Bucket {
  name: string;
  /** WARM = one repeated payload (cache hit after the first call); COLD = unique every call. */
  cacheState: "WARM" | "COLD" | "NOT_CACHEABLE";
  expect: "result" | "blocked";
  params: (iteration: number) => { name: string; arguments: Record<string, unknown> };
}

const BUCKETS: Bucket[] = [
  {
    name: "allow-simple-warm",
    cacheState: "WARM",
    expect: "result",
    params: () => ({ name: "echo", arguments: { text: "hello" } }),
  },
  {
    name: "allow-simple-cold",
    cacheState: "COLD",
    expect: "result",
    params: (i) => ({ name: "echo", arguments: { text: `hello ${letterTag(i)}` } }),
  },
  {
    name: "allow-large-warm",
    cacheState: "WARM",
    expect: "result",
    params: () => ({ name: "echo", arguments: { text: LARGE_TEXT } }),
  },
  {
    name: "allow-large-cold",
    cacheState: "COLD",
    expect: "result",
    // The tag replaces the first 7 characters instead of extending the text, so
    // every cold payload is byte-identical in size to the warm one.
    params: (i) => ({ name: "echo", arguments: { text: letterTag(i) + LARGE_TEXT.slice(7) } }),
  },
  {
    name: "block",
    cacheState: "NOT_CACHEABLE",
    expect: "blocked",
    params: () => ({ name: "run_command", arguments: { command: "rm -rf /" } }),
  },
  {
    name: "result-redact",
    cacheState: "NOT_CACHEABLE",
    expect: "result",
    params: () => ({ name: "leak", arguments: {} }),
  },
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function jsonRpc(method: string, params: unknown, id: number): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
}

/**
 * Reads newline-delimited JSON from a stream, resolving one message per await.
 *
 * Messages that arrive with no waiter pending are QUEUED, not dropped. This
 * matters because locally-answered decisions (BLOCK / REQUIRE_APPROVAL) are
 * written by the gateway synchronously inside `clientReadable.write(...)`,
 * so the response can be emitted before the caller registers its waiter.
 */
class LineReader {
  private buffer = "";
  private readonly waiters: Array<(v: unknown) => void> = [];
  private readonly queued: unknown[] = [];

  constructor(stream: NodeJS.ReadableStream) {
    stream.on("data", (chunk: Buffer | string) => {
      this.buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        const waiter = this.waiters.shift();
        if (waiter) waiter(msg);
        else this.queued.push(msg);
      }
    });
  }

  next(timeoutMs = 30_000): Promise<unknown> {
    const ready = this.queued.shift();
    if (ready !== undefined) return Promise.resolve(ready);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("bench: timeout waiting for response")), timeoutMs);
      this.waiters.push((v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  n: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function summarize(samples: number[]): Percentiles {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    mean: round(samples.reduce((a, b) => a + b, 0) / (samples.length || 1)),
    min: round(sorted[0] ?? Number.NaN),
    max: round(sorted[sorted.length - 1] ?? Number.NaN),
    n: samples.length,
  };
}

/** Median of a numeric list (lower median for even counts, so it is an observed value). */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length / 2) - 1)];
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Measured endpoints
// ---------------------------------------------------------------------------

/**
 * Production limits, UNCHANGED — including rateLimitPerMinute (600).
 *
 * 6 buckets x 300 iterations = 1800 calls, which a single session could not
 * admit under a 600/min window. Rather than raise the limit (that would be
 * "relaxing a budget without evidence"), each bucket gets its OWN session and
 * its own upstream child process: 20 warm-up + 300 measured = 320 calls per
 * session, inside the production window. Nothing is relaxed, and the rate
 * limiter stays armed for every measured call.
 */
const LIMITS = DEFAULT_LIMITS;

interface Endpoint {
  label: "direct" | "gateway";
  send(line: string): void;
  reader: LineReader;
  close(): void;
}

/** Client talking JSON-RPC straight to the child process — no enforcement. */
function makeDirectEndpoint(): Endpoint {
  const child: ChildProcess = spawn(process.execPath, [FAKE_SERVER], {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });
  child.stderr?.on("data", () => {});
  const reader = new LineReader(child.stdout as NodeJS.ReadableStream);
  return {
    label: "direct",
    send: (line) => {
      child.stdin?.write(line);
    },
    reader,
    close: () => {
      try {
        child.stdin?.end();
        child.kill();
      } catch {
        /* ignore */
      }
    },
  };
}

interface GatewayEndpoint extends Endpoint {
  engine: McpEnforcementEngine;
}

/**
 * Client talking JSON-RPC through the real McpGateway to the child process.
 *
 * The client side is a pair of in-process streams, which is exactly what the
 * gateway sees when it is launched as a stdio server. This adds ONE extra
 * in-process stream hop on the request path relative to the direct endpoint,
 * so it can only inflate the measured overhead, never flatter it.
 */
function makeGatewayEndpoint(): GatewayEndpoint {
  const toGateway = new PassThrough();
  const fromGateway = new PassThrough();
  const client = new StreamTransport(toGateway, fromGateway, LIMITS.maxMessageBytes);
  const upstream = new ChildProcessTransport(
    { command: process.execPath, args: [FAKE_SERVER] },
    LIMITS.maxMessageBytes,
  );
  const engine = new McpEnforcementEngine({
    identity: { ...IDENTITY, expiresAt: Date.now() + 3_600_000 },
    limits: LIMITS,
  });
  const gateway = new McpGateway({ engine, client, upstream, limits: LIMITS });
  const reader = new LineReader(fromGateway);
  return {
    label: "gateway",
    engine,
    send: (line) => {
      toGateway.write(line);
    },
    reader,
    close: () => {
      try {
        gateway.shutdown();
      } catch {
        /* ignore */
      }
    },
  };
}

let nextId = 1;

/** One request/response round trip, timed in milliseconds. */
async function timedCall(
  ep: Endpoint,
  method: string,
  params: unknown,
): Promise<{ ms: number; response: Record<string, unknown> }> {
  const id = (nextId += 1);
  const line = jsonRpc(method, params, id);
  const t0 = performance.now();
  ep.send(line);
  const response = (await ep.reader.next()) as Record<string, unknown>;
  const ms = performance.now() - t0;
  if (response.id !== id) throw new Error(`bench: response id mismatch (${String(response.id)} != ${id})`);
  return { ms, response };
}

// ---------------------------------------------------------------------------
// Decision-path verification
// ---------------------------------------------------------------------------

/** The literal the fake upstream returns for `leak`; must never reach the client. */
const UPSTREAM_SECRET = "sk-ABCDEF1234567890abcdef1234567890";

/**
 * A latency number is only meaningful if the call actually took the decision
 * path the bucket claims to measure. A BLOCK bucket that silently started
 * ALLOWing would look fast and be worthless, so every measured gateway
 * response is checked.
 */
function verifyGatewayResponse(bucket: Bucket, response: Record<string, unknown>): { ok: boolean; note: string } {
  const error = response.error as { code?: number; data?: { decision?: string } } | undefined;
  if (bucket.expect === "blocked") {
    if (!error) return { ok: false, note: "expected a blocked call, got a result" };
    if (error.code !== RPC.SOTER_BLOCKED) {
      return { ok: false, note: `blocked with unexpected code ${String(error.code)}` };
    }
    if (error.data?.decision !== "BLOCK") {
      return { ok: false, note: `blocked with decision ${String(error.data?.decision)}` };
    }
    return { ok: true, note: "BLOCK answered locally, never forwarded upstream" };
  }
  if (error) return { ok: false, note: `expected a result, got error ${String(error.code)}` };
  if (response.result === undefined) return { ok: false, note: "response carried neither result nor error" };
  const serialized = JSON.stringify(response.result);
  if (bucket.name === "result-redact") {
    if (serialized.includes(UPSTREAM_SECRET)) {
      return { ok: false, note: "upstream secret reached the client unredacted" };
    }
    return { ok: true, note: "result released with the upstream secret redacted" };
  }
  if (!serialized.includes("ok:echo")) return { ok: false, note: "echo result payload unexpected" };
  return { ok: true, note: "ALLOW forwarded upstream and result released" };
}

async function handshake(ep: Endpoint): Promise<void> {
  await timedCall(ep, "initialize", {
    protocolVersion: "2024-11-05",
    clientInfo: { name: "mcp-latency-bench", version: "0" },
    capabilities: {},
  });
  // The gateway captures this result to bind the tool inventory, so the
  // undeclared-tool check is armed for every measured call.
  await timedCall(ep, "tools/list", {});
}

// ---------------------------------------------------------------------------
// Bucket run
// ---------------------------------------------------------------------------

interface BucketRun {
  name: string;
  cacheState: Bucket["cacheState"];
  expect: Bucket["expect"];
  gateway: Percentiles;
  direct: Percentiles;
  /** Paired per-iteration (gateway - direct); can be negative for BLOCK. */
  overhead: Percentiles;
  payload: { bytes: number; sha256: string };
  uniquePayloads: number;
  decisionPathVerified: boolean;
  decisionPathNote: string;
  cleanInputCacheAfter: { size: number; maxEntries: number };
}

async function runBucket(bucket: Bucket, iterations: number): Promise<BucketRun> {
  const direct = makeDirectEndpoint();
  const gateway = makeGatewayEndpoint();
  try {
    await handshake(direct);
    await handshake(gateway);

    // Cache state is explicit: every bucket starts from an empty clean-input
    // cache, then warm-up establishes the state the bucket name advertises
    // (WARM = the measured payload is already templated; COLD = never).
    clearCleanInputCacheForTests();
    for (let i = 0; i < WARMUP; i += 1) {
      const params = bucket.params(iterations + i);
      await timedCall(direct, "tools/call", params);
      await timedCall(gateway, "tools/call", params);
    }
    if (bucket.cacheState === "WARM") {
      // Prime with the exact measured payload so no measured iteration pays a miss.
      await timedCall(gateway, "tools/call", bucket.params(0));
    }
    collectGarbage();

    const gatewayMs: number[] = [];
    const directMs: number[] = [];
    const overheadMs: number[] = [];
    const payloadHashes = new Set<string>();
    let verified = true;
    let note = "";
    let firstPayload = { bytes: 0, sha256: "" };

    for (let i = 0; i < iterations; i += 1) {
      const params = bucket.params(i);
      const serializedArgs = JSON.stringify(params.arguments ?? {});
      const fp = payloadFingerprint(serializedArgs);
      if (i === 0) firstPayload = fp;
      payloadHashes.add(fp.sha256);

      let g: number;
      let d: number;
      let response: Record<string, unknown>;
      // The leading path alternates by iteration parity so "who goes first"
      // cannot bias the paired delta in either direction.
      if (i % 2 === 0) {
        d = (await timedCall(direct, "tools/call", params)).ms;
        const gr = await timedCall(gateway, "tools/call", params);
        g = gr.ms;
        response = gr.response;
      } else {
        const gr = await timedCall(gateway, "tools/call", params);
        g = gr.ms;
        response = gr.response;
        d = (await timedCall(direct, "tools/call", params)).ms;
      }
      const check = verifyGatewayResponse(bucket, response);
      if (!check.ok) {
        verified = false;
        if (!note) note = `iteration ${i}: ${check.note}`;
      } else if (!note) {
        note = check.note;
      }
      gatewayMs.push(g);
      directMs.push(d);
      overheadMs.push(g - d);
    }

    return {
      name: bucket.name,
      cacheState: bucket.cacheState,
      expect: bucket.expect,
      gateway: summarize(gatewayMs),
      direct: summarize(directMs),
      overhead: summarize(overheadMs),
      payload: firstPayload,
      uniquePayloads: payloadHashes.size,
      decisionPathVerified: verified,
      decisionPathNote: note,
      cleanInputCacheAfter: cleanInputCacheDiagnostics(),
    };
  } finally {
    gateway.close();
    direct.close();
  }
}

// ---------------------------------------------------------------------------
// Trials & aggregation
// ---------------------------------------------------------------------------

interface TrialResult {
  index: number;
  startedAt: string;
  durationMs: number;
  cpu: { userMs: number; systemMs: number };
  rssMiB: number;
  buckets: BucketRun[];
}

async function runTrial(index: number, iterations: number): Promise<TrialResult> {
  const startedAt = new Date().toISOString();
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  const buckets: BucketRun[] = [];
  for (const bucket of BUCKETS) {
    buckets.push(await runBucket(bucket, iterations));
    collectGarbage();
  }
  const cpu = process.cpuUsage(cpu0);
  return {
    index,
    startedAt,
    durationMs: round(performance.now() - t0),
    cpu: { userMs: round(cpu.user / 1000), systemMs: round(cpu.system / 1000) },
    rssMiB: round(process.memoryUsage().rss / 1024 / 1024),
    buckets,
  };
}

interface Spread {
  min: number;
  median: number;
  max: number;
  mean: number;
  stddev: number;
  spread: number;
  cvPct: number;
}

function spreadOf(values: number[]): Spread {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const sd = stddev(values);
  return {
    min: round(Math.min(...values)),
    median: round(medianOf(values)),
    max: round(Math.max(...values)),
    mean: round(mean),
    stddev: round(sd),
    spread: round(Math.max(...values) - Math.min(...values)),
    cvPct: mean !== 0 ? round((sd / Math.abs(mean)) * 100) : 0,
  };
}

interface Gate {
  metric: string;
  valueMs: number;
  budgetMs: number;
  pass: boolean;
}

interface BucketAggregate {
  name: string;
  cacheState: Bucket["cacheState"];
  expect: Bucket["expect"];
  payload: { bytes: number; sha256: string };
  uniquePayloads: number;
  /** Index of the trial whose gateway p95 is the median across trials. */
  medianTrialIndex: number;
  medianTrial: { gateway: Percentiles; direct: Percentiles; overhead: Percentiles };
  acrossTrials: {
    gatewayP50: Spread;
    gatewayP95: Spread;
    gatewayP99: Spread;
    directP50: Spread;
    directP95: Spread;
    directP99: Spread;
    overheadP50: Spread;
    overheadP95: Spread;
    overheadP99: Spread;
  };
  decisionPathVerifiedInAllTrials: boolean;
  decisionPathNote: string;
  cleanInputCacheAfter: { size: number; maxEntries: number };
  gates: Gate[];
}

function aggregateBucket(name: string, trials: TrialResult[]): BucketAggregate {
  const runs = trials.map((t) => {
    const run = t.buckets.find((b) => b.name === name);
    if (!run) throw new Error(`bench: trial ${t.index} is missing bucket ${name}`);
    return { trial: t.index, run };
  });

  const p95s = runs.map((r) => r.run.gateway.p95);
  const medianP95 = medianOf(p95s);
  const median = runs.find((r) => r.run.gateway.p95 === medianP95) ?? runs[0];
  const first = runs[0].run;

  const pick = (fn: (r: BucketRun) => number) => spreadOf(runs.map((r) => fn(r.run)));
  const gatewayBudget = GATEWAY_P95_BUDGET_MS[name];
  const overheadBudget = OVERHEAD_P95_BUDGET_MS[name];
  const verified = runs.every((r) => r.run.decisionPathVerified);
  const failing = runs.find((r) => !r.run.decisionPathVerified);

  return {
    name,
    cacheState: first.cacheState,
    expect: first.expect,
    payload: median.run.payload,
    uniquePayloads: median.run.uniquePayloads,
    medianTrialIndex: median.trial,
    medianTrial: {
      gateway: median.run.gateway,
      direct: median.run.direct,
      overhead: median.run.overhead,
    },
    acrossTrials: {
      gatewayP50: pick((r) => r.gateway.p50),
      gatewayP95: pick((r) => r.gateway.p95),
      gatewayP99: pick((r) => r.gateway.p99),
      directP50: pick((r) => r.direct.p50),
      directP95: pick((r) => r.direct.p95),
      directP99: pick((r) => r.direct.p99),
      overheadP50: pick((r) => r.overhead.p50),
      overheadP95: pick((r) => r.overhead.p95),
      overheadP99: pick((r) => r.overhead.p99),
    },
    decisionPathVerifiedInAllTrials: verified,
    decisionPathNote: failing ? failing.run.decisionPathNote : first.decisionPathNote,
    cleanInputCacheAfter: median.run.cleanInputCacheAfter,
    gates: [
      {
        metric: "gateway p95 (median trial)",
        valueMs: median.run.gateway.p95,
        budgetMs: gatewayBudget,
        pass: median.run.gateway.p95 <= gatewayBudget,
      },
      {
        metric: "paired enforcement overhead p95 (median trial)",
        valueMs: median.run.overhead.p95,
        budgetMs: overheadBudget,
        pass: median.run.overhead.p95 <= overheadBudget,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function outputPath(): string {
  const flag = process.argv.indexOf("--out");
  if (flag >= 0 && process.argv[flag + 1]) return process.argv[flag + 1];
  return join(process.cwd(), "artifacts", "perf", "mcp-latency-bench.json");
}

async function main(): Promise<void> {
  const env = enterBenchmarkMode({
    priority: "above_normal",
    warmupIterations: WARMUP,
    gcBetweenPhases: true,
    env: { SOTERAI_DETECTION_TIER: process.env.SOTERAI_DETECTION_TIER ?? "hybrid" },
  });
  const stopGc = startGcAccounting();

  const trials: TrialResult[] = [];
  for (let t = 1; t <= TRIALS; t += 1) {
    if (!AS_JSON) process.stderr.write(`trial ${t}/${TRIALS} ...\n`);
    trials.push(await runTrial(t, ITERATIONS));
  }
  const gc = stopGc();

  const aggregates = BUCKETS.map((b) => aggregateBucket(b.name, trials));
  const failedGates = aggregates.flatMap((a) =>
    a.gates.filter((g) => !g.pass).map((g) => `${a.name}: ${g.metric} ${g.valueMs}ms > ${g.budgetMs}ms`),
  );
  const wrongPaths = aggregates
    .filter((a) => !a.decisionPathVerifiedInAllTrials)
    .map((a) => `${a.name}: ${a.decisionPathNote}`);

  const report = {
    tool: "mcp-latency-bench",
    schema: 2,
    iterations: ITERATIONS,
    trials: TRIALS,
    warmup: WARMUP,
    controls: {
      pairedSampling: true,
      leadPathAlternatesByParity: true,
      independentTrials: true,
      freshChildProcessPerBucket: true,
      sessionsPerTrial: BUCKETS.length,
      callsPerSession: ITERATIONS + WARMUP + 1,
      rateLimitPerMinute: LIMITS.rateLimitPerMinute,
      limitsRelaxed: false,
      detectorsDisabled: false,
      note:
        "One session per bucket keeps every session inside the production 600/min rate window, " +
        "so no limit is raised for the benchmark. The rate limiter is armed on every measured call.",
    },
    env,
    gc,
    gates: { passed: failedGates.length === 0 && wrongPaths.length === 0, failedGates, wrongPaths },
    buckets: aggregates,
    trialDetail: trials,
  };

  const out = outputPath();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `\nMCP gateway latency — ${TRIALS} independent trials x ${ITERATIONS} iterations, paired per iteration\n`,
    );
    console.log(
      `node ${env.node.version}  gcExposed=${env.node.gcExposed}  priority=${env.process.priorityLabel}` +
        `  cpuBusyBefore=${(env.load.before.busyFraction * 100).toFixed(1)}%` +
        `  clock=${env.cpu.governor.currentClockMHz ?? "?"}/${env.cpu.governor.maxClockMHz ?? "?"}MHz`,
    );
    const header = [
      "bucket".padEnd(19),
      "cache".padEnd(6),
      "direct p95".padStart(11),
      "gw p50".padStart(8),
      "gw p95".padStart(8),
      "gw p99".padStart(8),
      "ovh p95".padStart(9),
      "budget".padStart(7),
      "gate".padStart(5),
      "gw p95 across trials".padStart(24),
    ].join(" ");
    console.log(`\n  ${header}`);
    console.log(`  ${"-".repeat(header.length)}`);
    for (const a of aggregates) {
      const s = a.acrossTrials.gatewayP95;
      const gate = a.gates.every((g) => g.pass) ? "PASS" : "MISS";
      console.log(
        `  ${a.name.padEnd(19)} ${a.cacheState.slice(0, 4).padEnd(6)} ` +
          `${a.medianTrial.direct.p95.toFixed(3).padStart(11)} ${a.medianTrial.gateway.p50.toFixed(3).padStart(8)} ` +
          `${a.medianTrial.gateway.p95.toFixed(3).padStart(8)} ${a.medianTrial.gateway.p99.toFixed(3).padStart(8)} ` +
          `${a.medianTrial.overhead.p95.toFixed(3).padStart(9)} ` +
          `${String(GATEWAY_P95_BUDGET_MS[a.name]).padStart(7)} ${gate.padStart(5)} ` +
          `${`${s.min.toFixed(2)}-${s.max.toFixed(2)} cv=${s.cvPct.toFixed(1)}%`.padStart(24)}`,
      );
    }
    console.log(`\n  decision paths verified: ${aggregates.every((a) => a.decisionPathVerifiedInAllTrials) ? "all buckets, all trials" : "FAILED"}`);
    for (const a of aggregates) console.log(`    ${a.name.padEnd(19)} ${a.decisionPathNote}`);
    console.log(
      `\n  GC during run: ${gc.collections} collections, ${gc.totalPauseMs.toFixed(2)} ms total, ${gc.maxPauseMs.toFixed(2)} ms max pause`,
    );
    console.log(`  BLOCK is answered locally with no upstream IPC, so its paired overhead can be negative by design.`);
    console.log(`\nWritten: ${out}`);
    if (failedGates.length) {
      console.log(`\nBUDGET MISSES (${failedGates.length}):`);
      for (const f of failedGates) console.log(`  - ${f}`);
    }
    if (wrongPaths.length) {
      console.log(`\nWRONG DECISION PATH (${wrongPaths.length}):`);
      for (const f of wrongPaths) console.log(`  - ${f}`);
    }
  }

  if (!report.gates.passed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
