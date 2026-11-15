/// <reference types="node" />
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as sdk from "../packages/sdk/src/index";
import * as nextSdk from "../packages/sdk/src/next";

// Offline response fixtures, never real verdicts. Execute the copied literals;
// replace HTTP IO and the application-owned model only, never SDK decisions.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.DOCS_API_SAFETY_SOURCE_ROOT ?? repo;
const pages = ["js", "python", "rest-api"] as const;
type Page = (typeof pages)[number];
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const sources = Object.fromEntries(pages.map((page) => [page,
  readFileSync(path.join(sourceRoot, `app/docs/${page}/page.tsx`), "utf8"),
])) as Record<Page, string>;
console.log("API_SAFETY_SOURCE_BINDINGS " + JSON.stringify(pages.map((page) => ({
  path: path.join(sourceRoot, `app/docs/${page}/page.tsx`), sha256: sha(sources[page]),
}))));
console.log("API_SAFETY_SDK_BINDINGS " + JSON.stringify(["index", "soter", "client", "next", "types", "errors"].map((name) => {
  const file = path.join(repo, `packages/sdk/src/${name}.ts`);
  return { path: file, sha256: sha(readFileSync(file)) };
})));

function snippet(page: Page, title: string): string {
  const ast = ts.createSourceFile(`${page}.tsx`, sources[page], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = new Map<string, ts.Expression>();
  function collect(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      constants.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  }
  collect(ast);
  let code: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "CodeBlock") {
      const matches = node.openingElement.attributes.properties.some((attr) =>
        ts.isJsxAttribute(attr) && attr.name.getText(ast) === "title" &&
        attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text === title);
      if (matches) {
        const child = node.children.find((entry) => ts.isJsxExpression(entry) && entry.expression);
        assert.ok(child && ts.isJsxExpression(child) && child.expression, title);
        const expression = ts.isIdentifier(child.expression) ? constants.get(child.expression.text) : child.expression;
        assert.ok(expression && (ts.isNoSubstitutionTemplateLiteral(expression) || ts.isStringLiteral(expression)),
          `${page}: ${title} must remain a literal, not a patched test helper`);
        code = expression.text;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(typeof code, "string", `${page}: missing published ${title}`);
  console.log("API_SAFETY_LITERAL_BINDING " + JSON.stringify({ page, title, sha256: sha(code!) }));
  return code!;
}

const original = { input: "SYNTHETIC_WITHHELD_USER_TEXT", output: "SYNTHETIC_WITHHELD_MODEL_TEXT" };
const safe = { input: "Synthetic permitted input", output: "Synthetic permitted output" };
const diagnostic = "SYNTHETIC_SENSITIVE_DIAGNOSTIC_MUST_NOT_ESCAPE";
type Direction = "input" | "output";
type Fixture = { body?: unknown; status?: number; text?: string; networkError?: boolean };
type Scenario = {
  id: string; direction: Direction; fixtures: Fixture[]; blocked: boolean;
  llmInput?: string; reply?: string; status?: number; error?: boolean;
};
type Run = { result?: Record<string, unknown>; status?: number; raised?: string; errorMessage?: string;
  sent: Array<{ url: string; body: Record<string, unknown> }>; llmInputs: unknown[] };
function wire(action: unknown = "ALLOW", extra: Record<string, unknown> = {}) {
  return {
    allowed: action === "ALLOW" || action === "ALLOW_WITH_REDACTION" || action === "REWRITE", action,
    riskScore: 0, riskTypes: [], reason: "Synthetic offline fixture, not a live verdict.", findings: [], ...extra,
  };
}
function sequence(direction: Direction, target: Fixture): Fixture[] {
  return direction === "input" ? [target, { body: wire("ALLOW") }]
    : [{ body: wire("ALLOW", { safeText: safe.input }) }, target];
}
function cases(directions: readonly Direction[]): Scenario[] {
  const result: Scenario[] = [];
  for (const direction of directions) {
    const deny = (id: string, body: unknown) => result.push({
      id: `${direction}/${id}`, direction, fixtures: sequence(direction, { body }), blocked: true,
      llmInput: direction === "output" ? safe.input : undefined,
    });
    const permit = (id: string, body: unknown, text: string) => result.push({
      id: `${direction}/${id}`, direction, fixtures: sequence(direction, { body }), blocked: false,
      llmInput: direction === "input" ? text : safe.input,
      reply: direction === "output" ? text : original.output,
    });
    const findings = [{ type: "UNSAFE_OUTPUT", label: "Offline control", severity: "HIGH", score: 80,
      message: diagnostic, matched: diagnostic }];
    for (const action of ["BLOCK", "HUMAN_REVIEW"]) {
      deny(`${action}/nested-findings`, wire(action, { findings, reason: diagnostic, metadata: { nested: { text: diagnostic } } }));
      deny(`${action}/untrusted-safeText`, wire(action, { safeText: diagnostic }));
    }
    permit("ALLOW/original", wire(), original[direction]);
    permit("ALLOW/nested-diagnostics", wire("ALLOW", { findings, metadata: { text: diagnostic } }), original[direction]);
    for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"]) {
      for (const field of ["safeText", "redactedText"]) {
        permit(`${action}/${field}/valid`, wire(action, { [field]: safe[direction], findings }), safe[direction]);
        for (const [label, value] of [["null", null], ["object", { unchecked: original[direction] }],
          ["array", [original[direction]]], ["boolean", true], ["number", 7], ["empty", ""], ["blank", " \t\n "]] as const) {
          deny(`${action}/${field}/${label}`, wire(action, { [field]: value }));
        }
      }
      deny(`${action}/missing`, wire(action));
      deny(`${action}/invalid-primary-with-valid-secondary`, wire(action, { safeText: { unchecked: true }, redactedText: safe[direction] }));
      permit(`${action}/null-primary-valid-secondary`, wire(action, { safeText: null, redactedText: safe[direction] }), safe[direction]);
    }
    for (const [label, allowed] of [["false", false], ["null", null], ["string-false", "false"],
      ["string-true", "true"], ["one", 1], ["zero", 0], ["object", { unexpected: true }], ["array", [true]]] as const) {
      deny(`allowed/${label}`, wire("ALLOW", { allowed }));
    }
    const missingAllowed: Record<string, unknown> = wire(); delete missingAllowed.allowed;
    deny("allowed/missing", missingAllowed);
    for (const [label, action] of [["unknown", "FUTURE_ACTION"], ["array-allow", ["ALLOW"]],
      ["array-rewrite", ["REWRITE"]], ["empty-array", []], ["object", {}], ["null", null],
      ["boolean", true], ["number", 1], ["wrong-case", "allow"], ["block-with-true", "BLOCK"],
      ["review-with-true", "HUMAN_REVIEW"]] as const) {
      deny(`action/${label}`, wire(action, { allowed: true, safeText: safe[direction] }));
    }
    const missingAction: Record<string, unknown> = wire(); delete missingAction.action;
    deny("action/missing", missingAction);
    for (const body of [null, [], "not an object"]) deny(`payload/${JSON.stringify(body)}`, body);
    for (const status of [400, 401, 403, 429, 500, 503]) {
      result.push({ id: `${direction}/HTTP-${status}`, direction,
        fixtures: sequence(direction, { status, body: { error: true, message: diagnostic, details: { text: original[direction] } } }),
        blocked: true, status, error: true, llmInput: direction === "output" ? safe.input : undefined });
    }
    for (const [label, target] of [["network", { networkError: true }], ["non-JSON", { text: "not JSON: " + diagnostic }]] as const) {
      result.push({ id: `${direction}/${label}`, direction, fixtures: sequence(direction, target),
        blocked: true, error: true, llmInput: direction === "output" ? safe.input : undefined });
    }
  }
  return result;
}

async function jsRun(code: string, scenario: Scenario, kind: "next" | "rest"): Promise<Run> {
  const sent: Run["sent"] = [], llmInputs: unknown[] = [];
  const queue = structuredClone(scenario.fixtures);
  const transport: typeof fetch = async (url, init) => {
    assert.equal(new URL(String(url)).origin, "https://api-safety.invalid", "No live request permitted");
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    assert.equal(new Headers(init?.headers).get("x-api-key"), "synthetic-api-safety-key");
    const item = queue.shift(); assert.ok(item, "Unexpected guard request");
    if (item.networkError) throw new Error("Offline transport failure: " + diagnostic);
    return new Response(item.text ?? JSON.stringify(item.body), { status: item.status ?? 200,
      headers: { "Content-Type": "application/json", "Retry-After": "1" } });
  };
  const callYourLLM = async (text: string) => { llmInputs.push(text); return original.output; };
  const configure = (options: Parameters<typeof sdk.resolveSoterConfig>[0] = {}) => sdk.resolveSoterConfig({
    ...options, apiKey: "synthetic-api-safety-key", baseUrl: "https://api-safety.invalid",
    // Preserve the published custom fetch (if any), including its raw checks.
    fetch: options.fetch ?? transport, maxRetries: 0,
  });
  class OfflineSoter extends sdk.Soter {
    constructor(options: Parameters<typeof sdk.resolveSoterConfig>[0] = {}) { super(configure(options)); }
  }
  const module = { exports: {} as Record<string, unknown> };
  const context = {
    module, exports: module.exports,
    require(name: string) {
      if (name === "@soterai/core") return { ...sdk, Soter: OfflineSoter, resolveSoterConfig: configure };
      if (name === "@soterai/core/next") return nextSdk; // actual factory, not a patched helper
      if (name === "./llm") return { callYourLLM };
      assert.fail(`Unapproved snippet dependency: ${name}`);
    },
    fetch: transport, Request, Response, Headers, URL, AbortSignal,
    process: { env: { SOTER_API_KEY: "synthetic-api-safety-key", SOTER_BASE_URL: "https://api-safety.invalid" } },
    console: { log() {}, error() {}, warn() {} },
  };
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  assert.deepEqual(compiled.diagnostics, [], "Copied snippet must compile unchanged");
  new vm.Script(compiled.outputText, { filename: `${kind}.published.js` }).runInNewContext(context, { timeout: 2000 });
  try {
    if (kind === "next") {
      const response = await (module.exports.POST as (request: Request) => Promise<Response>)(new Request("https://application.invalid/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: original.input }),
      }));
      return { result: await response.json(), status: response.status, sent, llmInputs };
    }
    const result = await (module.exports.guardInput as (message: string) => Promise<Record<string, unknown>>)(original.input);
    return { result, sent, llmInputs };
  } catch (error) {
    return { raised: (error as Error).name, errorMessage: (error as Error).message, sent, llmInputs };
  }
}

