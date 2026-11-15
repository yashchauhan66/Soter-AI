import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { Script } from "node:vm";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { Soter } from "../packages/sdk/src/soter";
import type { ClientOptions, GuardResult } from "../packages/sdk/src/types";
import { createGuardedRoute } from "../packages/sdk/src/next";
import { createAgentFirewallClient } from "../packages/sdk/src/client";

const root = process.env.DOCS_FRAMEWORKS_ROOT ?? process.cwd();
const localRequire = createRequire(import.meta.url);

function verdict(action: GuardResult["action"], safeText?: string): GuardResult {
  return {
    allowed: ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"].includes(action),
    action, riskScore: action === "BLOCK" ? 90 : 0, riskTypes: [], reason: "synthetic verdict", findings: [],
    ...(safeText === undefined ? {} : { safeText }),
  };
}

/** Real SDK transport + decisions; only the remote HTTP boundary is substituted. */
function fixtureSdk(responses: Array<GuardResult | Error | Record<string, unknown>>) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetchFixture: typeof fetch = async (url, init) => {
    requests.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
    const next = responses.shift();
    assert.ok(next, "unexpected guard request");
    if (next instanceof Error) throw next;
    return Response.json(next);
  };
  class TestSoter extends Soter {
    constructor(options: Partial<ClientOptions> = {}) {
      super({ ...options, apiKey: "synthetic-test-key", retries: 0, maxRetries: 0, fetch: fetchFixture });
    }
  }
  return { Soter: TestSoter, requests, fetch: fetchFixture };
}

/** Extract the actual published string, not a second copy of the example. */
function snippet(page: string, name: string): string {
  const file = path.join(root, "app/docs", page, "page.tsx");
  const bytes = readFileSync(file);
  console.info(`CONSUMED ${file} sha256=${createHash("sha256").update(bytes).digest("hex")} snippet=${name}`);
  const source = ts.createSourceFile(file, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== name || !declaration.initializer) continue;
      const value = declaration.initializer;
      assert.ok(ts.isNoSubstitutionTemplateLiteral(value) || ts.isStringLiteral(value), `${page}.${name} must be a literal published example`);
      return value.text;
    }
  }
  assert.fail(`Missing published example ${page}.${name}`);
}

/** Only repository-owned docs bytes execute, with an allowlisted require. */
function loadSnippet(page: string, name: string, expose = "", bindings: Record<string, unknown> = {}) {
  const code = snippet(page, name);
  const compiled = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
    fileName: `${page}-${name}.tsx`,
  });
  const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], `${page}.${name} must parse without repairing its source`);
  const exports: Record<string, unknown> = {};
  const modules = bindings.modules as Record<string, unknown> | undefined;
  const sandbox = {
    Buffer, Response, Request, FormData, URL, AbortController,
    process: { env: { SOTER_API_KEY: "synthetic-test-key" } },
    console,
    ...bindings,
    exports,
    require: (id: string) => {
      if (id === "crypto" || id === "node:crypto") return localRequire(id);
      if (modules && id in modules) return modules[id];
      throw new Error(`Snippet requested an unapproved dependency: ${id}`);
    },
  };
  const body = `${compiled.outputText}\n${expose ? `exports.__test = { ${expose} };` : ""}`;
  const executable = bindings.runAsBody ? `(async () => { ${body}\n${bindings.invoke ? `return ${bindings.invoke};` : ""} })()` : body;
  const script = new Script(executable, { filename: `${page}-${name}.published.js` });
  const returned = script.runInNewContext(sandbox, { timeout: 2000 });
  if (bindings.runAsBody) return returned;
  return (expose ? exports.__test : exports) as Record<string, (...args: never[]) => unknown>;
}

