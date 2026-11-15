import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Script } from "node:vm";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { Soter } from "../packages/sdk/src/soter";
import { createAgentFirewallClient } from "../packages/sdk/src/client";
import { createGuardedRoute } from "../packages/sdk/src/next";
import { soterInputMiddleware, soterOutputMiddleware } from "../packages/sdk/src/express";
import type { ClientOptions } from "../packages/sdk/src/types";

// Read exact copyable literals, including the transport adapter. Never replace
// SDK decisions/normalization or patch the published source to make it runnable.
const root = process.env.DOCS_FRAMEWORK_SAFETY_ROOT ?? process.cwd();
const dependencyRoot = process.cwd();
type Role = "input" | "chunk" | "output";
type Raw = Record<string, unknown>;
type Scenario = { id: string; issue: string; role: Role; raw?: Raw; valid?: string };
type Surface = { page: string; name: string; roles: Role[] };
type Observation = {
  id: string; surface: string; blocked: unknown; reply: unknown;
  calls: unknown[]; retrieval: string[]; requests: string[]; public: string;
};
const original = { input: "SYNTHETIC_ORIGINAL_INPUT", chunk: "SYNTHETIC_ORIGINAL_CHUNK", output: "SYNTHETIC_ORIGINAL_OUTPUT" };
const safe = { input: "safe input", chunk: "safe chunk", output: "safe output" };
const jsSurfaces: Surface[] = [
  { page: "nextjs", name: "routeHandler", roles: ["input", "output"] },
  { page: "nextjs", name: "oneLiner", roles: ["input", "output"] },
  { page: "nextjs", name: "serverActionCode", roles: ["input", "output"] },
  { page: "express", name: "basicCode", roles: ["input", "output"] },
  { page: "express", name: "middlewareCode", roles: ["input", "output"] },
  { page: "generic-chatbot", name: "basicCode", roles: ["input", "output"] },
  { page: "generic-chatbot", name: "agentCode", roles: ["output"] },
  { page: "rag", name: "tsRagCode", roles: ["input", "chunk", "output"] },
];
const pythonSurfaces: Surface[] = [
  { page: "fastapi", name: "quickstartCode", roles: ["input", "output"] },
  { page: "fastapi", name: "manualCode", roles: ["input", "output"] },
  { page: "fastapi", name: "asyncCode", roles: ["input", "output"] },
  { page: "rag", name: "ragCode", roles: ["input", "chunk", "output"] },
  { page: "rag", name: "langchainCode", roles: ["input", "output"] },
  // This wrapper checks source nodes AFTER generation, never pre-retrieval.
  { page: "rag", name: "llamaindexCode", roles: ["input", "chunk", "output"] },
];

function verdict(role: Role, action = "REWRITE", field = "safeText"): Raw {
  return { allowed: true, action, riskScore: 0, riskTypes: [], findings: [], reason: "synthetic transport", [field]: safe[role] };
}

function invalidCases(role: Role, issue: string): Scenario[] {
  const cases: Scenario[] = [];
  if (issue === "FW-001") {
    const replacements: Array<[string, Raw]> = [
      ["missing", {}], ["null", { safeText: null }], ["empty", { safeText: "" }],
      ["whitespace", { safeText: " \t\n " }], ["non-string", { safeText: 42 }],
      ["redacted-empty", { redactedText: "" }], ["redacted-whitespace", { redactedText: " \t\n " }],
    ];
    for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"]) {
      for (const [label, replacement] of replacements) {
        cases.push({ id: `${issue}/${role}/${action}/${label}`, issue, role,
          raw: { allowed: true, action, riskScore: 0, riskTypes: [], findings: [], ...replacement } });
      }
    }
  } else {
    for (const action of ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"]) {
      for (const [label, allowed] of [["string-false", "false"], ["string-true", "true"], ["number-one", 1], ["null", null], ["false", false], ["missing", undefined]] as const) {
        const raw = verdict(role, action);
        if (allowed === undefined) delete raw.allowed; else raw.allowed = allowed;
        cases.push({ id: `${issue}/${role}/${action}/${label}`, issue, role, raw });
      }
    }
    for (const [label, action] of [["unknown", "UNKNOWN"], ["lowercase", "allow"], ["non-string", 42], ["missing", undefined]] as const) {
      const raw: Raw = { ...verdict(role), decision: "ALLOW" };
      if (action === undefined) delete raw.action; else raw.action = action;
      cases.push({ id: `${issue}/${role}/action-${label}`, issue, role, raw });
    }
    for (const action of ["BLOCK", "HUMAN_REVIEW"]) {
      cases.push({ id: `${issue}/${role}/${action}/contradictory-decision`, issue, role,
        raw: { ...verdict(role, action), decision: "ALLOW" } });
    }
  }
  return cases;
}