function verify(run: Run, scenario: Scenario, kind: "next" | "rest" | "python" | "fastapi", basic = false) {
  const publicText = JSON.stringify(run.result ?? {});
  // The FastAPI block retains its illustrative local f-string model stub.
  const modelOutput = kind === "fastapi" ? `Response to: ${scenario.llmInput}` : original.output;
  assert.ok(!publicText.includes(diagnostic), `${scenario.id}: sensitive diagnostics escaped: ${publicText}`);
  if (kind !== "rest") assert.deepEqual(run.llmInputs, scenario.llmInput === undefined ? [] : [scenario.llmInput], `${scenario.id}: model inputs`);
  const expectedRequests = kind === "rest" || (scenario.blocked && scenario.direction === "input") ? 1 : 2;
  // Published Python full handler retries transport failures. Keep every attempt
  // in evidence while comparing the distinct, ordered input/output directions.
  const flow = run.sent.filter((entry, index) => index === 0 || entry.url !== run.sent[index - 1].url);
  assert.equal(flow.length, expectedRequests, `${scenario.id}: guard directions`);
  assert.equal(new URL(flow[0].url).pathname, "/api/guard/input");
  assert.equal(flow[0].body.message, original.input);
  if (flow.length === 2) {
    assert.equal(new URL(flow[1].url).pathname, "/api/guard/output");
    assert.equal(flow[1].body.aiResponse, modelOutput);
  }
  if (scenario.blocked) {
    if ((kind === "rest" || basic) && run.raised) return; // documented propagation, never permission
    assert.equal(run.raised, undefined, `${scenario.id}: route must handle errors generically`);
    assert.equal(run.result?.blocked, true, `${scenario.id}: failed check must withhold`);
    assert.ok(!publicText.includes(original.input) && !publicText.includes(original.output), `${scenario.id}: original text escaped`);
    assert.ok(!publicText.includes(modelOutput), `${scenario.id}: model output escaped`);
    if (scenario.status && (kind === "next" || kind === "fastapi")) assert.equal(run.status, scenario.status, "Preserve HTTP failures without their body");
    if (scenario.error && (kind === "next" || kind === "fastapi")) assert.ok(run.status! >= 400, "Do not convert an HTTP/transport failure to 200");
  } else {
    assert.equal(run.raised, undefined, run.errorMessage);
    assert.equal(run.result?.blocked, false, scenario.id);
    const expectedReply = scenario.reply === original.output ? modelOutput : scenario.reply;
    assert.equal(run.result?.[kind === "rest" ? "text" : "reply"], kind === "rest" ? scenario.llmInput : expectedReply, scenario.id);
    if (kind === "next" || kind === "fastapi") assert.equal(run.status, 200);
  }
  if (kind === "next" || kind === "fastapi") assert.deepEqual(Object.keys(run.result!).sort(), ["blocked", "reply"], "Expose only minimal public fields");
}

