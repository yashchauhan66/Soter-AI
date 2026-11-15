import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";
import { soterInputMiddleware, soterOutputMiddleware } from "../packages/sdk/src/express";

// Execute the displayed middleware literal with the real SDK. Substitute only
// Express's structural request/response boundary and the two external IO calls.
// In particular, never overwrite options.fetch: the published adapter must run.
const root = process.env.DOCS_EXPRESS_DENIAL_ROOT ?? process.cwd();
const file = path.join(root, "app/docs/express/page.tsx");
const pageBytes = readFileSync(file);
const ast = ts.createSourceFile(file, pageBytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find((entry) => entry.name.getText(ast) === "middlewareCode");
assert.ok(declaration?.initializer && ts.isNoSubstitutionTemplateLiteral(declaration.initializer), "middlewareCode must be the exact published literal");
const code = declaration.initializer.text;
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
console.info(`FW003_SOURCE ${JSON.stringify({ path: file.replaceAll("\\", "/"), pageSha256: sha256(pageBytes), snippetSha256: sha256(code) })}`);
for (const relative of ["tests/docs-express-denial.test.ts", "packages/sdk/src/express.ts", "packages/sdk/src/client.ts", "packages/sdk/src/errors.ts", "packages/sdk/src/types.ts"]) {
  console.info(`FW003_PIN ${JSON.stringify({ path: relative, sha256: sha256(readFileSync(path.join(process.cwd(), relative))) })}`);
}
const compiled = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  reportDiagnostics: true, fileName: "express-middleware.published.js",
});
assert.deepEqual((compiled.diagnostics ?? []).filter((entry) => entry.category === ts.DiagnosticCategory.Error), [], "published middleware must parse without source repair");
const script = new Script(compiled.outputText, { filename: "express-middleware.published.js" });

type Role = "input" | "output";
type Raw = Record<string, unknown>;
type RequestLike = { body: { message: string }; [key: string]: unknown };
type ResponseLike = {
  statusCode: number;
  locals: Record<string, unknown>;
  status(code: number): ResponseLike;
  json(value: unknown): ResponseLike;
};
type Next = (error?: unknown) => void;
type Handler = (req: RequestLike, res: ResponseLike, next: Next) => unknown;
type ErrorHandler = (error: unknown, req: RequestLike, res: ResponseLike, next: Next) => unknown;
const original = { input: "SYNTHETIC_ORIGINAL_INPUT", output: "SYNTHETIC_ORIGINAL_OUTPUT" };
const safe = { input: "safe input", output: "safe output" };
const untrusted = "SYNTHETIC_UNTRUSTED_DENIAL_TEXT";
const diagnostic = "SYNTHETIC_PRIVATE_GUARD_DIAGNOSTIC";
const diagnostics = {
  reason: diagnostic, riskScore: 90, riskTypes: [diagnostic],
  findings: [{ type: "SECRET_DETECTED", message: diagnostic, matched: diagnostic, details: { text: diagnostic } }],
  metadata: { nested: { text: diagnostic } },
};
const allow = (): Raw => ({ allowed: true, action: "ALLOW", ...diagnostics });
const rewrittenInput = (): Raw => ({ allowed: true, action: "REWRITE", safeText: safe.input, ...diagnostics });

async function invoke(input: Raw, output: Raw) {
  const calls: string[] = [];
  const requests: Array<{ path: string; body: Raw }> = [];
  const serializations: string[] = [];
  let handlers: Handler[] = [];
  let errorHandler: ErrorHandler | undefined;
  const app = {
    post(url: string, ...route: Handler[]) { assert.equal(url, "/chat"); handlers = route; },
    use(item: unknown) {
      if (typeof item === "function" && item.length === 4) errorHandler = item as ErrorHandler;
    },
  };
  const express = Object.assign(() => app, { json: () => (_req: unknown, _res: unknown, next: Next) => next() });
  const transport: typeof fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "https://guard.example.test", "no live service may be contacted");
    assert.equal(init?.method, "POST");
    assert.ok(["/api/guard/input", "/api/guard/output"].includes(parsed.pathname), "unexpected guard endpoint");
    requests.push({ path: parsed.pathname, body: JSON.parse(String(init?.body)) as Raw });
    return Response.json(parsed.pathname.endsWith("/input") ? input : output);
  };
  const modules: Record<string, unknown> = {
    express,
    // Pass the actual factories unchanged, including their normalization and
    // early res.json calls. Their supplied fetch is the published adapter.
    "@soterai/core/express": { soterInputMiddleware, soterOutputMiddleware },
    "./llm.js": { callLLM: async (text: string) => { calls.push(text); return original.output; } },
  };
  script.runInNewContext({
    exports: {}, Response, fetch: transport,
    process: { env: { SOTER_API_KEY: "synthetic-offline-key", SOTER_BASE_URL: "https://guard.example.test" } },
    require: (id: string) => { assert.ok(Object.hasOwn(modules, id), `unapproved module ${id}`); return modules[id]; },
  }, { timeout: 2000 });
  assert.equal(handlers.length, 5, "exercise the complete published middleware chain");
  assert.ok(errorHandler, "published error handler must be installed");
  const req: RequestLike = { body: { message: original.input } };
  const res: ResponseLike = {
    statusCode: 200, locals: {},
    status(status) { this.statusCode = status; return this; },
    json(value) { serializations.push(JSON.stringify(value)); return this; },
  };
  async function step(index: number): Promise<void> {
    if (serializations.length || !handlers[index]) return;
    let continuation: Promise<void> | undefined;
    await handlers[index](req, res, (error) => {
      continuation = error === undefined ? step(index + 1) : Promise.resolve().then(async () => {
        await errorHandler!(error, req, res, () => assert.fail("error must not resume the route"));
      });
    });
    await continuation;
  }
  await step(0);
  assert.equal(serializations.length, 1, "a request must serialize exactly one complete public response");
  return { status: res.statusCode, publicJson: serializations[0], calls, requests };
}