const validCases: Scenario[] = [
  { id: "valid/allow-original", issue: "valid", role: "output", valid: "allow-original" },
  ...["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"].flatMap((action) =>
    ["safeText", "redactedText"].map((field) => ({ id: `valid/${action}/${field}`, issue: "valid", role: "output" as Role, valid: `${action}/${field}` }))),
];
const cache = new Map<string, string>();
function snippet(surface: Surface): string {
  const key = `${surface.page}.${surface.name}`;
  if (cache.has(key)) return cache.get(key)!;
  const file = path.join(root, "app/docs", surface.page, "page.tsx");
  const bytes = readFileSync(file);
  console.info(`CONSUMED ${file} sha256=${createHash("sha256").update(bytes).digest("hex")} snippet=${surface.name}`);
  const ast = ts.createSourceFile(file, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(ast) !== surface.name || !declaration.initializer) continue;
      assert.ok(ts.isNoSubstitutionTemplateLiteral(declaration.initializer) || ts.isStringLiteral(declaration.initializer), "copyable example must remain a literal");
      cache.set(key, declaration.initializer.text);
      return declaration.initializer.text;
    }
  }
  assert.fail(`Missing exact published example ${key}`);
}

for (const relative of ["packages/sdk/src/soter.ts", "packages/sdk/src/client.ts", "packages/sdk/src/express.ts", "packages/sdk/src/next.ts", "packages/sdk/src/types.ts", "packages/sdk/src/errors.ts"]) {
  const file = path.join(dependencyRoot, relative);
  console.info(`SDK_PIN ${file} sha256=${createHash("sha256").update(readFileSync(file)).digest("hex")}`);
}

