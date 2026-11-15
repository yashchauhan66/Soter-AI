import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { Soter, resolveSoterConfig } from "../packages/sdk/src/soter";
import { createGuardedRoute } from "../packages/sdk/src/next";
import { soterInputMiddleware, soterOutputMiddleware } from "../packages/sdk/src/express";
import * as sdkErrors from "../packages/sdk/src/errors";
import type { ClientOptions } from "../packages/sdk/src/types";
import { inputGuardSchema, outputGuardSchema, analyzeSchema, WEBHOOK_EVENT_VALUES } from "../lib/validations";
import { toPublicGuardResult } from "../lib/guard/publicResult";
import { RISK_TYPES } from "../lib/guard/types";
import { normalizeDecision } from "../packages/sdk/src/client";

// These are OFFLINE transport fixtures, not measured detection results. No user
// environment, customer key, model, database, account, or live API is exercised.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = process.env.DOCS_API_SNAPSHOT_ROOT ?? repo;
const pageNames = ["quickstart", "js", "python", "rest-api", "api-contract"] as const;
type Page = (typeof pageNames)[number];
const sources = Object.fromEntries(pageNames.map((page) => [page,
  readFileSync(path.join(docsRoot, `app/docs/${page}/page.tsx`), "utf8"),
])) as Record<Page, string>;
console.log("DOCS_API_SOURCE_BINDINGS " + JSON.stringify(pageNames.map((page) => ({
  page,
  path: path.join(docsRoot, `app/docs/${page}/page.tsx`),
  sha256: createHash("sha256").update(sources[page]).digest("hex"),
}))));

function pageAst(page: Page) {
  return ts.createSourceFile(`${page}.tsx`, sources[page], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function constant(page: Page, name: string): ts.Expression {
  let found: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(pageAst(page));
  assert.ok(found, `${page}: preserve documentation constant ${name}`);
  return found;
}

function literal(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((item) => literal(item as ts.Expression));
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((item) => {
      assert.ok(ts.isPropertyAssignment(item));
      return [ts.isIdentifier(item.name) || ts.isStringLiteral(item.name) ? item.name.text : item.name.getText(), literal(item.initializer)];
    }));
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => String(literal(span.expression)) + span.literal.text).join("");
  }
  assert.fail(`Unsupported documentation literal: ${node.getText().slice(0, 80)}`);
}

function code(page: Page, name: string): string {
  const value = literal(constant(page, name));
  assert.equal(typeof value, "string", `${page}.${name} must be copyable code`);
  return value as string;
}

function codeBlocks(page: Page) {
  const result: Array<{ title: string; language: string; code: string }> = [];
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === "CodeBlock") {
      const attrs = Object.fromEntries(node.openingElement.attributes.properties.flatMap((attr) =>
        ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer)
          ? [[attr.name.getText(), attr.initializer.text]] : [],
      ));
      const child = node.children.find((item) => ts.isJsxExpression(item) && item.expression);
      if (child && ts.isJsxExpression(child) && child.expression) {
        const expression = child.expression;
        const value = ts.isIdentifier(expression) ? code(page, expression.text) : literal(expression);
        assert.equal(typeof value, "string");
        result.push({ title: attrs.title ?? "", language: attrs.language ?? "", code: value as string });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(pageAst(page));
  return result;
}

function block(page: Page, title: string) {
  const item = codeBlocks(page).find((entry) => entry.title === title);
  assert.ok(item, `${page}: retain the ${title} example`);
  return item.code;
}

