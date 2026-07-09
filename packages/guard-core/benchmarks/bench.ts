/**
 * guard-core performance benchmark
 *
 * Measures scan and redaction latency across input sizes and contexts.
 * No external dependencies — only Node.js built-ins and the guard-core package.
 *
 * Usage: npx tsx packages/guard-core/benchmarks/bench.ts
 */

import { performance } from "node:perf_hooks";
import { DecisionEngine, redactText } from "../src/index";

// ── Helpers ─────────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function fmt(ms: number): string {
  return ms.toFixed(3);
}

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

function padStart(s: string, len: number): string {
  return s.length >= len ? s : " ".repeat(len - s.length) + s;
}

// ── Test input generators ───────────────────────────────────────────────────

function generate1KB(): string {
  // A short benign paragraph (~1 KB)
  const paragraph = [
    "The quick brown fox jumps over the lazy dog. ",
    "Software engineering best practices include writing clean, readable code ",
    "with proper documentation and comprehensive test coverage. ",
    "Modern applications leverage cloud infrastructure for scalability and reliability. ",
    "Continuous integration pipelines help teams deliver features faster while maintaining quality. ",
    "Code reviews ensure that changes meet the team's standards before merging into production. ",
    "Performance monitoring provides visibility into application behavior under load. ",
    "Security scanning tools detect vulnerabilities early in the development lifecycle. ",
    "Infrastructure as code enables reproducible and version-controlled environments. ",
    "Microservices architecture allows teams to deploy and scale components independently. ",
  ].join("");
  return paragraph.slice(0, 1024);
}

function generate10KB(): string {
  // Mix of code with env-like patterns
  const codeBlock = `
// config.ts
import { createServer } from "http";
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

interface Config {
  database: {
    host: string;
    port: number;
    name: string;
  };
  redis: {
    url: string;
    ttl: number;
  };
  auth: {
    jwtExpiry: string;
    refreshExpiry: string;
  };
}

export function loadConfig(): Config {
  return {
    database: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      name: process.env.DB_NAME || "myapp_dev",
    },
    redis: {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      ttl: 3600,
    },
    auth: {
      jwtExpiry: "15m",
      refreshExpiry: "7d",
    },
  };
}

// user.service.ts
interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "viewer";
}

async function findUserById(id: string): Promise<User | null> {
  // Simulated database lookup
  const users: User[] = [
    { id: "1", email: "admin@example.com", name: "Admin User", role: "admin" },
    { id: "2", email: "user@example.com", name: "Regular User", role: "user" },
  ];
  return users.find((u) => u.id === id) ?? null;
}

function validateEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

// middleware.ts
function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    // verify token logic here
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// logger.ts
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof LOG_LEVELS[number];

class Logger {
  private level: LogLevel;
  constructor(level: LogLevel = "info") {
    this.level = level;
  }
  info(msg: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: "info", msg, ...meta, ts: Date.now() }));
  }
  error(msg: string, err?: Error) {
    console.error(JSON.stringify({ level: "error", msg, stack: err?.stack, ts: Date.now() }));
  }
}
`;
  // Repeat until we reach ~10 KB
  let result = "";
  while (result.length < 10 * 1024) {
    result += codeBlock;
  }
  return result.slice(0, 10 * 1024);
}