type ExpressResponse = { statusCode: number; body?: unknown; locals: Record<string, unknown>; status(code: number): ExpressResponse; json(value: unknown): unknown };
type Handler = (req: { body: unknown }, res: ExpressResponse, next: (error?: unknown) => void) => unknown;
function expressHarness() {
  let handlers: Handler[] = [];
  let errorHandler: ((err: unknown, req: unknown, res: ExpressResponse, next: unknown) => unknown) | undefined;
  const app = {
    post(_url: string, ...route: Handler[]) { handlers = route; },
    use(...items: unknown[]) {
      for (const item of items) if (typeof item === "function" && item.length === 4) errorHandler = item as typeof errorHandler;
    },
  };
  const express = Object.assign(() => app, { json: () => (_req: unknown, _res: unknown, next: () => void) => next() });
  async function invoke() {
    const req = { body: { message: original.input } };
    const res: ExpressResponse = { statusCode: 200, locals: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    async function step(index: number): Promise<void> {
      if (!handlers[index] || res.body !== undefined) return;
      let continuation: Promise<void> | undefined;
      await handlers[index](req, res, (error) => {
        continuation = error === undefined ? step(index + 1) : Promise.resolve().then(async () => {
          assert.ok(errorHandler, "route must handle transport failures");
          await errorHandler(error, req, res, () => {});
        });
      });
      await continuation;
    }
    await step(0);
    return res.body;
  }
  return { express, invoke };
}

function answerFor(scenario: Scenario, role: Role): Raw {
  if (scenario.valid === "allow-original") {
    return { allowed: true, action: "ALLOW", riskScore: 0, riskTypes: [], findings: [] };
  }
  if (scenario.valid) {
    const [action, field] = scenario.valid.split("/");
    return verdict(role, action, field);
  }
  return role === scenario.role ? scenario.raw! : verdict(role);
}

async function runJs(surface: Surface, scenario: Scenario): Promise<Observation> {
  const calls: unknown[] = [], retrieval: string[] = [], requests: string[] = [];
  const http: typeof fetch = async (url, init) => {
    assert.equal(init?.method, "POST");
    const pathname = new URL(String(url)).pathname;
    requests.push(pathname);
    if (pathname === "/api/agent/session/start") return Response.json({ sessionId: "synthetic-session" });
    if (pathname === "/api/agent/action/check") return Response.json({ decision: "ALLOW" });
    assert.ok(["/api/guard/input", "/api/guard/output", "/api/guard/analyze"].includes(pathname), `unmocked URL ${pathname}`);
    const role: Role = pathname.endsWith("/output") ? "output" : pathname.endsWith("/analyze") ? "chunk" : "input";
    return Response.json(answerFor(scenario, role));
  };
  // Inject HTTP only when absent. In particular, NEVER overwrite the published
  // strict fetch adapter (the inherited harness did overwrite options.fetch).
  const options = (value: Partial<ClientOptions> = {}): ClientOptions => ({ ...value, apiKey: "synthetic-safety-test-key", fetch: value.fetch ?? http, retries: 0, maxRetries: 0 });
  class TestSoter extends Soter { constructor(value: Partial<ClientOptions> = {}) { super(options(value)); } }
  const llm = async (input: unknown) => { calls.push(input); return original.output; };
  const harness = expressHarness();
  const modules: Record<string, unknown> = {
    "@soterai/core": { Soter: TestSoter, createAgentFirewallClient: (value: ClientOptions) => createAgentFirewallClient(options(value)) },
    "@soterai/core/next": { createGuardedRoute: (value: Parameters<typeof createGuardedRoute>[0]) => createGuardedRoute({ ...value, ...options(value) }) },
    "@soterai/core/express": {
      soterInputMiddleware: (value: Parameters<typeof soterInputMiddleware>[0]) => soterInputMiddleware({ ...value, ...options(value) }),
      soterOutputMiddleware: (value: Parameters<typeof soterOutputMiddleware>[0]) => soterOutputMiddleware({ ...value, ...options(value) }),
    },
    "@/lib/llm": { callYourLLM: llm, callLLM: llm, myLLMCall: llm },
    "./llm.js": { callLLM: llm }, "./llm": { callLLM: llm }, "./tools": { callTool: llm },
    "next/cache": { revalidatePath() {} }, express: harness.express,
    "./rag": {
      retrieveAuthorized: async (query: string, principal: string) => {
        assert.equal(principal, "trusted-principal"); retrieval.push(query);
        return [{ id: "synthetic-source", pageContent: original.chunk, metadata: { url: "https://example.test/source" } }];
      },
      generateAnswer: async (query: string, context: string) => { calls.push({ query, context }); return original.output; },
    },
  };
  const compiled = ts.transpileModule(snippet(surface), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    reportDiagnostics: true, fileName: `${surface.page}-${surface.name}.ts`,
  });
  assert.deepEqual((compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error), [], "published source must parse without repair");
  const exports: Record<string, unknown> = {};
  new Script(compiled.outputText, { filename: `${surface.page}-${surface.name}.published.js` }).runInNewContext({
    exports, Response, Request, FormData, URL, AbortController, Buffer, console, fetch: http,
    process: { env: { SOTER_API_KEY: "synthetic-safety-test-key" } },
    require: (id: string) => { assert.ok(id in modules, `unapproved dependency ${id}`); return modules[id]; },
  }, { timeout: 2000 });
  let result: unknown;
  if (surface.page === "express") result = await harness.invoke();
  else if (surface.name === "serverActionCode") {
    const form = new FormData(); form.set("message", original.input);
    result = await (exports.submitMessage as (data: FormData) => Promise<unknown>)(form);
  } else if (surface.page === "nextjs") {
    const response = await (exports.POST as (req: Request) => Promise<Response>)(new Request("https://app.example.test/api/chat", { method: "POST", body: JSON.stringify({ message: original.input }) }));
    result = await response.json();
  } else if (surface.name === "tsRagCode") result = await (exports.answerRag as (query: string, principal: string) => Promise<unknown>)(original.input, "trusted-principal");
  else if (surface.name === "agentCode") result = await (exports.runAgentAction as (text: string) => Promise<unknown>)("synthetic ticket");
  else result = await (exports.chat as (text: string) => Promise<unknown>)(original.input);
  assert.ok(result && typeof result === "object", "example must return an application response");
  const value = result as Record<string, unknown>;
  return { id: scenario.id, surface: `${surface.page}.${surface.name}`, blocked: value.blocked, reply: value.reply, calls, retrieval, requests, public: JSON.stringify(result) };
}