function syntaxDiagnostics(source: string) {
  const parsed = ts.createSourceFile("snippet.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

function assertTyped(source: string, label: string, declarations = "") {
  assert.deepEqual(syntaxDiagnostics(source), [], `${label}: copied TypeScript must parse`);
  const virtual = path.join(repo, "tests", "__docs_api_virtual__.ts");
  const adapter = path.join(repo, "tests", "llm.ts");
  const rewritten = source.replaceAll('"@soterai/core/next"', '"../packages/sdk/src/next"')
    .replaceAll('"@soterai/core/express"', '"../packages/sdk/src/express"')
    .replaceAll('"@soterai/core"', '"../packages/sdk/src/index"');
  const contents = new Map([
    [path.normalize(virtual), declarations + "\n" + rewritten],
    [path.normalize(adapter), "export declare function callYourLLM(safeInput: string): Promise<string>;"],
  ]);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: ["node"],
    typeRoots: [path.join(repo, "node_modules/@types")],
  };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.readFile = (file) => contents.get(path.normalize(file)) ?? originalRead(file);
  host.fileExists = (file) => contents.has(path.normalize(file)) || originalExists(file);
  const program = ts.createProgram([virtual], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter((entry) => entry.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map((entry) => ts.flattenDiagnosticMessageText(entry.messageText, "\n")), [], `${label}: real SDK types`);
}

type Fixture = { body?: unknown; status?: number; headers?: Record<string, string>; error?: Error };
type Sent = { url: string; body: Record<string, unknown>; headers: Headers };
function fixture(action: string, overrides: Record<string, unknown> = {}): Fixture {
  return { body: {
    allowed: ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"].includes(action),
    action,
    riskScore: 0,
    riskTypes: [],
    reason: "Offline continuation fixture; not a detection verdict.",
    findings: [],
    ...overrides,
  } };
}

function sandbox(source: string, responses: Fixture[], extra: Record<string, unknown> = {}) {
  assert.deepEqual(syntaxDiagnostics(source), [], "Copied example must parse before it can protect a turn");
  const sent: Sent[] = [];
  const llmInputs: string[] = [];
  const rawOutput = "RAW_MODEL_OUTPUT_MUST_NOT_ESCAPE_WHEN_WITHHELD";
  const callYourLLM = async (text: string) => { llmInputs.push(text); return rawOutput; };
  const transport: typeof fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")), headers: new Headers(init?.headers) });
    const next = responses.shift();
    assert.ok(next, "Example attempted an unexpected guard request");
    if (next.error) throw next.error;
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: next.headers });
  };
  const configure = (options: Partial<ClientOptions> = {}): ClientOptions => resolveSoterConfig({
    ...options, apiKey: "offline-docs-fixture", baseUrl: "https://docs.invalid", fetch: transport, maxRetries: 0,
  });
  class FixtureSoter extends Soter {
    constructor(options: Partial<ClientOptions> = {}) { super(configure(options)); }
  }
  const module = { exports: {} as Record<string, unknown> };
  const context = {
    module,
    exports: module.exports,
    require: (name: string) => {
      if (name === "@soterai/core") return { Soter: FixtureSoter, resolveSoterConfig: configure, ...sdkErrors };
      if (name === "@soterai/core/next") return {
        createGuardedRoute: (options: Parameters<typeof createGuardedRoute>[0]) => createGuardedRoute({ ...options, ...configure(options) }),
      };
      if (name === "@soterai/core/express") return {
        soterInputMiddleware: (options: Parameters<typeof soterInputMiddleware>[0]) => soterInputMiddleware({ ...options, ...configure(options) }),
        soterOutputMiddleware: (options: Parameters<typeof soterOutputMiddleware>[0]) => soterOutputMiddleware({ ...options, ...configure(options) }),
      };
      if (name === "./llm") return { callYourLLM };
      assert.fail(`Unapproved import in offline example: ${name}`);
    },
    process: { env: {} },
    fetch: transport,
    Request, Response, Headers, URL, AbortSignal,
    console: { log() {}, error() {}, warn() {} },
    crypto: { randomUUID: () => "offline-session" },
    callYourLLM,
    ...extra,
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  new vm.Script(compiled.outputText, { filename: "copied-docs-example.js" }).runInNewContext(context, { timeout: 2000 });
  return { exports: module.exports, sent, llmInputs, rawOutput, context };
}