function generate100KB(): string {
  // Large file with mixed code patterns
  const patterns = [
    '// This function processes incoming webhook payloads\n',
    'export async function processPayload(data: unknown): Promise<Result> {\n',
    '  const validated = schema.parse(data);\n',
    '  const hash = crypto.createHash("sha256").update(JSON.stringify(validated)).digest("hex");\n',
    '  logger.info("Processing payload", { hash, size: JSON.stringify(data).length });\n',
    '  return { success: true, hash };\n',
    '}\n\n',
    '// Database migration helper\n',
    'const migrations = [\n',
    '  { version: 1, up: "CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL)" },\n',
    '  { version: 2, up: "ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()" },\n',
    '  { version: 3, up: "CREATE INDEX idx_users_email ON users(email)" },\n',
    '];\n\n',
    'function generateUUID(): string {\n',
    '  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {\n',
    '    const r = (Math.random() * 16) | 0;\n',
    '    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);\n',
    '  });\n',
    '}\n\n',
    '// Rate limiter implementation\n',
    'class RateLimiter {\n',
    '  private windows = new Map<string, { count: number; resetAt: number }>();\n',
    '  check(key: string, limit: number, windowMs: number): boolean {\n',
    '    const now = Date.now();\n',
    '    const entry = this.windows.get(key);\n',
    '    if (!entry || entry.resetAt < now) {\n',
    '      this.windows.set(key, { count: 1, resetAt: now + windowMs });\n',
    '      return true;\n',
    '    }\n',
    '    return ++entry.count <= limit;\n',
    '  }\n',
    '}\n\n',
    '// Configuration validation\n',
    'const CONFIG_SCHEMA = {\n',
    '  port: { type: "number", min: 1, max: 65535, default: 3000 },\n',
    '  host: { type: "string", default: "0.0.0.0" },\n',
    '  logLevel: { type: "enum", values: ["debug", "info", "warn", "error"], default: "info" },\n',
    '  maxRequestSize: { type: "number", min: 1024, max: 10485760, default: 1048576 },\n',
    '};\n\n',
    'interface RequestContext {\n',
    '  requestId: string;\n',
    '  userId?: string;\n',
    '  startTime: number;\n',
    '  path: string;\n',
    '  method: string;\n',
    '}\n\n',
    'function createContext(req: any): RequestContext {\n',
    '  return {\n',
    '    requestId: generateUUID(),\n',
    '    userId: req.user?.id,\n',
    '    startTime: performance.now(),\n',
    '    path: req.path,\n',
    '    method: req.method,\n',
    '  };\n',
    '}\n\n',
  ];

  let result = "";
  let i = 0;
  while (result.length < 100 * 1024) {
    result += patterns[i % patterns.length];
    i++;
  }
  return result.slice(0, 100 * 1024);
}

function generate256KB(): string {
  // Large document with prose and code
  const sections = [
    "## Architecture Overview\n\n",
    "The system is composed of multiple microservices communicating through an event bus.\n",
    "Each service maintains its own database and exposes a well-defined API boundary.\n",
    "Authentication is handled centrally through an identity provider that issues JWTs.\n",
    "The API gateway performs rate limiting, request validation, and routing.\n\n",
    "### Service Registry\n\n",
    "Services register themselves on startup and send periodic heartbeats.\n",
    "The registry maintains a list of healthy instances for load balancing.\n",
    "Circuit breakers protect against cascading failures across service boundaries.\n\n",
    "### Data Flow\n\n",
    "1. Client sends a request to the API gateway.\n",
    "2. Gateway validates the JWT and extracts the user context.\n",
    "3. Request is routed to the appropriate service based on path matching.\n",
    "4. Service processes the request and publishes domain events.\n",
    "5. Downstream services consume events and update their projections.\n\n",
    "```typescript\n",
    "interface ServiceConfig {\n",
    "  name: string;\n",
    "  version: string;\n",
    "  port: number;\n",
    "  healthCheckPath: string;\n",
    "  dependencies: string[];\n",
    "}\n",
    "```\n\n",
    "### Monitoring\n\n",
    "All services emit structured logs in JSON format with correlation IDs.\n",
    "Metrics are collected via a pull-based model and stored in a time-series database.\n",
    "Alerts trigger when error rates exceed configurable thresholds.\n\n",
    "### Deployment\n\n",
    "Deployments follow a blue-green strategy with automated canary analysis.\n",
    "The CI pipeline runs unit tests, integration tests, and security scans.\n",
    "Artifacts are published to a private registry and tagged with the git SHA.\n\n",
  ];

  let result = "";
  let i = 0;
  while (result.length < 256 * 1024) {
    result += sections[i % sections.length];
    i++;
  }
  return result.slice(0, 256 * 1024);
}