const pythonCache = new Map<string, Observation[]>();
function runPython(surface: Surface): Observation[] {
  const key = `${surface.page}.${surface.name}`;
  if (pythonCache.has(key)) return pythonCache.get(key)!;
  const scenarios = surface.roles.flatMap((role) => ["FW-001", "FW-002"].flatMap((issue) => invalidCases(role, issue))).concat(validCases);
  const child = spawnSync(process.env.DOCS_PYTHON ?? "python", [path.join(dependencyRoot, "tests/docs-framework-safety-python.py")], {
    input: JSON.stringify({ root: dependencyRoot, surface, code: snippet(surface), scenarios, original, safe }),
    encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }, timeout: 90000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message || "Python harness failed");
  const data = JSON.parse(child.stdout) as { pins: Array<{ path: string; sha256: string }>; rows: Observation[] };
  for (const pin of data.pins) console.info(`SDK_PIN ${pin.path} sha256=${pin.sha256}`);
  assert.equal(data.rows.length, scenarios.length, "Python must exercise every supplied scenario");
  assert.equal(new Set(data.rows.map((row) => row.id)).size, scenarios.length, "scenario IDs must be unique");
  pythonCache.set(key, data.rows);
  return data.rows;
}

function problems(surface: Surface, scenario: Scenario, row: Observation): string[] {
  const failures: string[] = [];
  const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
  if (scenario.valid) {
    const expectedText = scenario.valid === "allow-original" ? original.output : safe.output;
    expect(row.blocked === false, "valid verdict was rejected");
    expect(row.reply === expectedText, "valid reply bytes were changed/lost");
    expect(row.calls.length === 1, "valid turn must call the provider once");
    if (surface.name !== "agentCode") {
      const expectedInput = scenario.valid === "allow-original" ? original.input : safe.input;
      expect(JSON.stringify(row.calls).includes(expectedInput), "provider must receive selected input");
    }
    if (surface.name === "ragCode" || surface.name === "tsRagCode") {
      expect(row.retrieval.length === 1, "valid RAG must retrieve once");
      const expectedChunk = scenario.valid === "allow-original" ? original.chunk : safe.chunk;
      expect(JSON.stringify(row.calls).includes(expectedChunk), "generation must receive selected context");
    }
  } else {
    expect(row.blocked === true, "unsafe verdict must return blocked:true");
    expect(!row.public.includes(original.output), "original output was released");
    const expectedCalls = scenario.role === "input" || (scenario.role === "chunk" && surface.name !== "llamaindexCode") ? 0 : 1;
    expect(row.calls.length === expectedCalls, `provider calls ${row.calls.length}, expected ${expectedCalls}`);
    if (scenario.role === "input") expect(row.retrieval.length === 0, "invalid query reached retrieval");
    if (surface.name !== "agentCode") expect(!JSON.stringify(row.calls).includes(original.input), "original unsafe input reached provider");
    if (surface.name === "ragCode" || surface.name === "tsRagCode") expect(!JSON.stringify(row.calls).includes(original.chunk), "original unsafe chunk reached provider");
  }
  expect(row.requests.some((url) => url.endsWith(scenario.role === "chunk" ? "/analyze" : `/${scenario.role}`)), "target guard boundary was not exercised");
  return failures;
}

for (const [language, surfaces] of [["JS", jsSurfaces], ["Python", pythonSurfaces]] as const) {
  for (const surface of surfaces) {
    for (const role of surface.roles) for (const issue of ["FW-001", "FW-002"]) {
      test(`${issue}: ${language} ${surface.page}.${surface.name} rejects unsafe ${role} before continuation`, async () => {
        const failures: unknown[] = [];
        for (const scenario of invalidCases(role, issue)) {
          const row = language === "JS" ? await runJs(surface, scenario) : runPython(surface).find((r) => r.id === scenario.id)!;
          assert.ok(row, scenario.id);
          const errors = problems(surface, scenario, row);
          console.info(`SAFETY_CASE ${JSON.stringify({ ...row, errors })}`);
          if (errors.length) failures.push({ id: row.id, errors });
        }
        assert.deepEqual(failures, [], "raw guard contracts must fail closed at the requested boundary");
      });
    }
    test(`valid: ${language} ${surface.page}.${surface.name} preserves ALLOW and usable redaction/rewrite`, async () => {
      for (const scenario of validCases) {
        const row = language === "JS" ? await runJs(surface, scenario) : runPython(surface).find((r) => r.id === scenario.id)!;
        assert.ok(row, scenario.id);
        const errors = problems(surface, scenario, row);
        console.info(`SAFETY_CASE ${JSON.stringify({ ...row, errors })}`);
        assert.deepEqual(errors, [], scenario.id);
      }
    });
  }
}
