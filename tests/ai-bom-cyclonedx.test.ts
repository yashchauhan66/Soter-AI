import assert from "node:assert/strict";
import test from "node:test";
import { exportAiBomCycloneDx, generateAiBillOfMaterialsSnapshot } from "../lib/supply-chain";

test("AI-BOM exports a CycloneDX 1.6 document without raw system prompts", () => {
  const rawPrompt = "Secret internal system prompt that must not be exported";
  const snapshot = generateAiBillOfMaterialsSnapshot({
    organizationId: "org-1",
    projectId: "project-1",
    provider: { name: "Example AI", status: "APPROVED", riskLevel: "LOW" },
    model: { name: "example-model", version: "1.0", riskLevel: "LOW" },
    systemPrompt: rawPrompt,
    promptVersion: 3,
    guardPolicyVersion: 7,
    tools: [{ name: "crm.read", category: "READ_ONLY", enabled: true, approved: true }],
    secretStoreProvider: "kms",
  });
  const exported = exportAiBomCycloneDx({ organizationId: "org-1", projectId: "project-1", snapshot });
  assert.equal(exported.bom.bomFormat, "CycloneDX");
  assert.equal(exported.bom.specVersion, "1.6");
  assert.ok(exported.bom.components.some((component) => component.type === "machine-learning-model"));
  assert.equal(JSON.stringify(exported).includes(rawPrompt), false);
  assert.match(exported.contentHash, /^[a-f0-9]{64}$/);
});