function generate1MB(): string {
  // Very large input - repeat mixed patterns
  const chunk = [
    "function handleRequest(req: Request): Response {\n",
    "  const body = req.body;\n",
    "  const headers = Object.fromEntries(req.headers.entries());\n",
    "  const params = new URL(req.url).searchParams;\n",
    "  return new Response(JSON.stringify({ ok: true }), { status: 200 });\n",
    "}\n\n",
    "const ALLOWED_ORIGINS = [\n",
    '  "https://app.example.com",\n',
    '  "https://staging.example.com",\n',
    '  "http://localhost:3000",\n',
    "];\n\n",
    "// Utility functions for data transformation\n",
    "function chunk<T>(arr: T[], size: number): T[][] {\n",
    "  const result: T[][] = [];\n",
    "  for (let i = 0; i < arr.length; i += size) {\n",
    "    result.push(arr.slice(i, i + size));\n",
    "  }\n",
    "  return result;\n",
    "}\n\n",
    "function debounce<F extends (...args: any[]) => void>(fn: F, ms: number): F {\n",
    "  let timer: ReturnType<typeof setTimeout>;\n",
    "  return ((...args: any[]) => {\n",
    "    clearTimeout(timer);\n",
    "    timer = setTimeout(() => fn(...args), ms);\n",
    "  }) as F;\n",
    "}\n\n",
  ].join("");

  let result = "";
  while (result.length < 1024 * 1024) {
    result += chunk;
  }
  return result.slice(0, 1024 * 1024);
}

// ── Benchmark runner ────────────────────────────────────────────────────────

interface BenchmarkResult {
  label: string;
  sizeKB: number;
  context: string;
  operation: "scan" | "redact";
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  iterations: number;
}

const WARMUP_ITERATIONS = 50;
const MEASURE_ITERATIONS = 300;

const CONTEXTS: Array<"file" | "prompt" | "selection" | "terminal"> = [
  "file",
  "prompt",
  "selection",
  "terminal",
];

const INPUT_SPECS: Array<{ label: string; sizeKB: number; generate: () => string }> = [
  { label: "1KB", sizeKB: 1, generate: generate1KB },
  { label: "10KB", sizeKB: 10, generate: generate10KB },
  { label: "100KB", sizeKB: 100, generate: generate100KB },
  { label: "256KB", sizeKB: 256, generate: generate256KB },
  { label: "1MB", sizeKB: 1024, generate: generate1MB },
];

async function benchmarkScan(
  engine: DecisionEngine,
  input: string,
  context: "file" | "prompt" | "selection" | "terminal",
  warmup: number,
  iterations: number,
): Promise<number[]> {
  // Warm-up phase
  for (let i = 0; i < warmup; i++) {
    await engine.scan(input, { context, skipCache: true });
  }

  // Measurement phase
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await engine.scan(input, { context, skipCache: true });
    const end = performance.now();
    samples.push(end - start);
  }
  return samples;
}

function benchmarkRedact(
  input: string,
  warmup: number,
  iterations: number,
): number[] {
  // Warm-up phase
  for (let i = 0; i < warmup; i++) {
    redactText(input);
  }

  // Measurement phase
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    redactText(input);
    const end = performance.now();
    samples.push(end - start);
  }
  return samples;
}

// ── Table printer ───────────────────────────────────────────────────────────

