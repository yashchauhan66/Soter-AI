import assert from "node:assert/strict";
import test from "node:test";
import { createAgentDelegationProof, deriveDelegatedPassportPolicy, normalizePassportPolicy } from "../lib/agent-passport";

const parent = normalizePassportPolicy({
  allowedTools: ["rag.search", "browser.read"],
  blockedTools: ["terminal.run"],
  approvalRequiredTools: ["gmail.send"],
  allowedDomains: ["example.com"],
  blockedDomains: ["blocked.example"],
  dataScopes: ["project:read"],
  memoryScopes: ["session"],
});

test("delegated passport can attenuate but never expand parent permissions", () => {
  const safe = deriveDelegatedPassportPolicy(parent, {
    intent: "Search the approved knowledge base",
    allowedTools: ["rag.search"],
    approvalRequiredTools: [],
    allowedDomains: [],
    dataScopes: ["project:read"],
    memoryScopes: ["session"],
  });
  assert.equal(safe.allowed, true);
  assert.deepEqual(safe.policy.allowedTools, ["rag.search"]);
  assert.ok(safe.policy.blockedTools.includes("terminal.run"));

  const expanded = deriveDelegatedPassportPolicy(parent, {
    intent: "Run a command",
    allowedTools: ["terminal.run"],
    dataScopes: ["project:write"],
  });
  assert.equal(expanded.allowed, false);
  assert.ok(expanded.violations.some((violation) => violation.includes("terminal.run")));
  assert.ok(expanded.violations.some((violation) => violation.includes("project:write")));
});

test("delegation proof binds parent, child, session, intent, depth, and policy", () => {
  const delegated = deriveDelegatedPassportPolicy(parent, { intent: "Read documentation", allowedTools: ["browser.read"] });
  const proof = createAgentDelegationProof({ parentPassportId: "parent-1", childAgentIdentityId: "child-1", childSessionId: "session-1", delegationDepth: 1, intentHash: delegated.intentHash, policy: delegated.policy });
  assert.equal(proof.format, "soter.agent-delegation.v1");
  assert.match(proof.intentHash, /^[a-f0-9]{64}$/);
  assert.match(proof.proofHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(proof).includes("Read documentation"), false);
});