type Observation = Awaited<ReturnType<typeof invoke>>;
function assertFlow(row: Observation, deniedInput: boolean, providerInput: string) {
  assert.deepEqual(row.calls, deniedInput ? [] : [providerInput], "denied input must suppress the provider; permitted input must use selected text");
  assert.deepEqual(row.requests.map((entry) => entry.path), deniedInput ? ["/api/guard/input"] : ["/api/guard/input", "/api/guard/output"], "guard direction/order/count must match the public turn");
  assert.equal(row.requests[0].body.message, original.input);
  if (!deniedInput) assert.equal(row.requests[1].body.aiResponse, original.output);
  assert.equal(row.status, 200, "preserve the documented middleware denial/success status");
}

function denialVariants(role: Role): Array<{ name: string; fields: Raw }> {
  return [
    { name: "safeText-original", fields: { safeText: original[role] } },
    { name: "safeText-untrusted", fields: { safeText: untrusted } },
    { name: "redactedText-original", fields: { redactedText: original[role] } },
    { name: "redactedText-untrusted", fields: { redactedText: untrusted } },
    { name: "both-text-fields", fields: { safeText: original[role], redactedText: untrusted } },
    { name: "null-safeText", fields: { safeText: null, redactedText: original[role] } },
    { name: "empty-safeText", fields: { safeText: "", redactedText: original[role] } },
    { name: "object-safeText", fields: { safeText: { nested: original[role] }, redactedText: untrusted } },
    { name: "array-redactedText", fields: { redactedText: [original[role]] } },
    { name: "missing-text-fields", fields: {} },
    { name: "omitted-decision", fields: { decision: undefined, safeText: original[role], redactedText: untrusted } },
  ];
}

for (const role of ["input", "output"] as const) {
  for (const action of ["BLOCK", "HUMAN_REVIEW"] as const) {
    for (const variant of denialVariants(role)) {
      const id = `FW-003: ${role}/${action}/${variant.name} publishes only the fixed refusal`;
      test(id, async () => {
        const denied = { allowed: false, action, decision: action, ...diagnostics, ...variant.fields };
        const row = await invoke(role === "input" ? denied : rewrittenInput(), role === "output" ? denied : allow());
        console.info(`FW003_CASE ${JSON.stringify({ id, ...row })}`);
        assertFlow(row, role === "input", safe.input);
        assert.deepEqual(JSON.parse(row.publicJson), { blocked: true, reply: "Response withheld." }, "the entire public JSON must be application-owned, even when the guard supplies denied text");
        for (const marker of [original.input, original.output, untrusted, diagnostic]) {
          assert.equal(row.publicJson.includes(marker), false, "no original, untrusted replacement or nested diagnostic may be published");
        }
      });
    }
  }
}

test("FW-003 control: ALLOW without replacements preserves original input/output", async () => {
  const row = await invoke(allow(), allow());
  console.info(`FW003_CASE ${JSON.stringify({ id: "valid/allow-original", ...row })}`);
  assertFlow(row, false, original.input);
  assert.deepEqual(JSON.parse(row.publicJson), { blocked: false, reply: original.output });
  assert.equal(row.publicJson.includes(diagnostic), false, "permitted results must not expose diagnostics either");
});

for (const role of ["input", "output"] as const) {
  for (const action of ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"] as const) {
    for (const field of ["safeText", "redactedText", "both-prefer-safeText"] as const) {
      const id = `FW-003 control: ${role}/${action}/${field} preserves valid selected text`;
      test(id, async () => {
        const replacement = field === "both-prefer-safeText"
          ? { safeText: safe[role], redactedText: "different lower-precedence replacement" }
          : { [field]: safe[role] };
        const permitted = { allowed: true, action, decision: action === "ALLOW" ? "ALLOW" : "REDACT", ...diagnostics, ...replacement };
        const row = await invoke(role === "input" ? permitted : allow(), role === "output" ? permitted : allow());
        console.info(`FW003_CASE ${JSON.stringify({ id, ...row })}`);
        assertFlow(row, false, role === "input" ? safe.input : original.input);
        assert.deepEqual(JSON.parse(row.publicJson), { blocked: false, reply: role === "output" ? safe.output : original.output });
        assert.equal(row.publicJson.includes(diagnostic), false, "permitted results must not expose diagnostics either");
      });
    }
  }
}
