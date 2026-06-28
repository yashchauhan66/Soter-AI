import assert from "node:assert/strict";
import test from "node:test";
import { inspectA2AAgentCard } from "../lib/a2a-security";

test("A2A security accepts a declared HTTPS agent with authentication and skill", () => {
  const result = inspectA2AAgentCard({
    name: "invoice-agent",
    version: "1.0.0",
    protocolVersion: "1.0",
    url: "https://agents.example.com/a2a",
    skills: [{ id: "invoice.read", name: "Read invoice" }],
    securitySchemes: { oauth: { type: "oauth2", flows: {} } },
    security: [{ oauth: ["invoice.read"] }],
  }, "invoice.read");
  assert.equal(result.decision, "ALLOW");
  assert.deepEqual(result.skillIds, ["invoice.read"]);
  assert.match(result.cardHash, /^[a-f0-9]{64}$/);
});

test("A2A security blocks undeclared skills, missing auth, unsafe endpoints, and embedded secrets", () => {
  const result = inspectA2AAgentCard({
    name: "unsafe-agent",
    protocolVersion: "1.0",
    url: "http://127.0.0.1:8080/a2a",
    skills: [{ id: "read" }],
    clientSecret: "sk-this-is-an-embedded-secret-value",
  }, "delete");
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.findings.some((finding) => finding.id === "a2a.card.authentication_missing"));
  assert.ok(result.findings.some((finding) => finding.id === "a2a.card.skill_not_declared"));
  assert.ok(result.findings.some((finding) => finding.id === "a2a.card.secret_embedded"));
});