async function quickstart(responses: Fixture[], body: unknown = { message: "ORIGINAL_USER_MESSAGE" }) {
  const env = sandbox(code("quickstart", "routeCode"), responses);
  const handler = env.exports.POST as (request: Request) => Promise<Response>;
  assert.equal(typeof handler, "function", "keep the POST route example");
  const response = await handler(new Request("https://app.invalid/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  return { ...env, response, result: await response.json() };
}

test("quickstart: copied route type-checks against the actual SDK", () => {
  assertTyped(code("quickstart", "routeCode"), "quickstart route");
});

test("quickstart: blocked and review input never reaches the model", async () => {
  for (const action of ["BLOCK", "HUMAN_REVIEW", "UNKNOWN_ACTION"]) {
    const run = await quickstart([fixture(action)]);
    assert.equal(run.result.blocked, true, action);
    assert.deepEqual(run.llmInputs, [], action);
    assert.equal(run.sent.length, 1, action);
    assert.ok(!JSON.stringify(run.result).includes("ORIGINAL_USER_MESSAGE"));
  }
});

test("quickstart: blocked and review output never falls back to raw model text", async () => {
  for (const action of ["BLOCK", "HUMAN_REVIEW", "UNKNOWN_ACTION"]) {
    const run = await quickstart([fixture("ALLOW"), fixture(action)]);
    assert.equal(run.result.blocked, true, action);
    assert.equal(run.sent.length, 2, action);
    assert.ok(!JSON.stringify(run.result).includes(run.rawOutput), `${action}: raw output leaked`);
  }
});

test("quickstart: allow and transform branches forward only permitted text", async () => {
  const allowed = await quickstart([fixture("ALLOW"), fixture("ALLOW")]);
  assert.equal(allowed.result.blocked, false);
  assert.deepEqual(allowed.llmInputs, ["ORIGINAL_USER_MESSAGE"]);
  assert.equal(allowed.result.reply, allowed.rawOutput);
  for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"]) {
    const transformed = await quickstart([
      fixture(action, { redactedText: "SANITIZED_INPUT" }),
      fixture(action, { safeText: "SANITIZED_OUTPUT" }),
    ]);
    assert.deepEqual(transformed.llmInputs, ["SANITIZED_INPUT"]);
    assert.equal(transformed.result.reply, "SANITIZED_OUTPUT");
    assert.equal(transformed.result.blocked, false);
    const missingInput = await quickstart([fixture(action)]);
    assert.equal(missingInput.result.blocked, true, `${action}: missing replacement must stop`);
    assert.deepEqual(missingInput.llmInputs, []);
    const missingOutput = await quickstart([fixture("ALLOW"), fixture(action)]);
    assert.equal(missingOutput.result.blocked, true);
    assert.ok(!JSON.stringify(missingOutput.result).includes(missingOutput.rawOutput));
  }
});

test("quickstart: guard failures and invalid request bodies fail closed", async () => {
  for (const sequence of [
    [{ status: 401, body: { error: true, message: "fixture auth failure" } }],
    [{ status: 429, body: {}, headers: { "Retry-After": "1" } }],
    [{ error: new Error("offline simulated network failure") }],
    [fixture("ALLOW"), { status: 503, body: { error: true } }],
  ]) {
    const run = await quickstart(sequence);
    assert.equal(run.result.blocked, true);
    assert.equal(run.response.status, 503);
    assert.ok(!JSON.stringify(run.result).includes(run.rawOutput));
  }
  for (const body of [null, {}, { message: 7 }, { message: " " }]) {
    const run = await quickstart([], body);
    assert.equal(run.response.status, 400);
    assert.equal(run.result.blocked, true);
    assert.equal(run.sent.length, 0);
  }
});

test("quickstart: timing and illustrative fixtures are not protection guarantees", () => {
  const schema = literal(constant("quickstart", "howToSchema")) as Record<string, unknown>;
  assert.equal(schema.totalTime, undefined, "no unmeasured five-minute HowTo promise");
  assert.doesNotMatch(sources.quickstart, /in 5 [Mm]inutes|You&apos;re protected!/);
  assert.match(sources.quickstart, /illustrative/i);
  assert.match(sources.quickstart, /\.\/llm|application-owned/);
  assert.match(sources.quickstart, /18\.18/);
});

async function jsHandler(responses: Fixture[]) {
  const env = sandbox(code("js", "fullExampleCode") + "\nmodule.exports.handleChatMessage = handleChatMessage;", responses);
  const handle = env.exports.handleChatMessage as (message: string, callLLM: unknown) => Promise<Record<string, unknown>>;
  const result = await handle("ORIGINAL_USER_MESSAGE", env.context.callYourLLM);
  return { ...env, result };
}

test("js: complete handler type-checks against implemented methods", () => {
  assertTyped(code("js", "fullExampleCode"), "JavaScript complete handler");
  assertTyped(code("js", "basicCode"), "JavaScript input guard");
  assertTyped(code("js", "conversationCode"), "JavaScript conversation helper");
  assertTyped(block("js", "app/api/chat/route.ts"), "Next.js adapter");
});

test("js: complete handler withholds blocked or review input and output", async () => {
  for (const action of ["BLOCK", "HUMAN_REVIEW", "UNKNOWN_ACTION"]) {
    const input = await jsHandler([fixture(action)]);
    assert.equal(input.result.blocked, true);
    assert.deepEqual(input.llmInputs, []);
    const output = await jsHandler([fixture("ALLOW"), fixture(action)]);
    assert.equal(output.result.blocked, true);
    assert.ok(!JSON.stringify(output.result).includes(output.rawOutput), `${action}: raw model output leaked`);
  }
});

test("js: complete handler forwards redactions and fails closed on missing replacements or errors", async () => {
  const allowed = await jsHandler([fixture("ALLOW"), fixture("ALLOW")]);
  assert.equal(allowed.result.blocked, false);
  assert.equal(allowed.result.reply, allowed.rawOutput);
  for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"]) {
    const transformed = await jsHandler([
      fixture(action, { redactedText: "SANITIZED_INPUT" }), fixture(action, { safeText: "SANITIZED_OUTPUT" }),
    ]);
    assert.deepEqual(transformed.llmInputs, ["SANITIZED_INPUT"]);
    assert.equal(transformed.result.reply, "SANITIZED_OUTPUT");
    const noInput = await jsHandler([fixture(action)]);
    assert.equal(noInput.result.blocked, true);
    assert.deepEqual(noInput.llmInputs, []);
    const noOutput = await jsHandler([fixture("ALLOW"), fixture(action)]);
    assert.equal(noOutput.result.blocked, true);
    assert.ok(!JSON.stringify(noOutput.result).includes(noOutput.rawOutput));
  }
  for (const responses of [
    [{ error: new Error("offline network failure") }],
    [fixture("ALLOW"), { status: 429, body: {}, headers: { "Retry-After": "2" } }],
  ]) {
    const failed = await jsHandler(responses);
    assert.equal(failed.result.blocked, true);
    assert.ok(!JSON.stringify(failed.result).includes(failed.rawOutput));
  }
});