test("best-practices: published webhook verifier rejects stale, future and malformed signatures without throwing", () => {
  const { verify } = loadSnippet("best-practices", "webhookVerifyCode", "verify");
  const check = verify as unknown as (raw: string, header: string, secret: string) => boolean;
  const now = Math.floor(Date.now() / 1000);
  const body = '{"id":"synthetic-event","event":"guard.secret.detected"}';
  const secret = "synthetic-webhook-secret-not-a-credential";
  const signed = (at: number) => `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;
  assert.equal(check(body, signed(now), secret), true, "current authentic payload should verify");
  assert.equal(check(body, signed(now - 301), secret), false, "stale signed payload must not be accepted");
  assert.equal(check(body, signed(now + 301), secret), false, "future timestamp outside the window must fail");
  for (const invalid of ["", `t=${now},v1=a`, `t=${now},v1=${"a".repeat(63)}`, `junk,${signed(now)}`, `${signed(now)},v1=${"b".repeat(64)}`]) {
    assert.doesNotThrow(() => check(body, invalid, secret));
    assert.equal(check(body, invalid, secret), false, invalid);
  }
  assert.equal(check(body + " ", signed(now), secret), false, "verification must bind the exact raw body");
});

test("nextjs: published manual route never releases denied output or provider errors", async () => {
  const raw = "SYNTHETIC_PRIVATE_MODEL_TEXT";
  for (const output of [verdict("BLOCK"), verdict("HUMAN_REVIEW"), new Error(raw)]) {
    const sdk = fixtureSdk([verdict("ALLOW_WITH_REDACTION", "sanitized input"), output]);
    const received: string[] = [];
    const callYourLLM = async (message: string) => { received.push(message); return raw; };
    const { POST } = loadSnippet("nextjs", "routeHandler", "", {
      callYourLLM,
      modules: { "@soterai/core": sdk, "@/lib/llm": { callYourLLM } },
    });
    const response = await (POST as unknown as (request: Request) => Promise<Response>)(new Request("https://app.example.test/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "original input" }),
    }));
    const text = await response.text();
    assert.equal(text.includes(raw), false, "blocked or failed output must not return the original model text");
    assert.equal(JSON.parse(text).blocked, true);
    assert.deepEqual(received, ["sanitized input"]);
    assert.deepEqual(sdk.requests.map((r) => r.path), ["/api/guard/input", "/api/guard/output"]);
  }
});

test("nextjs: manual route validates JSON and stops before the model on denied input", async () => {
  for (const body of ["{", "null", "[]", '{"message":42}', '{"message":"  "}', JSON.stringify({ message: "x".repeat(8001) })]) {
    const sdk = fixtureSdk([]);
    const { POST } = loadSnippet("nextjs", "routeHandler", "", {
      callYourLLM: async () => assert.fail("model called for invalid input"),
      modules: { "@soterai/core": sdk, "@/lib/llm": { callYourLLM: async () => assert.fail("model called") } },
    });
    const response = await (POST as unknown as (req: Request) => Promise<Response>)(new Request("https://app.example.test/api/chat", { method: "POST", body }));
    assert.equal(response.status, 400);
    assert.equal(sdk.requests.length, 0);
  }
  for (const input of [verdict("BLOCK"), verdict("HUMAN_REVIEW"), new Error("SYNTHETIC_PROVIDER_DETAIL")]) {
    const sdk = fixtureSdk([input]);
    const { POST } = loadSnippet("nextjs", "routeHandler", "", {
      callYourLLM: async () => assert.fail("denied input reached the model"),
      modules: { "@soterai/core": sdk, "@/lib/llm": { callYourLLM: async () => assert.fail("model called") } },
    });
    const response = await (POST as unknown as (req: Request) => Promise<Response>)(new Request("https://app.example.test/api/chat", { method: "POST", body: JSON.stringify({ message: "hello" }) }));
    assert.equal((await response.json()).blocked, true);
    assert.equal(sdk.requests.length, 1);
  }
});

test("nextjs: server action guards output and returns a safe failure object", async () => {
  const raw = "SYNTHETIC_ACTION_MODEL_TEXT";
  for (const output of [verdict("BLOCK"), verdict("HUMAN_REVIEW"), new Error(raw)]) {
    const sdk = fixtureSdk([verdict("ALLOW"), output]);
    const callLLM = async () => raw;
    const { submitMessage } = loadSnippet("nextjs", "serverActionCode", "", {
      callLLM, crypto: { randomUUID: () => "synthetic-session" },
      modules: { "@soterai/core": sdk, "@/lib/llm": { callLLM }, "next/cache": { revalidatePath: () => {} } },
    });
    const form = new FormData(); form.set("message", "hello");
    const result = await (submitMessage as unknown as (data: FormData) => Promise<Record<string, unknown>>)(form);
    assert.equal(JSON.stringify(result).includes(raw), false, "server actions must withhold blocked output");
    assert.equal(result.blocked, true);
    assert.equal(sdk.requests.length, 2);
  }
});

test("nextjs: helper example projects a public response instead of guard diagnostics or exception text", async () => {
  const raw = "SYNTHETIC_HELPER_PRIVATE_TEXT";
  for (const output of [{ ...verdict("BLOCK"), findings: [{ type: "SECRET_DETECTED", label: "synthetic", severity: "HIGH", score: 80, message: raw, matched: raw }] } as GuardResult, new Error(raw)]) {
    const sdk = fixtureSdk([verdict("ALLOW"), output]);
    const myLLMCall = async () => raw;
    const { POST } = loadSnippet("nextjs", "oneLiner", "", {
      myLLMCall,
      modules: {
        "@/lib/llm": { myLLMCall },
        "@soterai/core/next": { createGuardedRoute: (options: Parameters<typeof createGuardedRoute>[0]) => createGuardedRoute({ ...options, fetch: sdk.fetch, maxRetries: 0 }) },
      },
    });
    const response = await (POST as unknown as (req: Request) => Promise<Response>)(new Request("https://app.example.test/api/chat", { method: "POST", body: JSON.stringify({ message: "hello" }) }));
    const body = await response.text();
    assert.equal(body.includes(raw), false, "diagnostics and provider errors are not a public reply");
    assert.equal(JSON.parse(body).blocked, true);
  }
});

test("nextjs: browser example treats blocked and failed requests as withheld", async () => {
  const raw = "SYNTHETIC_BROWSER_UNSAFE_TEXT";
  for (const response of [Response.json({ blocked: true, reply: raw }), new Error(raw), new Response("unavailable", { status: 503 })]) {
    const states: unknown[] = [];
    class TestFormData extends FormData { constructor() { super(); this.set("message", "hello"); } }
    const { default: ChatPage } = loadSnippet("nextjs", "clientComponent", "", {
      FormData: TestFormData,
      fetch: async (url: string) => { assert.equal(url, "/api/chat"); if (response instanceof Error) throw response; return response; },
      modules: {
        react: { useState: (value: unknown) => [value, (next: unknown) => states.push(next)] },
        "react/jsx-runtime": localRequire("react/jsx-runtime"),
      },
    });
    const form = ChatPage() as { props: { onSubmit: (event: unknown) => Promise<void> } };
    await form.props.onSubmit({ preventDefault() {}, currentTarget: {} });
    assert.equal(states.includes(raw), false, "browser must not display reply when blocked");
    assert.ok(states.some((value) => typeof value === "string" && value.length > 0), "show a usable failure message");
  }
});

type Handler = (req: Record<string, unknown>, res: ExpressResponse, next: (error?: unknown) => void) => unknown;
type ExpressResponse = { statusCode: number; body?: unknown; locals: Record<string, unknown>; status(code: number): ExpressResponse; json(value: unknown): unknown };
function expressHarness() {
  let handlers: Handler[] = [];
  let errorHandler: ((err: unknown, req: unknown, res: ExpressResponse, next: unknown) => unknown) | undefined;
  const app = {
    post(_path: string, ...route: Handler[]) { handlers = route; },
    use(...middleware: unknown[]) {
      for (const item of middleware) if (typeof item === "function" && item.length === 4) errorHandler = item as typeof errorHandler;
    },
  };
  const express = Object.assign(() => app, { json: () => (_req: unknown, _res: unknown, next: () => void) => next() });
  async function invoke(body: unknown) {
    const req = { body };
    const res: ExpressResponse = { statusCode: 200, locals: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    async function step(index: number): Promise<void> {
      if (!handlers[index] || res.body !== undefined) return;
      let continuation: Promise<void> | undefined;
      await handlers[index](req, res, (error) => {
        continuation = error === undefined ? step(index + 1) : Promise.resolve().then(async () => {
          if (!errorHandler) throw error;
          await errorHandler(error, req, res, () => {});
        });
      });
      await continuation;
    }
    await step(0);
    return res;
  }
  return { app, express, invoke };
}

for (const name of ["basicCode", "middlewareCode"]) {
  test(`express: ${name} withholds blocked output and handles guard failure before sending JSON`, async () => {
    for (const output of [verdict("BLOCK"), verdict("HUMAN_REVIEW"), new Error("SYNTHETIC_EXPRESS_PRIVATE_TEXT")]) {
      const raw = "SYNTHETIC_EXPRESS_PRIVATE_TEXT";
      const sdk = fixtureSdk([verdict("ALLOW_WITH_REDACTION", "safe input"), output]);
      const harness = expressHarness();
      const received: string[] = [];
      const callLLM = async (text: string) => { received.push(text); return raw; };
      const middleware = await import("../packages/sdk/src/express");
      loadSnippet("express", name, "", {
        app: harness.app, callLLM,
        modules: {
          express: harness.express, "@soterai/core": sdk, "./llm.js": { callLLM },
          "@soterai/core/express": {
            soterInputMiddleware: (options: Parameters<typeof middleware.soterInputMiddleware>[0]) => middleware.soterInputMiddleware({ ...options, fetch: sdk.fetch }),
            soterOutputMiddleware: (options: Parameters<typeof middleware.soterOutputMiddleware>[0]) => middleware.soterOutputMiddleware({ ...options, fetch: sdk.fetch }),
          },
        },
      });
      const res = await harness.invoke({ message: "original input" });
      assert.equal(JSON.stringify(res.body).includes(raw), false, "no response may contain denied model text");
      assert.equal((res.body as { blocked: boolean }).blocked, true);
      assert.deepEqual(received, ["safe input"]);
      assert.equal(sdk.requests.length, 2, "input and output adapters must both run");
    }
  });
}


const fastapiProbe = String.raw`
import asyncio, json, os, sys, types
from pathlib import Path
payload = json.load(sys.stdin)
sys.path.insert(0, str(Path(payload["root"]) / "packages/python-sdk"))
os.environ["SOTER_API_KEY"] = "synthetic-test-key"
import requests, httpx, soter
from fastapi.testclient import TestClient
from soter.async_client import AsyncSoter as RealAsyncSoter
RealSoter = soter.Soter
private = "SYNTHETIC_FASTAPI_PRIVATE_TEXT"
model_calls, requests_seen = [], []
mode = "output-block"

def answer(body, path):
    requests_seen.append((path, body))
    is_output = path.endswith("/output")
    if mode == "unavailable" and is_output:
        raise requests.ConnectionError(private)
    blocked = (mode == "input-block" and not is_output) or (mode in ("output-block", "output-review") and is_output)
    action = "HUMAN_REVIEW" if mode == "output-review" and is_output else "BLOCK" if blocked else "ALLOW"
    result = {"allowed": not blocked, "action": action, "riskScore": 80 if blocked else 0, "riskTypes": [], "reason": "synthetic", "findings": []}
    if blocked:
        result["findings"] = [{"type": "SECRET_DETECTED", "matched": private, "message": private}]
    if mode == "redacted":
        result.update(action="ALLOW_WITH_REDACTION", safeText="safe output" if is_output else "safe input")
    return result

class Session:
    def post(self, url, *, json, headers, timeout):
        data = answer(json, url)
        return types.SimpleNamespace(status_code=200, text=__import__("json").dumps(data), headers={})

class TestSoter(RealSoter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **{**kwargs, "session": Session()})

def async_response(request):
    try:
        data = answer(json.loads(request.content), request.url.path)
    except requests.ConnectionError as exc:
        raise httpx.ConnectError(str(exc), request=request)
    return httpx.Response(200, json=data)

class TestAsyncSoter(RealAsyncSoter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **{**kwargs, "client": httpx.AsyncClient(transport=httpx.MockTransport(async_response))})

soter.Soter, soter.AsyncSoter = TestSoter, TestAsyncSoter
llm = types.ModuleType("your_app.llm")
def my_llm_call(prompt):
    model_calls.append(prompt)
    return private
async def my_async_llm_call(prompt):
    model_calls.append(prompt)
    return private
llm.my_llm_call, llm.my_async_llm_call = my_llm_call, my_async_llm_call
sys.modules["your_app"] = types.ModuleType("your_app")
sys.modules["your_app.llm"] = llm
for mode in ("output-block", "output-review", "unavailable", "input-block", "redacted"):
    model_calls.clear(); requests_seen.clear()
    namespace = {"my_llm_call": my_llm_call}
    # Historical fragments depend on these application definitions.
    from fastapi import FastAPI
    from pydantic import BaseModel
    class ChatRequest(BaseModel):
        message: str
    namespace.update(app=FastAPI(), ChatRequest=ChatRequest)
    exec(compile(payload["code"], payload["name"] + ".published.py", "exec"), namespace)
    with TestClient(namespace["app"], raise_server_exceptions=False) as client:
        response = client.post("/chat", json={"message": "hello"})
        if mode == "redacted":
            assert response.status_code == 200, response.text
            assert response.json() == {"blocked": False, "reply": "safe output"}, response.text
            assert model_calls == ["safe input"], model_calls
        else:
            assert private not in response.text, "private model/guard diagnostics leaked: " + response.text
            assert response.status_code == (503 if mode == "unavailable" else 200), response.text
            assert response.json()["blocked"] is True, response.text
        if mode == "input-block": assert model_calls == [], model_calls
        before = len(requests_seen)
        for bad in ({"message": ""}, {"message": "   "}, {"message": 42}, {"message": "x" * 8001}, {}):
            invalid = client.post("/chat", json=bad)
            assert invalid.status_code == 422, invalid.text
        assert len(requests_seen) == before, "invalid message reached Soter"
    print(json.dumps({"mode": mode, "status": response.status_code, "requests": len(requests_seen), "models": len(model_calls)}))
print("FASTAPI_PUBLISHED_EXAMPLE_PASS")
`;

for (const name of ["quickstartCode", "manualCode", "asyncCode"]) {
  test(`fastapi: ${name} runs through real ASGI validation and withholds denial/error diagnostics`, () => {
    const child = spawnSync(process.env.DOCS_PYTHON ?? "python", ["-c", fastapiProbe], {
      encoding: "utf8", input: JSON.stringify({ root: process.cwd(), name, code: snippet("fastapi", name) }),
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }, timeout: 30000,
    });
    console.info(child.stdout);
    assert.equal(child.status, 0, child.stderr || child.error?.message || "Python probe failed");
    assert.match(child.stdout, /FASTAPI_PUBLISHED_EXAMPLE_PASS/);
  });
}

test("generic-chatbot: basic pattern withholds denied or unavailable output", async () => {
  for (const output of [verdict("BLOCK"), verdict("HUMAN_REVIEW"), new Error("SYNTHETIC_CHAT_PRIVATE")]) {
    const sdk = fixtureSdk([verdict("ALLOW_WITH_REDACTION", "safe input"), output]);
    const received: string[] = [];
    const callLLM = async (input: string) => { received.push(input); return "SYNTHETIC_CHAT_PRIVATE"; };
    const result = await loadSnippet("generic-chatbot", "basicCode", "", {
      runAsBody: true, invoke: "chat(userMessage)", userMessage: "original", callLLM,
      modules: { "@soterai/core": sdk, "./llm": { callLLM } },
    });
    assert.equal(JSON.stringify(result).includes("SYNTHETIC_CHAT_PRIVATE"), false);
    assert.equal(result.blocked, true);
    assert.deepEqual(received, ["safe input"]);
  }
});

test("generic-chatbot: writing tool only executes ALLOW or usable REDACT, never restrictions or approval", async () => {
  for (const decision of ["BLOCK", "ASK_APPROVAL", "SANDBOX_ONLY", "READ_ONLY", "UNKNOWN", "REDACT", "ALLOW"] as const) {
    const session = { sessionId: "synthetic-session", policy: {}, allowedTools: [], blockedTools: [], approvalRequiredTools: [] };
    const action = { decision, riskLevel: "HIGH", reason: "synthetic", redactions: [], policyMatches: [] };
    const sdk = fixtureSdk([session, action, verdict("ALLOW")]);
    let toolCalls = 0;
    const callTool = async () => { toolCalls++; return "tool result"; };
    await loadSnippet("generic-chatbot", "agentCode", "", {
      runAsBody: true, invoke: "runAgentAction(ticketPayload)", ticketPayload: "synthetic ticket", callTool,
      modules: {
        "@soterai/core": { ...sdk, createAgentFirewallClient: (options: ClientOptions) => createAgentFirewallClient({ ...options, fetch: sdk.fetch }) },
        "./tools": { callTool },
      },
    });
    assert.equal(toolCalls, decision === "ALLOW" ? 1 : 0, `${decision} must not authorize an unrestricted write`);
  }
});

test("generic-chatbot: tool output denial and action-check failure never release original output", async () => {
  for (const failure of ["output", "action"] as const) {
    const responses = failure === "output"
      ? [{ sessionId: "synthetic-session" }, { decision: "ALLOW" }, verdict("BLOCK")]
      : [{ sessionId: "synthetic-session" }, new Error("SYNTHETIC_AGENT_PRIVATE")];
    const sdk = fixtureSdk(responses);
    let toolCalls = 0;
    const callTool = async () => { toolCalls++; return "SYNTHETIC_AGENT_PRIVATE"; };
    const result = await loadSnippet("generic-chatbot", "agentCode", "", {
      runAsBody: true, invoke: "runAgentAction(ticketPayload)", ticketPayload: "synthetic ticket", callTool,
      modules: {
        "@soterai/core": { ...sdk, createAgentFirewallClient: (options: ClientOptions) => createAgentFirewallClient({ ...options, fetch: sdk.fetch }) },
        "./tools": { callTool },
      },
    });
    assert.equal(JSON.stringify(result).includes("SYNTHETIC_AGENT_PRIVATE"), false);
    assert.equal(result.blocked, true);
    assert.equal(toolCalls, failure === "output" ? 1 : 0);
  }
});

test("rag: TypeScript example abstains when no retrieved source is eligible", async () => {
  const sdk = fixtureSdk([verdict("ALLOW_WITH_REDACTION", "safe query"), verdict("BLOCK"), verdict("ALLOW")]);
  const docs = [{ id: "synthetic-doc", pageContent: "untrusted chunk", metadata: { url: "https://example.test/doc" } }];
  let modelCalls = 0;
  const vectorStore = { similaritySearch: async (query: string) => { assert.equal(query, "safe query"); return docs; } };
  const ragChain = { invoke: async () => { modelCalls++; return "SYNTHETIC_RAG_RAW"; } };
  const result = await loadSnippet("rag", "tsRagCode", "", {
    runAsBody: true, invoke: "typeof answerRag === 'function' ? answerRag(userQuery, 'trusted-principal') : result",
    userQuery: "original query", vectorStore, ragChain,
    modules: { "@soterai/core": sdk, "./rag": { retrieveAuthorized: vectorStore.similaritySearch, generateAnswer: ragChain.invoke } },
  });
  assert.equal(modelCalls, 0, "empty approved context must not fall through to the provider");
  assert.equal(result.blocked, true);
  assert.equal(JSON.stringify(result).includes("untrusted chunk"), false);
});

const ragProbe = String.raw`
import json, os, sys, types
from pathlib import Path
payload = json.load(sys.stdin)
sys.path.insert(0, str(Path(payload["root"]) / "packages/python-sdk"))
os.environ["SOTER_API_KEY"] = "synthetic-test-key"
import requests, soter
RealSoter = soter.Soter
private = "SYNTHETIC_RAG_PRIVATE"
name = payload["name"]
model_calls, events = [], []
mode = "empty"

class Session:
    def post(self, url, *, json, headers, timeout):
        events.append(url.rsplit("/", 1)[-1])
        if mode == "unavailable": raise requests.ConnectionError(private)
        action = "BLOCK" if (mode == "empty" and url.endswith("/analyze")) or (mode == "output-block" and url.endswith("/output")) else "ALLOW_WITH_REDACTION"
        result = {"allowed": action != "BLOCK", "action": action, "riskScore": 0, "riskTypes": [], "reason": "synthetic", "findings": []}
        if action != "BLOCK": result["safeText"] = "safe output" if url.endswith("/output") else "safe query" if url.endswith("/input") else "safe chunk"
        else: result["findings"] = [{"type": "SECRET_DETECTED", "matched": private, "message": private}]
        return types.SimpleNamespace(status_code=200, text=__import__("json").dumps(result), headers={})
class TestSoter(RealSoter):
    def __init__(self, *args, **kwargs): super().__init__(*args, **{**kwargs, "session": Session()})
soter.Soter = TestSoter
class Chain:
    def invoke(self, value, config=None):
        model_calls.append(value); events.append("model")
        return private
class Engine:
    def query(self, query):
        model_calls.append(query); events.append("model")
        return types.SimpleNamespace(response=private, source_nodes=[types.SimpleNamespace(text="untrusted chunk")])
def retrieve_authorized(query, principal_id):
    assert principal_id == "trusted-principal"
    assert query == "safe query"
    return [{"id": "synthetic-doc", "text": "untrusted chunk", "url": "https://example.test/doc"}]
def generate_answer(query, context):
    model_calls.append((query, context)); events.append("model")
    return private
app_rag = types.ModuleType("your_app.rag")
app_rag.my_chain, app_rag.query_engine = Chain(), Engine()
app_rag.retrieve_authorized, app_rag.generate_answer = retrieve_authorized, generate_answer
sys.modules["your_app"] = types.ModuleType("your_app")
sys.modules["your_app.rag"] = app_rag
modes = ("empty", "unavailable", "output-block", "redacted") if name == "ragCode" else ("unavailable", "output-block", "redacted")
for mode in modes:
    model_calls.clear(); events.clear()
    namespace = {"my_chain": Chain(), "my_llm_chain": Chain(), "query_engine": Engine()}
    exec(compile(payload["code"], name + ".published.py", "exec"), namespace)
    if name == "ragCode" and "answer_rag" in namespace:
        result = namespace["answer_rag"]("original query", "trusted-principal")
    elif name == "langchainCode" and "ask_chain" in namespace:
        result = namespace["ask_chain"]("original query")
    elif name == "llamaindexCode" and "ask_index" in namespace:
        result = namespace["ask_index"]("original query")
    else:
        result = namespace.get("result")
    if mode == "empty":
        assert not model_calls, "provider ran with no eligible context"
    if mode == "unavailable": assert not model_calls
    assert isinstance(result, dict), "publish an application response, not a complete SDK result"
    assert private not in json.dumps(result), result
    assert result["blocked"] is (mode != "redacted"), result
    if mode == "redacted": assert result["reply"] == "safe output", result
    if name == "llamaindexCode" and mode == "redacted":
        assert events.index("model") < events.index("analyze"), events
    print(json.dumps({"mode": mode, "models": len(model_calls), "events": events}))
print("RAG_PUBLISHED_EXAMPLE_PASS")
`;

for (const name of ["ragCode", "langchainCode", "llamaindexCode"]) {
  test(`rag: ${name} exercises real SDK orchestration and exposes only the application response`, () => {
    const child = spawnSync(process.env.DOCS_PYTHON ?? "python", ["-c", ragProbe], {
      encoding: "utf8", input: JSON.stringify({ root: process.cwd(), name, code: snippet("rag", name) }),
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }, timeout: 30000,
    });
    console.info(child.stdout);
    assert.equal(child.status, 0, child.stderr || child.error?.message || "Python RAG probe failed");
    assert.match(child.stdout, /RAG_PUBLISHED_EXAMPLE_PASS/);
  });
}

test("cli: documented local help command matches the real binary and dispatcher without scaffolding", async () => {
  // Published package dist is absent in this checkout. Exercise the exact source
  // dispatcher declarations instead; no broker, token, vault or filesystem IO.
  const runFile = path.join(process.cwd(), "packages/soterai-cli/src/run.ts");
  const runBytes = readFileSync(runFile);
  console.info(`CONSUMED ${runFile} sha256=${createHash("sha256").update(runBytes).digest("hex")} declarations=HELP,parseArgs,run`);
  const ast = ts.createSourceFile(runFile, runBytes.toString("utf8"), ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter((node) =>
    (ts.isFunctionDeclaration(node) && ["parseArgs", "run"].includes(node.name?.text ?? "")) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some((decl) => decl.name.getText(ast) === "HELP")),
  );
  assert.equal(declarations.length, 3);
  const { DEFAULT_BROKER_URL } = await import("../packages/ide-protocol/src/broker");
  const compiled = ts.transpileModule(declarations.map((node) => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports: { run?: (args: string[], deps: unknown) => Promise<number> } = {};
  new Script(compiled.outputText).runInNewContext({ exports, DEFAULT_BROKER_URL });
  const run = exports.run!;
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "packages/soterai-cli/package.json"), "utf8"));
  const lines: string[] = [];
  const errors: string[] = [];
  const dependencies = new Proxy({ out: (line: string) => lines.push(line), err: (line: string) => errors.push(line) }, {
    get(target, key) {
      if (key in target) return target[key as keyof typeof target];
      throw new Error(`Unexpected CLI side effect: ${String(key)}`);
    },
  });
  const command = snippet("cli", "localCliCode").split("\n").find((line) => line.trim() && !line.trim().startsWith("#"))!.trim().split(/\s+/);
  assert.ok(command[0] in manifest.bin);
  assert.equal(await run(command.slice(1), dependencies as Parameters<typeof run>[1]), 0);
  assert.match(lines.join("\n"), /soterai scan file/);
  assert.equal(await run(["init"], dependencies as Parameters<typeof run>[1]), 2);
  assert.match(errors.join("\n"), /Unknown command: init/);
  const page = readFileSync(path.join(root, "app/docs/cli/page.tsx"), "utf8");
  assert.match(page, /@soterai\/cli/);
  assert.match(page, /not implemented/);
  assert.doesNotMatch(page, /less than 2 minutes|two minutes|takes.*2 minutes/i);
});




