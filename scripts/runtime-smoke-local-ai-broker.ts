import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import assert from "node:assert/strict";
import { BrokerServer } from "../apps/local-ai-broker/src/BrokerServer";
import { generateBrokerToken } from "../apps/local-ai-broker/src/auth";

const providerKey = "synthetic-provider-key-runtime-smoke";

interface ProviderState {
  openAiCalls: number;
  lastOpenAiBody?: Record<string, unknown>;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function startMockProvider(state: ProviderState): Promise<{ url: string; stop: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
        return writeJson(res, 404, { error: { message: "not found" } });
      }
      state.openAiCalls++;
      state.lastOpenAiBody = await readJson(req);

      const auth = req.headers.authorization;
      if (auth !== `Bearer ${providerKey}`) {
        return writeJson(res, 401, { error: { message: "bad provider key" } });
      }

      if (state.openAiCalls === 1) {
        return writeJson(res, 503, { error: { message: "synthetic transient outage" } });
      }

      return writeJson(res, 200, {
        id: "chatcmpl_runtime_smoke",
        model: state.lastOpenAiBody.model ?? "mock-runtime",
        choices: [{ message: { role: "assistant", content: "Runtime smoke provider recovered safely." } }],
      });
    } catch (error) {
      return writeJson(res, 500, { error: { message: error instanceof Error ? error.message : "provider error" } });
    }
  });

  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address !== "object") return reject(new Error("Provider did not expose a TCP port"));
      resolve({
        url: `http://127.0.0.1:${address.port}/v1/chat/completions`,
        stop: () => new Promise<void>((stopResolve, stopReject) => server.close((error) => error ? stopReject(error) : stopResolve())),
      });
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
}

async function brokerRequest(baseUrl: string, endpoint: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${endpoint}`, { ...init, headers });
}

async function main(): Promise<void> {
  const providerState: ProviderState = { openAiCalls: 0 };
  const provider = await startMockProvider(providerState);
  const token = generateBrokerToken();
  const broker = new BrokerServer({
    token,
    port: 0,
    openAIProviderUrl: provider.url,
    providerApiKey: providerKey,
    providerRetryAttempts: 1,
    requestTimeoutMs: 5_000,
  });

  try {
    const { url } = await broker.start();

    const health = await fetch(`${url}/health`);
    assert.equal(health.status, 200, "broker health should be public and healthy");

    const completion = await brokerRequest(url, "/v1/ai/openai-compatible/chat/completions", token, {
      method: "POST",
      body: JSON.stringify({ model: "mock-runtime", messages: [{ role: "user", content: "Say hello safely" }] }),
    });
    const completionBody = await completion.json() as { choices?: Array<{ message?: { content?: string } }> };
    assert.equal(completion.status, 200, "non-streamed completion should recover after provider retry");
    assert.equal(providerState.openAiCalls, 2, "broker should retry the transient 503 exactly once");
    assert.equal(completion.headers.get("x-soterai-response-decision"), "allow");
    assert.equal(completionBody.choices?.[0]?.message?.content, "Runtime smoke provider recovered safely.");

    providerState.openAiCalls = 1;
    const streamed = await brokerRequest(url, "/v1/ai/openai-compatible/chat/completions", token, {
      method: "POST",
      body: JSON.stringify({ model: "mock-runtime", stream: true, messages: [{ role: "user", content: "Stream this safely" }] }),
    });
    const streamText = await streamed.text();
    assert.equal(streamed.status, 200, "buffered stream should succeed");
    assert.equal(streamed.headers.get("content-type")?.startsWith("text/event-stream"), true);
    assert.equal(streamed.headers.get("x-soterai-streaming-mode"), "buffered_scan");
    assert.equal(providerState.lastOpenAiBody?.stream, false, "provider streaming should be disabled while broker scans output");
    assert.match(streamText, /Runtime smoke provider recovered safely\./);
    assert.match(streamText, /data: \[DONE\]/);

    console.log(JSON.stringify({
      ok: true,
      checked: [
        "broker health",
        "real HTTP mock provider retry",
        "non-streamed output scan path",
        "buffered OpenAI-compatible SSE",
      ],
      providerCalls: providerState.openAiCalls,
      streamingMode: streamed.headers.get("x-soterai-streaming-mode"),
    }, null, 2));
  } finally {
    await broker.stop().catch(() => undefined);
    await provider.stop().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Broker runtime smoke failed:", error);
  process.exit(1);
});