test("js: Next.js example uses the exported adapter and withholds blocked model output", async () => {
  const env = sandbox(block("js", "app/api/chat/route.ts"), [fixture("ALLOW"), fixture("BLOCK")], {
    myLLMCall: async () => "RAW_MODEL_OUTPUT_MUST_NOT_ESCAPE_WHEN_WITHHELD",
  });
  const handler = env.exports.POST as (request: Request) => Promise<Response>;
  const response = await handler(new Request("https://app.invalid/chat", { method: "POST", body: JSON.stringify({ message: "hello" }) }));
  const result = await response.json();
  assert.equal(result.blocked, true);
  assert.ok(!JSON.stringify(result).includes(env.rawOutput));
  assert.equal(env.sent.length, 2);
});

test("js: Express middleware guards generated output before res.json", async () => {
  for (const action of ["ALLOW", "ALLOW_WITH_REDACTION", "BLOCK", "HUMAN_REVIEW"]) {
    const handlers: Array<(req: unknown, res: unknown, next: (error?: unknown) => void) => unknown> = [];
    const app = { post(_path: string, ...items: typeof handlers) { handlers.push(...items); }, use() {} };
    const env = sandbox(block("js", "Express middleware"), [
      fixture("ALLOW", { safeText: "SANITIZED_INPUT" }),
      fixture(action, action === "ALLOW_WITH_REDACTION" ? { safeText: "SANITIZED_OUTPUT" } : {}),
    ], { app, callLLM: async () => "RAW_MODEL_OUTPUT_MUST_NOT_ESCAPE_WHEN_WITHHELD" });
    const req = { body: { message: "ORIGINAL_USER_MESSAGE" } };
    let result: unknown;
    const res = { locals: {}, status() { return this; }, json(body: unknown) { result = body; return body; } };
    for (const handler of handlers) {
      let advanced = false;
      await handler(req, res, (error) => { assert.equal(error, undefined); advanced = true; });
      if (!advanced) break;
    }
    assert.equal(env.sent.length, 2, "output middleware must run, not just be imported");
    assert.equal(env.sent[0].body.message, "ORIGINAL_USER_MESSAGE");
    if (["BLOCK", "HUMAN_REVIEW"].includes(action)) {
      assert.equal((result as { blocked: boolean }).blocked, true);
      assert.ok(!JSON.stringify(result).includes(env.rawOutput));
    } else if (action === "ALLOW_WITH_REDACTION") {
      assert.equal((result as { reply: string }).reply, "SANITIZED_OUTPUT");
    }
  }
});

test("js: configuration and retry guidance describe actual implementation boundaries", () => {
  assert.match(sources.js, /linear backoff/i, "client delays are retryBackoffMs × attempt, not exponential");
  assert.doesNotMatch(sources.js, /exponential backoff|production-ready handler|Errors never include|errors never contain/i);
  assert.match(sources.js, /metadata.*(not|does not).*project|project.*(not|does not).*authoriz/i);
  assert.match(sources.js, /18\.18/);
  assert.match(sources.js, /getSafeText.*(does not|do not|not an)/i);
});