function printTable(results: BenchmarkResult[]) {
  const COL = {
    label: 8,
    context: 12,
    op: 8,
    min: 10,
    max: 10,
    avg: 10,
    p50: 10,
    p95: 10,
    p99: 10,
    iters: 6,
  };

  const header = [
    padEnd("Size", COL.label),
    padEnd("Context", COL.context),
    padEnd("Op", COL.op),
    padStart("Min(ms)", COL.min),
    padStart("Max(ms)", COL.max),
    padStart("Avg(ms)", COL.avg),
    padStart("P50(ms)", COL.p50),
    padStart("P95(ms)", COL.p95),
    padStart("P99(ms)", COL.p99),
    padStart("N", COL.iters),
  ].join(" | ");

  const separator = "-".repeat(header.length);

  console.log("\n" + separator);
  console.log("  guard-core Performance Benchmark");
  console.log(separator);
  console.log(header);
  console.log(separator);

  for (const r of results) {
    const row = [
      padEnd(r.label, COL.label),
      padEnd(r.context, COL.context),
      padEnd(r.operation, COL.op),
      padStart(fmt(r.min), COL.min),
      padStart(fmt(r.max), COL.max),
      padStart(fmt(r.avg), COL.avg),
      padStart(fmt(r.p50), COL.p50),
      padStart(fmt(r.p95), COL.p95),
      padStart(fmt(r.p99), COL.p99),
      padStart(String(r.iterations), COL.iters),
    ].join(" | ");
    console.log(row);
  }

  console.log(separator + "\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("guard-core benchmark starting...");
  console.log(`Warmup: ${WARMUP_ITERATIONS} iterations | Measurement: ${MEASURE_ITERATIONS} iterations`);
  console.log(`Contexts: ${CONTEXTS.join(", ")}`);
  console.log(`Input sizes: ${INPUT_SPECS.map((s) => s.label).join(", ")}\n`);

  const engine = new DecisionEngine();
  const results: BenchmarkResult[] = [];

  // Pre-generate all inputs
  const inputs = new Map<string, string>();
  for (const spec of INPUT_SPECS) {
    const input = spec.generate();
    inputs.set(spec.label, input);
    console.log(`  Generated ${spec.label} input: ${input.length} bytes`);
  }
  console.log("");

  // Run scan benchmarks for each size x context combination
  for (const spec of INPUT_SPECS) {
    const input = inputs.get(spec.label)!;
    for (const ctx of CONTEXTS) {
      process.stdout.write(`  Benchmarking scan  ${spec.label} / ${ctx}...`);
      const samples = await benchmarkScan(engine, input, ctx, WARMUP_ITERATIONS, MEASURE_ITERATIONS);
      const s = stats(samples);
      results.push({
        label: spec.label,
        sizeKB: spec.sizeKB,
        context: ctx,
        operation: "scan",
        ...s,
        iterations: MEASURE_ITERATIONS,
      });
      console.log(` p50=${fmt(s.p50)}ms  p95=${fmt(s.p95)}ms`);
    }
  }

  // Run redaction benchmarks for each size (context-independent)
  for (const spec of INPUT_SPECS) {
    const input = inputs.get(spec.label)!;
    process.stdout.write(`  Benchmarking redact ${spec.label}...`);
    const samples = benchmarkRedact(input, WARMUP_ITERATIONS, MEASURE_ITERATIONS);
    const s = stats(samples);
    results.push({
      label: spec.label,
      sizeKB: spec.sizeKB,
      context: "n/a",
      operation: "redact",
      ...s,
      iterations: MEASURE_ITERATIONS,
    });
    console.log(` p50=${fmt(s.p50)}ms  p95=${fmt(s.p95)}ms`);
  }

  // Print results table
  printTable(results);

  // ── Gate checks ─────────────────────────────────────────────────────────
  let exitCode = 0;

  // p95 scan latency for 10KB must not exceed 20ms
  const scan10KB = results.filter((r) => r.sizeKB === 10 && r.operation === "scan");
  for (const r of scan10KB) {
    if (r.p95 > 20) {
      console.error(
        `FAIL: p95 scan latency for 10KB (context=${r.context}) is ${fmt(r.p95)}ms, exceeds 20ms threshold`,
      );
      exitCode = 1;
    }
  }

  // p95 scan latency for 100KB must not exceed 80ms
  const scan100KB = results.filter((r) => r.sizeKB === 100 && r.operation === "scan");
  for (const r of scan100KB) {
    if (r.p95 > 80) {
      console.error(
        `FAIL: p95 scan latency for 100KB (context=${r.context}) is ${fmt(r.p95)}ms, exceeds 80ms threshold`,
      );
      exitCode = 1;
    }
  }

  if (exitCode === 0) {
    console.log("All performance gates PASSED.");
  } else {
    console.error("\nOne or more performance gates FAILED.");
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
