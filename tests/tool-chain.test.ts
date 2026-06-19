import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  evaluateToolChainStep,
  sanitizeToolChainMetadata,
  type ToolChainStepInput,
  type ToolChainStepSnapshot,
} from "../lib/tool-chain";

function runChain(inputs: ToolChainStepInput[]) {
  const steps: ToolChainStepSnapshot[] = [];
  let result = evaluateToolChainStep(steps, inputs[0]);
  steps.push(result.step);
  for (const input of inputs.slice(1)) {
    result = evaluateToolChainStep(steps, input);
    steps.push(result.step);
  }
  return result;
}

test("Tool Chain 1: safe read-only chain allows", () => {
  const result = runChain([
    { tool: "browser.read", action: "read public docs", sourceType: "PUBLIC_DATA", destinationType: "INTERNAL", dataSensitivity: "PUBLIC" },
  ]);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.riskLevel, "LOW");
});

test("Tool Chain 2: private data read plus external email blocks", () => {
  const result = runChain([
    { tool: "crm.read", action: "read private CRM customer data", sourceType: "PRIVATE_DATA", destinationType: "INTERNAL", dataSensitivity: "PRIVATE" },
    { tool: "gmail.send", action: "send email to external recipient", sourceType: "PRIVATE_DATA", destinationType: "EXTERNAL_EMAIL", dataSensitivity: "PRIVATE" },
  ]);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.findings[0]?.findingType, "DATA_EXFILTRATION_CHAIN");
});

test("Tool Chain 3: confidential RAG plus unknown MCP tool blocks", () => {
  const result = runChain([
    { tool: "rag.retrieve", action: "retrieve confidential policy doc", sourceType: "RAG_CONFIDENTIAL", destinationType: "INTERNAL", dataSensitivity: "CONFIDENTIAL" },
    { tool: "mcp.unknown", action: "call unknown tool", sourceType: "MCP_TOOL", destinationType: "UNKNOWN_TOOL", dataSensitivity: "CONFIDENTIAL" },
  ]);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.findings.some((finding) => finding.findingType === "RAG_TO_EXTERNAL"), true);
});

test("Tool Chain 4: memory read plus external post blocks", () => {
  const result = runChain([
    { tool: "memory.read", action: "read project memory", sourceType: "MEMORY", destinationType: "INTERNAL", dataSensitivity: "PRIVATE" },
    { tool: "api.call", action: "post to external api", sourceType: "MEMORY", destinationType: "EXTERNAL_POST", dataSensitivity: "PRIVATE" },
  ]);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.findings.some((finding) => finding.findingType === "MEMORY_TO_EGRESS"), true);
});

test("Tool Chain 5: file read plus email send asks approval or blocks", () => {
  const result = runChain([
    { tool: "filesystem.read", action: "read workspace file", sourceType: "FILE", destinationType: "INTERNAL", dataSensitivity: "INTERNAL" },
    { tool: "gmail.send", action: "send email", sourceType: "FILE", destinationType: "EXTERNAL_EMAIL", dataSensitivity: "INTERNAL" },
  ]);
  assert.match(result.decision, /ASK_APPROVAL|BLOCK/);
  assert.equal(result.findings.some((finding) => finding.findingType === "DATA_EXFILTRATION_CHAIN"), true);
});

test("Tool Chain 6: terminal plus network post is critical block", () => {
  const result = runChain([
    { tool: "terminal.run", action: "execute command", sourceType: "TERMINAL", destinationType: "INTERNAL", dataSensitivity: "INTERNAL" },
    { tool: "curl", action: "http post to remote", sourceType: "TERMINAL", destinationType: "NETWORK_POST", dataSensitivity: "INTERNAL" },
  ]);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.riskLevel, "CRITICAL");
});

test("Tool Chain 7: system prompt to output blocks", () => {
  const result = runChain([
    { tool: "context.read", action: "inspect system prompt", sourceType: "SYSTEM_PROMPT", destinationType: "INTERNAL", dataSensitivity: "SYSTEM_PROMPT" },
    { tool: "agent.output", action: "respond with final output", sourceType: "SYSTEM_PROMPT", destinationType: "FINAL_OUTPUT", dataSensitivity: "SYSTEM_PROMPT" },
  ]);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.findings[0]?.findingType, "SECRET_TO_OUTPUT");
});

test("Tool Chain 8: suspicious untrusted browser page to tool call creates finding", () => {
  const result = runChain([
    { tool: "browser.read", action: "read untrusted page", sourceType: "BROWSER_PAGE_UNTRUSTED", destinationType: "INTERNAL", dataSensitivity: "PUBLIC" },
    { tool: "calendar.create", action: "invoke tool from page content", sourceType: "BROWSER_PAGE_UNTRUSTED", destinationType: "TOOL_CALL", dataSensitivity: "PUBLIC" },
  ]);
  assert.equal(result.decision, "REVIEW");
  assert.equal(result.findings.some((finding) => finding.findingType === "TOOL_POISONING_CHAIN"), true);
});

test("Tool Chain 9: cross-project access is denied by scoped SQL", () => {
  const source = readFileSync("lib/tool-chain/server.ts", "utf8");
  assert.match(source, /WHERE "projectId" = \$\{projectId\} AND "sessionId" = \$\{sessionId\}/);
  assert.match(source, /WHERE "projectId" = \$\{auth\.project\.id\}/);
});

test("Tool Chain 10: dashboard and API routes exist", () => {
  assert.equal(existsSync("app/dashboard/tool-chain/page.tsx"), true);
  assert.equal(existsSync("app/api/tool-chain/session/start/route.ts"), true);
  assert.equal(existsSync("app/api/tool-chain/step/check/route.ts"), true);
  assert.equal(existsSync("app/api/tool-chain/session/[sessionId]/route.ts"), true);
  assert.equal(existsSync("app/api/tool-chain/findings/route.ts"), true);
});

test("Tool Chain 11: metadata sanitizer strips raw secrets", () => {
  const safe = sanitizeToolChainMetadata({
    apiKey: "sk-proj-abcdefghijklmnopqrstuvwxyz123456",
    note: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
  });
  assert.equal("apiKey" in safe, false);
  assert.equal(String(safe.note).includes("sk-proj-abcdefghijklmnopqrstuvwxyz123456"), false);
});

test("Tool Chain 12: existing guard API route files remain present", () => {
  assert.equal(existsSync("app/api/guard/input/route.ts"), true);
  assert.equal(existsSync("app/api/guard/output/route.ts"), true);
  assert.equal(existsSync("app/api/guard/analyze/route.ts"), true);
});