const pythonHarness = String.raw`
import ast, contextlib, hashlib, io, json, os, pathlib, sys, types
payload = json.load(sys.stdin)
sys.path.insert(0, str(pathlib.Path(payload["repo"]) / "packages" / "python-sdk"))
import requests
import soter
from soter.client import Soter as RealSoter

sent, llm_inputs = [], []
raw_output = "RAW_MODEL_OUTPUT_MUST_NOT_ESCAPE_WHEN_WITHHELD"
responses = list(payload.get("responses", []))
class OfflineSession:
    def post(self, url, json=None, headers=None, timeout=None):
        sent.append({"url": url, "body": json, "timeout": timeout})
        assert responses, "Unexpected guard request"
        item = responses.pop(0)
        if item.get("error"):
            raise requests.ConnectionError("offline simulated connection failure")
        return types.SimpleNamespace(status_code=item.get("status", 200), text=__import__("json").dumps(item.get("body", {})), headers=item.get("headers", {}))
class FixtureSoter(RealSoter):
    def __init__(self, *args, **kwargs):
        kwargs.update(api_key="offline-docs-fixture", base_url="https://docs.invalid", session=OfflineSession(), max_retries=0)
        super().__init__(*args, **kwargs)
soter.Soter = FixtureSoter

def call_llm(text):
    llm_inputs.append(text)
    return raw_output
adapter = types.ModuleType("llm")
adapter.call_llm = call_llm
sys.modules["llm"] = adapter
namespace = {"user_message": "ORIGINAL_USER_MESSAGE", "call_llm": call_llm, "text": "ORIGINAL_USER_MESSAGE", "guard": FixtureSoter()}
output = None
with contextlib.redirect_stdout(io.StringIO()):
    compiled = compile(payload["code"], "copied-docs-example.py", "exec")
    if payload.get("mode") == "syntax":
        output = {"compiled": True}
    elif payload.get("mode") == "error":
        try:
            exec(compiled, namespace)
            if "inspect_input" in namespace:
                namespace["inspect_input"]("ORIGINAL_USER_MESSAGE")
            output = {"raised": None}
        except Exception as error:
            output = {"raised": type(error).__name__}
    else:
        exec(compiled, namespace)
        if "handle_chat_message" in namespace:
            output = namespace["handle_chat_message"]("ORIGINAL_USER_MESSAGE")
        elif "reply" in namespace:
            output = {"reply": namespace["reply"]}
        elif "result" in namespace:
            result = namespace["result"]
            output = {"reply": result.safe_response, "blocked": result.blocked, "llm_called": result.llm_called}
source = pathlib.Path(sys.modules["soter.client"].__file__)
print(json.dumps({"result": output, "sent": sent, "llmInputs": llm_inputs, "rawOutput": raw_output,
    "python": sys.version.split()[0], "sdkSource": str(source), "sdkSha256": hashlib.sha256(source.read_bytes()).hexdigest()}))
`;

function pythonRun(source: string, responses: Fixture[] = [], mode = "flow") {
  const execution = spawnSync(process.env.DOCS_TEST_PYTHON ?? "python", ["-B", "-c", pythonHarness], {
    encoding: "utf8",
    input: JSON.stringify({ repo, code: source, responses: responses.map((item) => ({ ...item, error: Boolean(item.error) })), mode }),
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    timeout: 20000,
  });
  assert.equal(execution.status, 0, execution.stderr || execution.error?.message || "Python example failed");
  return JSON.parse(execution.stdout) as {
    result: Record<string, unknown>; sent: Array<{ body: Record<string, unknown> }>;
    llmInputs: string[]; rawOutput: string; python: string; sdkSource: string; sdkSha256: string;
  };
}

test("python: every displayed Python example compiles without executing a provider", () => {
  for (const item of codeBlocks("python").filter((entry) => entry.language === "python")) {
    assert.equal(pythonRun(item.code, [], "syntax").result.compiled, true, item.title);
  }
});

test("python: basic and full examples never expose blocked or review-required model output", () => {
  for (const name of ["basicCode", "fullExampleCode"]) {
    for (const action of ["BLOCK", "HUMAN_REVIEW", "UNKNOWN_ACTION"]) {
      const input = pythonRun(code("python", name), [fixture(action)]);
      assert.deepEqual(input.llmInputs, [], `${name}: ${action} input`);
      const output = pythonRun(code("python", name), [fixture("ALLOW"), fixture(action)]);
      assert.ok(!JSON.stringify(output.result).includes(output.rawOutput), `${name}: ${action} leaked raw output`);
      assert.equal(output.result.blocked, true);
    }
  }
});

