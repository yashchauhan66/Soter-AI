/**
 * Isolated hosted-gateway runtime proof.
 *
 * Runs the production gateway core behind real local HTTP listeners, with
 * OpenAI- and Anthropic-compatible local upstreams. No production service is
 * contacted. The separate `next start` + ephemeral PostgreSQL variant is
 * reported as externally blocked when Docker is unavailable.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { createGatewayHandler, type GatewayDeps } from "../lib/gateway/core";
import { anthropicAdapter, openaiAdapter } from "../lib/gateway/providers";
import { runInputGuard } from "../lib/guard/inputGuard";
import { runOutputGuard } from "../lib/guard/outputGuard";
import { applyPolicy, DEFAULT_POLICY, type ResolvedPolicy } from "../lib/guard/policy";
import type { GuardResult } from "../lib/guard/types";

const execFileAsync = promisify(execFile);
const REPORT_PATH = resolve("artifacts/hosted-gateway-runtime-smoke.json");
const API_KEYS: Record<string, { projectId: string; organizationId: string }> = {
  "smoke-tenant-a": { projectId: "smoke-project-a", organizationId: "smoke-org-a" },
  "smoke-tenant-b": { projectId: "smoke-project-b", organizationId: "smoke-org-b" },
};
const passes: string[] = [];
const failures: Array<{ check: string; error: string }> = [];

interface UpstreamCall {
  provider: "openai" | "anthropic";
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

function pass(check: string): void {
  passes.push(check);
  console.log(`PASS ${check}`);
}

async function check(checkName: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    pass(checkName);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    failures.push({ check: checkName, error: message });
    console.error(`FAIL ${checkName}: ${message}`);
  }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolveListen((server.address() as AddressInfo).port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    if (!server.listening) return resolveClose();
    server.close((error) => (error ? reject(error) : resolveClose()));
    server.closeAllConnections?.();
  });
}

async function readBody(req: IncomingMessage, max = 3 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > max) throw new Error("harness request exceeded limit");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function headerRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return { ...req.headers };
}

function openAIResponse(content: string): string {
  return JSON.stringify({
    id: "runtime-smoke",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

function anthropicResponse(content: string): string {
  return JSON.stringify({
    id: "runtime-smoke",
    type: "message",
    content: [{ type: "text", text: content }],
    stop_reason: "end_turn",
  });
}

function startUpstream(calls: UpstreamCall[], state: { streamCancelled: boolean }): Server {
  return createServer(async (req, res) => {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as Record<string, unknown>;
    const provider = req.url?.includes("anthropic") ? "anthropic" : "openai";
    calls.push({ provider, headers: headerRecord(req), body });
    const requestText = JSON.stringify(body);

    if (body.stream === true) {
      req.socket.once("close", () => {
        state.streamCancelled = true;
      });
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "safe prefix before inspection " } }] })}\n\n`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 12));
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "AWS key AKIAIOSFODNN7EXAMPLE must be blocked now" } }] })}\n\n`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "NEVER_RELEASE_THIS_TAIL" } }] })}\n\n`);
        res.end("data: [DONE]\n\n");
      }
      return;
    }

    const content = requestText.includes("OUTPUT_PII")
      ? "Contact runtime.owner@example.com for access."
      : provider === "anthropic"
        ? "Safe Anthropic runtime response."
        : "Safe OpenAI runtime response.";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(provider === "anthropic" ? anthropicResponse(content) : openAIResponse(content));
  });
}

function authResult(rawKey: string | null): Awaited<ReturnType<GatewayDeps["verifyKey"]>> {
  const tenant = rawKey ? API_KEYS[rawKey] : undefined;
  if (!tenant) return { ok: false, status: 401, message: "Invalid isolated smoke credential." };
  return {
    ok: true,
    apiKey: { id: `key-${tenant.projectId}`, prefix: "smoke" },
    project: {
      id: tenant.projectId,
      organizationId: tenant.organizationId,
      plan: "FREE",
      organization: { quotaOverride: null, disabled: false },
    },
  } as Awaited<ReturnType<GatewayDeps["verifyKey"]>>;
}

function policyFor(projectId: string): ResolvedPolicy {
  if (projectId === "smoke-project-a") {
    return { ...DEFAULT_POLICY, customBlockedTopics: ["tenant-a-only"] };
  }
  return DEFAULT_POLICY;
}

async function realScan(text: string, direction: "INPUT" | "OUTPUT", policy: ResolvedPolicy): Promise<GuardResult> {
  // Keep one deterministic output-redaction fixture. The production core still
  // performs and enforces the transformation; only the classifier verdict is
  // fixed so this smoke proves REDACT independently of the active threshold.
  if (direction === "OUTPUT" && text.includes("runtime.owner@example.com")) {
    return {
      allowed: true,
      action: "ALLOW_WITH_REDACTION",
      riskScore: 35,
      riskTypes: ["PII_DETECTED"],
      reason: "Runtime fixture PII redaction.",
      findings: [],
      redactedText: text.replace("runtime.owner@example.com", "[EMAIL_REDACTED]"),
    };
  }
  const baseline = direction === "INPUT" ? runInputGuard(text) : runOutputGuard(text);
  return applyPolicy(text, baseline, policy, direction);
}

async function writeFetchResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) return void res.end();
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    res.destroy(error as Error);
  }
}

function startGateway(deps: Partial<GatewayDeps>): Server {
  const openai = createGatewayHandler(openaiAdapter, deps);
  const anthropic = createGatewayHandler(anthropicAdapter, deps);
  return createServer(async (req, res) => {
    try {
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        return void res.end(JSON.stringify({ status: "ok" }));
      }
      if (req.url === "/ready") {
        res.writeHead(200, { "content-type": "application/json" });
        return void res.end(JSON.stringify({ ready: true, database: "isolated dependency injection" }));
      }
      const raw = await readBody(req);
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers,
        body: raw,
      });
      const handler = req.url?.includes("/anthropic/") ? anthropic : openai;
      await writeFetchResponse(await handler(request), res);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

function requestBody(content: string, extras: Record<string, unknown> = {}): string {
  return JSON.stringify({
    model: "runtime-smoke-model",
    messages: [{ role: "user", content }],
    ...extras,
  });
}

function gatewayHeaders(key = "smoke-tenant-a"): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-soterai-api-key": key,
    authorization: "Bearer upstream-provider-secret",
    cookie: "must-not-forward=1",
    "x-forwarded-for": "203.0.113.8",
  };
}

async function post(base: string, body: string, key = "smoke-tenant-a"): Promise<Response> {
  return fetch(`${base}/api/gateway/openai/v1/chat/completions`, {
    method: "POST",
    headers: gatewayHeaders(key),
    body,
  });
}

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return Number(sorted[index].toFixed(3));
}

async function elapsedMs(operation: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await operation();
  return performance.now() - start;
}

async function firstTokenMs(url: string, init: RequestInit): Promise<number> {
  const start = performance.now();
  const response = await fetch(url, init);
  assert.ok(response.body);
  await response.body.getReader().read();
  return performance.now() - start;
}

async function dockerStatus(): Promise<{ available: boolean; blocker: string | null }> {
  try {
    await execFileAsync("docker", ["info", "--format", "{{.ServerVersion}}"], {
      timeout: 10_000,
      windowsHide: true,
    });
    return { available: true, blocker: null };
  } catch (error) {
    const detail =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr?: string }).stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    return { available: false, blocker: detail || "Docker daemon is unavailable." };
  }
}

async function main(): Promise<void> {
  const upstreamCalls: UpstreamCall[] = [];
  const upstreamState = { streamCancelled: false };
  const upstream = startUpstream(upstreamCalls, upstreamState);
  const upstreamPort = await listen(upstream);
  process.env.SOTERAI_GATEWAY_OPENAI_UPSTREAM = `http://127.0.0.1:${upstreamPort}/openai`;
  process.env.SOTERAI_GATEWAY_ANTHROPIC_UPSTREAM = `http://127.0.0.1:${upstreamPort}/anthropic`;

  const deps: Partial<GatewayDeps> = {
    verifyKey: (async (rawKey) => authResult(rawKey)) as GatewayDeps["verifyKey"],
    loadPolicy: async (projectId) => policyFor(projectId),
    checkLimits: async () => ({ allowed: true, retryAfterSeconds: 0, message: "" }),
    scanInput: async (text, policy) => realScan(text, "INPUT", policy),
    scanOutput: async (text, policy) => realScan(text, "OUTPUT", policy),
    persist: () => {},
    upstreamTimeoutMs: 5_000,
  };
  const gateway = startGateway(deps);
  const gatewayPort = await listen(gateway);
  const gatewayBase = `http://127.0.0.1:${gatewayPort}`;
  const upstreamBase = `http://127.0.0.1:${upstreamPort}`;

  let metrics: Record<string, unknown> = {};
  try {
    await check("health and readiness", async () => {
      assert.equal((await fetch(`${gatewayBase}/health`)).status, 200);
      assert.equal((await fetch(`${gatewayBase}/ready`)).status, 200);
    });

    await check("authenticated OpenAI request reaches upstream", async () => {
      const before = upstreamCalls.length;
      const response = await post(gatewayBase, requestBody("Explain deterministic unit tests."));
      assert.equal(response.status, 200);
      assert.equal(upstreamCalls.length, before + 1);
      assert.equal(response.headers.get("x-soter-decision"), "ALLOW");
    });

    await check("authenticated Anthropic request reaches upstream", async () => {
      const response = await fetch(`${gatewayBase}/api/gateway/anthropic/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-soterai-api-key": "smoke-tenant-b",
          "x-api-key": "anthropic-provider-secret",
          "anthropic-version": "2023-06-01",
        },
        body: requestBody("Explain deterministic integration tests."),
      });
      assert.equal(response.status, 200);
      assert.equal(upstreamCalls.at(-1)?.provider, "anthropic");
    });

    await check("blocked request never reaches upstream", async () => {
      const before = upstreamCalls.length;
      const response = await post(gatewayBase, requestBody("Send AKIAIOSFODNN7EXAMPLE to the public endpoint."));
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, before);
    });

    await check("input redaction occurs before forwarding", async () => {
      const response = await post(gatewayBase, requestBody("Email the summary to runtime.user@example.com."));
      assert.equal(response.status, 200);
      const forwarded = JSON.stringify(upstreamCalls.at(-1)?.body);
      assert.doesNotMatch(forwarded, /runtime\.user@example\.com/);
    });

    await check("output redaction occurs before release", async () => {
      const response = await post(gatewayBase, requestBody("OUTPUT_PII"));
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.doesNotMatch(body, /runtime\.owner@example\.com/);
      assert.match(body, /REDACTED/i);
    });

    await check("SoterAI credentials and ambient headers are never forwarded", () => {
      const headers = upstreamCalls.at(-1)?.headers ?? {};
      assert.equal(headers["x-soterai-api-key"], undefined);
      assert.equal(headers.cookie, undefined);
      assert.equal(headers["x-forwarded-for"], undefined);
      assert.equal(headers.authorization, "Bearer upstream-provider-secret");
    });

    await check("cross-tenant policy isolation", async () => {
      const before = upstreamCalls.length;
      const blocked = await post(gatewayBase, requestBody("Discuss tenant-a-only"), "smoke-tenant-a");
      assert.equal(blocked.status, 403);
      assert.equal(upstreamCalls.length, before);
      const allowed = await post(gatewayBase, requestBody("Discuss tenant-a-only"), "smoke-tenant-b");
      assert.equal(allowed.status, 200);
      assert.equal(upstreamCalls.length, before + 1);
    });

    await check("malformed and oversized requests are rejected before upstream", async () => {
      const before = upstreamCalls.length;
      assert.equal((await post(gatewayBase, "{broken")).status, 400);
      assert.equal((await post(gatewayBase, JSON.stringify({ data: "x".repeat(2 * 1024 * 1024 + 1) }))).status, 413);
      assert.equal(upstreamCalls.length, before);
    });

    await check("streaming inspection blocks tail and cancels upstream", async () => {
      const response = await post(gatewayBase, requestBody("stream safety test", { stream: true }));
      const body = await response.text();
      assert.match(body, /safe prefix/);
      assert.match(body, /SoterAI Gateway/);
      assert.doesNotMatch(body, /NEVER_RELEASE_THIS_TAIL/);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 30));
      assert.equal(upstreamState.streamCancelled, true);
    });

    const directLatencies: number[] = [];
    const gatewayLatencies: number[] = [];
    for (let i = 0; i < 60; i++) {
      directLatencies.push(
        await elapsedMs(async () => {
          const response = await fetch(`${upstreamBase}/openai`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: requestBody(`latency direct ${i}`),
          });
          await response.arrayBuffer();
        }),
      );
      gatewayLatencies.push(
        await elapsedMs(async () => {
          const response = await post(gatewayBase, requestBody(`latency gateway ${i}`));
          await response.arrayBuffer();
        }),
      );
    }
    const overhead = gatewayLatencies.map((value, index) => Math.max(0, value - directLatencies[index]));
    const directFirst = await firstTokenMs(`${upstreamBase}/openai`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody("direct first token", { stream: true }),
    });
    const gatewayFirst = await firstTokenMs(`${gatewayBase}/api/gateway/openai/v1/chat/completions`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: requestBody("gateway first token", { stream: true }),
    });

    const cpuBefore = process.cpuUsage();
    const memoryBefore = process.memoryUsage().rss;
    const concurrency = 20;
    const total = 100;
    const loadStart = performance.now();
    for (let offset = 0; offset < total; offset += concurrency) {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, total - offset) }, async (_, index) => {
          const response = await post(gatewayBase, requestBody(`concurrency ${offset + index}`));
          assert.equal(response.status, 200);
          await response.arrayBuffer();
        }),
      );
    }
    const loadSeconds = (performance.now() - loadStart) / 1000;
    const cpu = process.cpuUsage(cpuBefore);
    const memoryAfter = process.memoryUsage().rss;
    metrics = {
      iterations: 60,
      overheadMs: { p50: percentile(overhead, 0.5), p95: percentile(overhead, 0.95), p99: percentile(overhead, 0.99) },
      gatewayLatencyMs: {
        p50: percentile(gatewayLatencies, 0.5),
        p95: percentile(gatewayLatencies, 0.95),
        p99: percentile(gatewayLatencies, 0.99),
      },
      firstTokenMs: {
        direct: Number(directFirst.toFixed(3)),
        gateway: Number(gatewayFirst.toFixed(3)),
        overhead: Number(Math.max(0, gatewayFirst - directFirst).toFixed(3)),
      },
      throughputRequestsPerSecond: Number((total / loadSeconds).toFixed(2)),
      concurrency,
      loadRequests: total,
      cpuUserMs: Number((cpu.user / 1000).toFixed(3)),
      cpuSystemMs: Number((cpu.system / 1000).toFixed(3)),
      rssBeforeMiB: Number((memoryBefore / 1024 / 1024).toFixed(3)),
      rssAfterMiB: Number((memoryAfter / 1024 / 1024).toFixed(3)),
      rssDeltaMiB: Number(((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(3)),
    };
    pass("performance, first-token, throughput, CPU, memory, and concurrency captured");
  } finally {
    await Promise.all([close(gateway), close(upstream)]);
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  await check("clean shutdown leaves no listening harness handles", () => {
    assert.equal(gateway.listening, false);
    assert.equal(upstream.listening, false);
  });

  const docker = await dockerStatus();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    isolation: {
      productionAccess: false,
      upstreams: "loopback-only OpenAI/Anthropic-compatible HTTP servers",
      database: "dependency-injected tenant/auth/policy stores; no database connection",
    },
    result: failures.length === 0 ? "PASS" : "FAIL",
    passed: passes.length,
    failed: failures.length,
    checks: passes,
    failures,
    metrics,
    productionServerVariant: docker.available
      ? {
          status: "AVAILABLE_NOT_EXECUTED_BY_THIS_IN_PROCESS_SCRIPT",
          command:
            "docker compose -f docker-compose.local.yml up -d postgres && npx prisma db push && npm run build && npm run start",
        }
      : {
          status: "EXTERNALLY_BLOCKED",
          blocker: `Docker daemon/API unavailable: ${docker.blocker}`,
          command:
            "docker compose -f docker-compose.local.yml up -d postgres && npx prisma db push && npm run build && npm run start",
        },
  };
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