const bothDirections = cases(["input", "output"]);
const nextCode = snippet("js", "app/api/chat/route.ts");
for (const scenario of bothDirections) {
  test(`API-03-01: JS Next factory public safety / ${scenario.id}`, async () => {
    verify(await jsRun(nextCode, scenario, "next"), scenario, "next");
  });
}

const pythonCache = new Map<string, Map<string, Run>>();
function pythonRuns(title: string, mode: "python" | "fastapi") {
  const key = `${mode}/${title}`;
  if (!pythonCache.has(key)) {
    const code = snippet("python", title);
    const execution = spawnSync(process.env.DOCS_TEST_PYTHON ?? "python", ["-B", path.join(repo, "tests/docs-api-safety-python.py")], {
      input: JSON.stringify({ repo, title, code, mode, scenarios: bothDirections, original, diagnostic }),
      encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    assert.equal(execution.status, 0, execution.stderr || execution.error?.message || "Python harness failed before assertions");
    const data = JSON.parse(execution.stdout) as { rows: Array<Run & { id: string }>; pins: unknown[]; python: string; codeSha256: string };
    assert.equal(data.codeSha256, sha(code), "Python executed the exact extracted literal");
    assert.equal(data.rows.length, bothDirections.length, "Every requested scenario must execute");
    assert.equal(new Set(data.rows.map((row) => row.id)).size, bothDirections.length, "No duplicate scenario IDs");
    console.log("API_SAFETY_PYTHON_BINDINGS " + JSON.stringify({ title, python: data.python, codeSha256: data.codeSha256, pins: data.pins }));
    console.log("API_SAFETY_PYTHON_RESULTS " + JSON.stringify({ title, rows: data.rows }));
    pythonCache.set(key, new Map(data.rows.map((row) => [row.id, row])));
  }
  return pythonCache.get(key)!;
}

for (const title of ["basic input/output guard", "guarded chat handler"]) {
  for (const scenario of bothDirections) {
    test(`API-03-02: Python ${title} / ${scenario.id}`, () => {
      const run = pythonRuns(title, "python").get(scenario.id);
      assert.ok(run);
      verify(run, scenario, "python", title === "basic input/output guard");
    });
  }
}

for (const scenario of bothDirections) {
  test(`API-03-01: Python FastAPI factory public safety / ${scenario.id}`, () => {
    const run = pythonRuns("FastAPI example", "fastapi").get(scenario.id);
    assert.ok(run);
    verify(run, scenario, "fastapi");
  });
}

const fetchCode = snippet("rest-api", "fetch API");
for (const scenario of cases(["input"])) {
  test(`API-03-03: REST fetch strict wire gate / ${scenario.id}`, async () => {
    verify(await jsRun(fetchCode, scenario, "rest"), scenario, "rest");
  });
}