test("python: full handler forwards replacement text and closes on errors or missing rewrites", () => {
  const allowed = pythonRun(code("python", "fullExampleCode"), [fixture("ALLOW"), fixture("ALLOW")]);
  assert.equal(allowed.result.blocked, false);
  assert.equal(allowed.result.reply, allowed.rawOutput);
  console.log("DOCS_PYTHON_SOURCE_BINDING " + JSON.stringify({ python: allowed.python, path: allowed.sdkSource, sha256: allowed.sdkSha256 }));
  for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"]) {
    const transformed = pythonRun(code("python", "fullExampleCode"), [
      fixture(action, { redactedText: "SANITIZED_INPUT" }), fixture(action, { safeText: "SANITIZED_OUTPUT" }),
    ]);
    assert.deepEqual(transformed.llmInputs, ["SANITIZED_INPUT"]);
    assert.equal(transformed.result.reply, "SANITIZED_OUTPUT");
    const missing = pythonRun(code("python", "fullExampleCode"), [fixture("ALLOW"), fixture(action)]);
    assert.equal(missing.result.blocked, true);
    assert.ok(!JSON.stringify(missing.result).includes(missing.rawOutput));
  }
  for (const responses of [
    [{ error: new Error("offline network failure") }],
    [{ status: 401, body: { error: true } }],
    [fixture("ALLOW"), { status: 503, body: { error: true } }],
  ]) {
    const failed = pythonRun(code("python", "fullExampleCode"), responses);
    assert.equal(failed.result.blocked, true, "Unavailable guard must not become allowed traffic");
    assert.ok(!JSON.stringify(failed.result).includes(failed.rawOutput));
  }
});

test("python: error example preserves rate-limit and auth exceptions instead of allowing a turn", () => {
  for (const [status, expected] of [[429, "SoterRateLimitError"], [401, "SoterAuthError"], [500, "SoterError"]] as const) {
    const run = pythonRun(code("python", "errorCode"), [{ status, body: { error: true }, headers: { "Retry-After": "1" } }], "error");
    assert.equal(run.result.raised, expected);
  }
});

test("python: configuration, retry policy and result shape match the Python package", () => {
  assert.ok(!sources.python.includes("SOTER_PROJECT_ID="), "Python does not resolve SOTER_PROJECT_ID");
  assert.ok(!/debug=True|5xx\/network|exponential backoff/.test(sources.python), "do not invent constructor options or retry behavior");
  assert.ok(/linear backoff/i.test(sources.python));
  assert.ok(/not.*(?:HTTP )?5xx|(?:HTTP )?5xx.*not/i.test(sources.python));
  assert.ok(/ProtectChatResult/.test(sources.python), "helper returns a typed object, not a plain snake_case dict");
  assert.ok(/to_dict/.test(sources.python));
  assert.ok(/3\.9/.test(sources.python));
});

async function restFetch(responses: Fixture[]) {
  const run = sandbox(block("rest-api", "fetch API") + "\nmodule.exports.guardInput = guardInput;", responses, {
    process: { env: { SOTER_API_KEY: "offline-docs-fixture", SOTER_BASE_URL: "https://docs.invalid" } },
  });
  const handler = run.exports.guardInput as (message: string) => Promise<Record<string, unknown>>;
  return { ...run, result: await handler("ORIGINAL_USER_MESSAGE") };
}

test("rest: copied fetch example type-checks and honors action plus replacement semantics", async () => {
  assertTyped(block("rest-api", "fetch API"), "REST fetch helper");
  for (const action of ["BLOCK", "HUMAN_REVIEW", "UNKNOWN_ACTION"]) {
    const denied = await restFetch([fixture(action, { allowed: true })]);
    assert.equal(denied.result.blocked, true, `${action} must never resume with original input`);
    assert.ok(!JSON.stringify(denied.result).includes("ORIGINAL_USER_MESSAGE"));
  }
  for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"]) {
    const transformed = await restFetch([fixture(action, { redactedText: "SANITIZED_INPUT" })]);
    assert.equal(transformed.result.text, "SANITIZED_INPUT");
    const missing = await restFetch([fixture(action)]);
    assert.equal(missing.result.blocked, true);
  }
  const allowed = await restFetch([fixture("ALLOW")]);
  assert.equal(allowed.result.text, "ORIGINAL_USER_MESSAGE");
  assert.equal(allowed.sent[0].url, "https://docs.invalid/api/guard/input");
  assert.equal(allowed.sent[0].headers.get("x-api-key"), "offline-docs-fixture");
  assert.equal(inputGuardSchema.safeParse(allowed.sent[0].body).success, true);
});

