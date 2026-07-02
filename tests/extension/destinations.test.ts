import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_AI_DESTINATIONS, isLocalAIUrl, matchAIDestination, urlPatternMatches, type AIDestinationPolicy } from "../../packages/shared/src/ai-destinations";
import { destinationAdapters } from "../../apps/extension/src/adapters";
import { scanText } from "../../packages/detectors/src";
import { redactByDataTypes } from "../../packages/policy-engine/src";
import { agentIdentitySchema } from "../../lib/extension/agentIdentity";
import { authenticateAgentRequest } from "../../app/api/extension/_shared";

const destinations = BUILT_IN_AI_DESTINATIONS.map((destination) => ({ ...destination, organizationId: "org_1" })) as AIDestinationPolicy[];

test("destination matching covers public and browser coding platforms", () => {
  assert.equal(matchAIDestination("https://chatgpt.com/c/1", destinations)?.destinationId, "chatgpt");
  assert.equal(matchAIDestination("https://project.stackblitz.com/edit", destinations)?.destinationId, "stackblitz");
  assert.equal(matchAIDestination("https://workspace.github.dev/", destinations)?.destinationId, "github-codespaces");
});

test("localhost and private LAN URLs match configured local AI patterns", () => {
  assert.equal(isLocalAIUrl("http://localhost:11434/api/generate"), true);
  assert.equal(isLocalAIUrl("http://127.0.0.1:1234/v1/chat/completions"), true);
  assert.equal(isLocalAIUrl("http://0.0.0.0:7860/"), true);
  assert.equal(isLocalAIUrl("http://192.168.1.44:3000/"), true);
  assert.equal(isLocalAIUrl("https://example.com/"), false);
});

test("custom wildcard URL patterns respect scheme, port, and path", () => {
  assert.equal(urlPatternMatches(new URL("http://localhost:17321/ollama/api/generate"), "http://localhost:17321/ollama/*"), true);
  assert.equal(urlPatternMatches(new URL("http://localhost:11434/api/generate"), "http://localhost:17321/ollama/*"), false);
  const custom: AIDestinationPolicy = { ...destinations[0], id: "custom", destinationId: "custom-local", domains: [], urlPatterns: ["http://192.168.*/*"], category: "custom" };
  assert.equal(matchAIDestination("http://192.168.2.9:8080/chat", [custom])?.destinationId, "custom-local");
});

test("department and role scoping prevents unauthorized destination activation", () => {
  const scoped: AIDestinationPolicy = { ...destinations[0], allowedDepartments: ["Engineering"], allowedRoles: ["Developer"] };
  assert.equal(matchAIDestination("https://chatgpt.com/", [scoped], "Engineering", "Developer")?.destinationId, "chatgpt");
  assert.equal(matchAIDestination("https://chatgpt.com/", [scoped], "Finance", "Developer"), undefined);
});

test("coding adapters and generic fallback are registered", () => {
  const adapters = destinationAdapters();
  assert.equal(adapters.find((adapter) => adapter.matches("https://replit.com/@team/app"))?.name, "replit");
  assert.equal(adapters.find((adapter) => adapter.matches("https://bolt.new/"))?.name, "bolt");
  assert.equal(adapters.at(-1)?.name, "generic-ai-chat");
});

test("source code, env files, API keys, and production logs are detected", () => {
  const source = scanText("export function auth() {\n const token = getToken();\n return token;\n}");
  const env = scanText(".env\nAPI_KEY=abcdefghijklmnop\nDATABASE_HOST=prod-db\nDATABASE_USER=admin\n");
  const logs = scanText("production error: customer lookup failed\n    at /srv/private/app.js:12:3 from 192.168.1.8");
  assert.ok(source.detectedDataTypes.includes("source_code"));
  assert.ok(env.detectedDataTypes.includes("env_file"));
  assert.ok(env.detectedDataTypes.includes("api_key"));
  assert.ok(logs.detectedDataTypes.includes("production_logs"));
  const redacted = redactByDataTypes(logs.findings.map((finding) => finding.match).join(" ") + " /srv/private/app.js 192.168.1.8", ["production_logs"]);
  assert.equal(redacted.includes("192.168.1.8"), false);
  assert.equal(redacted.includes("/srv/private/app.js"), false);
});

test("local agent heartbeat identity accepts supported transparent device types", () => {
  const heartbeat = agentIdentitySchema.parse({ organizationId: "org_1", employeeId: "emp_1", deviceId: "device_1", type: "local_agent", version: "0.1.0", platform: "windows" });
  assert.equal(heartbeat.type, "local_agent");
  assert.throws(() => agentIdentitySchema.parse({ ...heartbeat, type: "hidden_interceptor" }));
});

test("unauthorized agent policy access is rejected", async () => {
  const previous = process.env.SOTER_AGENT_DEVICE_TOKEN;
  process.env.SOTER_AGENT_DEVICE_TOKEN = "expected-device-token";
  try {
    const result = await authenticateAgentRequest(new Request("http://localhost/api/agent/policy"), "org_1");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 401);
  } finally {
    if (previous === undefined) delete process.env.SOTER_AGENT_DEVICE_TOKEN;
    else process.env.SOTER_AGENT_DEVICE_TOKEN = previous;
  }
});