test("rest: fetch treats unavailable and malformed checks as errors, not successful guard results", async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    await assert.rejects(() => restFetch([{ status, body: { error: true, message: "Offline error fixture." } }]));
  }
  await assert.rejects(() => restFetch([{ error: new Error("offline network failure") }]));
  await assert.rejects(() => restFetch([{ body: null }]));
});

test("rest: displayed curl commands parse in bash and JSON bodies satisfy live request schemas", () => {
  const items = [["inputCurl", inputGuardSchema], ["outputCurl", outputGuardSchema]] as const;
  for (const [name, schema] of items) {
    const snippet = code("rest-api", name);
    const parsed = spawnSync("bash", ["-n"], { input: snippet, encoding: "utf8", timeout: 10000 });
    assert.equal(parsed.status, 0, `${name}: ${parsed.stderr}`);
    assert.ok(snippet.includes('"x-api-key: $SOTER_API_KEY"'), "curl must reference a backend-only environment key");
    const body = snippet.match(/(?:-d|--data(?:-raw)?)\s+'(\{[\s\S]*\})'/)?.[1];
    assert.ok(body, `${name}: retain a copyable JSON body`);
    assert.equal(schema.safeParse(JSON.parse(body)).success, true, `${name}: implementation schema`);
  }
  assert.ok(code("rest-api", "envCode").includes("SOTER_BASE_URL="), "REST callers need an explicit or defaulted base URL");
});

function restPython(status: number) {
  const script = String.raw`
import json, os, sys, types
import requests
payload = json.load(sys.stdin)
os.environ.update(SOTER_API_KEY="offline-docs-fixture", SOTER_BASE_URL="https://docs.invalid")
sent=[]
class Response:
    status_code=payload["status"]
    def raise_for_status(self):
        if not 200 <= self.status_code < 300: raise requests.HTTPError("offline HTTP failure")
    def json(self): return {"error": True} if self.status_code != 200 else {"allowed": True, "action": "ALLOW"}
def post(url, **kwargs):
    sent.append({"url":url,"body":kwargs.get("json"),"timeout":kwargs.get("timeout")})
    return Response()
requests.post = post
ns={}
exec(compile(payload["code"],"rest-docs-example.py","exec"),ns)
try:
    result=ns["guard_input"]("ORIGINAL_USER_MESSAGE")
    output={"result":result,"raised":None}
except Exception as error:
    output={"raised":type(error).__name__}
print(json.dumps({**output,"sent":sent}))
`;
  const execution = spawnSync(process.env.DOCS_TEST_PYTHON ?? "python", ["-B", "-c", script], {
    input: JSON.stringify({ code: block("rest-api", "requests library"), status }), encoding: "utf8", timeout: 20000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(execution.status, 0, execution.stderr);
  return JSON.parse(execution.stdout) as { raised: string | null; sent: Array<{ body: unknown; timeout: number }>; result?: Record<string, unknown> };
}

test("rest: requests example raises HTTP failures and sends schema-valid JSON with a timeout", () => {
  const allowed = restPython(200);
  assert.equal(allowed.raised, null);
  assert.equal(inputGuardSchema.safeParse(allowed.sent[0].body).success, true);
  assert.ok(allowed.sent[0].timeout > 0);
  for (const status of [401, 429, 503]) assert.equal(restPython(status).raised, "HTTPError");
});

test("rest: retained language transports encode JSON and check failures without claiming runtime certification", () => {
  const expectations: Array<[string, RegExp, RegExp]> = [
    ["java.net.http", /writeValueAsString/, /statusCode\(\)/],
    ["net/http", /json\.(?:Marshal|NewEncoder)/, /StatusCode/],
    ["cURL", /json_encode/, /CURLINFO_(?:HTTP_CODE|RESPONSE_CODE)/],
    ["HttpClient", /JsonSerializer\.Serialize/, /EnsureSuccessStatusCode/],
    ["Net::HTTP", /to_json/, /Net::HTTPSuccess/],
    ["reqwest", /\.json\(/, /error_for_status/],
  ];
  for (const [title, encoding, failure] of expectations) {
    const snippet = block("rest-api", title);
    assert.ok(encoding.test(snippet), `${title}: serialize, do not interpolate unescaped JSON`);
    assert.ok(failure.test(snippet), `${title}: non-2xx must not silently become a guard result`);
    assert.ok(!snippet.includes("***"), `${title}: preserve runnable syntax`);
  }
  assert.ok(block("rest-api", "HttpClient").includes('baseUrl + "/api/guard/input"'), "C# URL must be a valid string expression");
  assert.ok(/transport examples/i.test(sources["rest-api"]));
  assert.ok(/not.*(?:runtime|compatibility).*certif/i.test(sources["rest-api"]));
});

for (const page of ["rest-api", "api-contract"] as const) {
  const prefix = page === "rest-api" ? "rest" : "contract";
  test(`${prefix}: JSON examples and field descriptions match the wire serializer, not SDK-only fields`, () => {
    const examples = codeBlocks(page).filter((entry) => entry.language === "json").map((entry) => JSON.parse(entry.code));
    const guardExamples = examples.filter((entry) => typeof entry.allowed === "boolean");
    assert.ok(guardExamples.length > 0);
    for (const sample of guardExamples) {
      assert.ok(!("decision" in sample), "decision is SDK-derived, not emitted by toPublicGuardResult");
      assert.equal(typeof sample.reason, "string", "reason is a string, even on ALLOW");
      assert.ok(!("safeText" in sample) || typeof sample.safeText === "string");
      assert.ok(!("redactedText" in sample) || typeof sample.redactedText === "string");
      assertTyped('import type { GuardResult } from "../lib/guard/types";\nconst sample: GuardResult & { latencyMs?: number } = ' + JSON.stringify(sample) + ';', `${page} wire fixture`);
      const { latencyMs: _latency, ...base } = sample;
      assert.deepEqual(toPublicGuardResult({ ...base, originalText: "PRIVATE_ORIGINAL" }), base);
    }
    assert.ok(sources[page].includes("SDK-derived"));
    assert.ok(/illustrative/i.test(sources[page]), "fixtures must not be described as measured verdicts");
    assert.ok(sources[page].includes("latencyMs"));
    assert.ok(sources[page].includes("X-Soter-Latency-Ms"));
  });
  test(`${prefix}: public analyzer requires direction and dashboards are session-only`, () => {
    assert.equal(analyzeSchema.safeParse({ text: "offline example" }).success, false);
    assert.equal(analyzeSchema.safeParse({ text: "offline example", direction: "INPUT" }).success, true);
    assert.equal(analyzeSchema.safeParse({ text: "offline example", direction: "SIDEWAYS" }).success, false);
    assert.ok(!sources[page].includes("direction?"), "REST analyze.direction is mandatory");
    assert.ok(sources[page].includes("session-only"));
    for (const route of ["/api/projects", "/api/api-keys", "/api/webhooks"]) assert.ok(sources[page].includes(route), route);
    assert.ok(sources[page].includes("x-api-key"));
    assert.ok(sources[page].includes("415"));
    assert.ok(sources[page].includes("503"));
    assert.ok(!sources[page].includes("API key inactive"), "inactive keys fail 401; 403 is not limited to inactive keys");
  });
}

test("contract: risk vocabulary and webhook events cover the implementation rather than a stale subset", () => {
  const riskRows = literal(constant("api-contract", "riskTypes")) as string[][];
  assert.deepEqual(riskRows.map((entry) => entry[0]).sort(), [...RISK_TYPES].sort());
  assert.ok(riskRows.every((entry) => !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(entry[2])), "severity belongs to each finding, not a fixed risk-type lookup");
  let events: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isArrayLiteralExpression(node) && node.elements.length > 0 && node.elements.every((entry) => ts.isStringLiteral(entry) && /^(guard|usage|governance)\./.test(entry.text))) {
      events = node.elements.map((entry) => (entry as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  }
  visit(pageAst("api-contract"));
  assert.deepEqual(events.sort(), [...WEBHOOK_EVENT_VALUES].sort());
  const actions = literal(constant("api-contract", "actions")) as Parameters<typeof normalizeDecision>[0][];
  assert.deepEqual(actions.map(normalizeDecision), ["ALLOW", "REDACT", "REDACT", "BLOCK", "HUMAN_REVIEW"]);
  assert.ok(sources["api-contract"].includes("x-soter-idempotency-key"));
  assert.ok(sources["api-contract"].includes("timestamp.rawBody"));
});

test("contract: distinguish JavaScript decision normalization from Python result objects", () => {
  for (const page of ["rest-api", "api-contract"] as const) {
    assert.ok(!sources[page].includes("SDKs normalize"), `${page}: Python GuardResult does not expose a derived decision`);
    assert.ok(sources[page].includes("JavaScript SDK"));
  }
});
