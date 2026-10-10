import assert from "node:assert/strict";
import test from "node:test";
import { NodeHelpers, Workflow } from "n8n-workflow";
import type { IExecuteFunctions, INode, INodeProperties, INodePropertyCollection, NodeParameterValueType } from "n8n-workflow";

import { SoterGuard } from "../nodes/SoterGuard/SoterGuard.node";
import { OPERATIONS } from "../nodes/SoterGuard/shared/layoutV3";
import { withV3ParameterLayout } from "../nodes/SoterGuard/shared/parameterLayout";
import { soterGuardHintsV3, soterGuardOutputsV3, soterGuardSubtitleV3 } from "../nodes/SoterGuard/v3/SoterGuardV3";
import { soterGuardOutputs as soterGuardOutputsV2 } from "../nodes/SoterGuard/v2/SoterGuardV2";
import { makeCtx } from "./helpers";

const type = NodeHelpers.getVersionedNodeType(new SoterGuard(), 3);
const description = type.description;
const samples = {
  inputText: "Hello, I need help with an order", outputText: "Your order ships tomorrow",
  universalOutputText: "Your order ships tomorrow", piiText: "Contact alex@example.com",
  ragText: "Product documentation", documentId: "ux-document", documentSource: "api",
  workflowJson: '{"nodes":[],"connections":{}}', agentName: "UX Test Agent",
  agentIdentityId: "ux-identity", toolName: "filesystem.read", toolAction: "read",
  sessionId: "ux-session", passportToken: "ux-invalid-test-token",
};

function normalizedNode(operation: string, extra: Record<string, unknown> = {}): INode {
  const spec = OPERATIONS.find((entry) => entry.value === operation)!;
  const parameters = { resource: spec.resource, operation, ...samples, ...extra };
  return {
    id: "panel-ux", name: "SoterAI", type: "n8n-nodes-soterai.soterGuard", typeVersion: 3, position: [0, 0],
    parameters: NodeHelpers.getNodeParameters(description.properties, parameters, true, false, { typeVersion: 3 }, description)!,
  };
}

function resolve(expression: string, parameters: Record<string, unknown>, version = 3): unknown {
  const node = { id: "expressions", name: "SoterAI", type: "n8n-nodes-soterai.soterGuard", typeVersion: version, position: [0, 0], parameters } as INode;
  const workflow = new Workflow({ nodes: [node], connections: {}, active: false, nodeTypes: { getByNameAndVersion: () => NodeHelpers.getVersionedNodeType(new SoterGuard(), version), getByName: () => new SoterGuard(), getKnownTypes: () => ({}) } });
  return workflow.expression.getComplexParameterValue(node, expression, "manual", {});
}

function shown(node: INode): INodeProperties[] {
  return description.properties.filter((property) => NodeHelpers.displayParameter(node.parameters, property, node, description));
}

test("every operation has valid native defaults, unique controls, and an engine before content", () => {
  for (const spec of OPERATIONS) {
    const node = normalizedNode(spec.value);
    assert.equal(NodeHelpers.getNodeParametersIssues(description.properties, node, description), null, spec.value);
    const visible = shown(node);
    const controls = visible.filter((field) => field.type !== "notice");
    assert.equal(new Set(controls.map((field) => field.name)).size, controls.length, spec.value);
    const options = controls.find((field) => field.name === "options")?.options as INodeProperties[] | undefined;
    const all = [...controls.filter((field) => field.name !== "options"), ...(options ?? [])];
    assert.equal(new Set(all.map((field) => field.name)).size, all.length, `${spec.value}: duplicate panel / option control`);
    if (spec.value !== "workflowAudit") assert.equal(controls[2].name, "detectionEngine", spec.value);
    for (const option of options ?? []) {
      assert.equal(option.required, undefined);
      assert.equal(option.displayOptions, undefined);
    }
  }
});

test("all nested dropdown defaults exist and numeric defaults stay within the editor bounds", () => {
  function check(properties: INodeProperties[]) {
    for (const field of properties) {
      if (field.type === "options") {
        const values = (field.options ?? []).filter((entry) => "value" in entry).map((entry) => (entry as { value: unknown }).value);
        assert.ok(values.includes(field.default), `${field.name}: default absent from dropdown`);
      }
      if (field.type === "number") {
        assert.ok(typeof field.default === "number");
        if (field.typeOptions?.minValue !== undefined) assert.ok(field.default >= field.typeOptions.minValue, field.name);
        if (field.typeOptions?.maxValue !== undefined) assert.ok(field.default <= field.typeOptions.maxValue, field.name);
      }
      if (field.type === "json" && typeof field.default === "string" && !field.default.startsWith("=")) {
        assert.doesNotThrow(() => JSON.parse(field.default as string), `${field.name}: invalid JSON default`);
      }
      if (field.type === "collection") check(field.options as INodeProperties[]);
      if (field.type === "fixedCollection") {
        for (const group of field.options as INodePropertyCollection[]) check(group.values);
      }
    }
  }
  check(description.properties);
});

test("n8n accepts an output-only firewall and still reports missing mandatory fields elsewhere", () => {
  const outputOnly = normalizedNode("universalGuard", { inputText: "" });
  assert.equal(NodeHelpers.getNodeParametersIssues(description.properties, outputOnly, description), null);
  for (const [operation, name] of [["inputGuard", "inputText"], ["outputGuard", "outputText"], ["ragScanner", "documentId"], ["toolCall", "toolAction"], ["issuePassport", "agentIdentityId"]]) {
    const node = normalizedNode(operation, { [name]: "" });
    assert.ok(NodeHelpers.getNodeParametersIssues(description.properties, node, description)?.parameters?.[name], `${operation}: missing ${name} was accepted`);
  }
});

test("every hint, subtitle, and output expression runs in n8n's expression engine across all engines", () => {
  for (const spec of OPERATIONS) {
    for (const engine of ["AUTO", "CLOUD", "LOCAL"]) {
      const node = normalizedNode(spec.value, { detectionEngine: engine });
      for (const hint of soterGuardHintsV3) assert.equal(typeof resolve(String(hint.displayCondition), node.parameters), "boolean", hint.message);
      assert.equal(typeof resolve(soterGuardSubtitleV3, node.parameters), "string");
      assert.ok(Array.isArray(resolve(soterGuardOutputsV3, node.parameters)));
    }
  }
});

test("native output labels match runtime boolean handling for imported redaction settings", async () => {
  for (const value of [false, true, "false", "true", 0, 1, null]) {
    const parameters = { operation: "piiRedactor", options: { branchOnRedaction: value } };
    const outputs = resolve(soterGuardOutputsV3, parameters) as unknown[];
    const { ctx } = makeCtx({ action: "piiRedactor", layout: "v3", items: 0, params: parameters });
    const actual = await type.execute!.call(ctx as unknown as IExecuteFunctions);
    assert.ok(Array.isArray(actual));
    assert.equal(outputs.length, actual.length, `branchOnRedaction=${JSON.stringify(value)}`);
    const v2params = { action: "piiRedactor", advancedOptions: { branchOnRedaction: value } };
    const v2outputs = resolve(soterGuardOutputsV2, v2params, 2) as unknown[];
    const v2type = NodeHelpers.getVersionedNodeType(new SoterGuard(), 2);
    const v2ctx = makeCtx({ action: "piiRedactor", typeVersion: 2, items: 0, params: v2params }).ctx;
    const v2actual = await v2type.execute!.call(v2ctx as unknown as IExecuteFunctions);
    assert.ok(Array.isArray(v2actual));
    assert.equal(v2outputs.length, v2actual.length, `v2 branchOnRedaction=${JSON.stringify(value)}`);
  }
});

test("engine precedence, lifecycle simulation hints, and empty custom policy guidance stay consistent", () => {
  const localHint = soterGuardHintsV3.find((hint) => hint.message.startsWith("<b>Local rules"))!;
  const simulation = soterGuardHintsV3.find((hint) => hint.message.startsWith("<b>Local simulation"))!;
  const params = { operation: "inputGuard", detectionEngine: "CLOUD", options: { detectionEngine: "LOCAL" } };
  assert.equal(resolve(String(localHint.displayCondition), params), false);
  assert.doesNotMatch(String(resolve(soterGuardSubtitleV3, params)), /local/);
  for (const operation of ["enrollIdentity", "issuePassport", "validatePassport", "revokePassport"]) {
    assert.equal(resolve(String(simulation.displayCondition), { operation, detectionEngine: "LOCAL" }), true);
    assert.match(String(resolve(soterGuardSubtitleV3, { operation, detectionEngine: "LOCAL" })), /local simulation/);
    assert.equal(resolve(String(simulation.displayCondition), { operation, detectionEngine: "AUTO" }), false);
  }
  const custom = soterGuardHintsV3.at(-1)!;
  for (const policy of ["", " ", "{}", {}, "[]", "null", '{"allowedTools":[]}', '{"unrecognized":["*"]}', "bad json"]) {
    assert.equal(resolve(String(custom.displayCondition), { operation: "issuePassport", passportPolicyPreset: "CUSTOM", options: { passportPolicy: policy } }), true);
  }
  const protectedSources = soterGuardHintsV3.find((hint) => hint.message.startsWith("Local mode can only compare"))!;
  for (const sources of [undefined, "", "[]", [], "bad json"]) {
    assert.equal(resolve(String(protectedSources.displayCondition), { operation: "universalGuard", detectionEngine: "LOCAL", securityContext: { output: { protectedSources: sources } } }), false);
  }
  for (const sources of ['[{"sourceId":"crm"}]', [{ sourceId: "crm", content: "private content" }]]) {
    assert.equal(resolve(String(protectedSources.displayCondition), { operation: "universalGuard", detectionEngine: "LOCAL", securityContext: { output: { protectedSources: sources } } }), true);
  }
});

// These execute native-default-filled parameters and real n8n expressions,
// rather than supplying the defaults assumed by the lightweight test helper.
for (const spec of OPERATIONS) {
  for (const engine of ["AUTO", "CLOUD", "LOCAL"]) {
    test(`native parameters execute ${spec.value} with ${engine}`, async () => {
      const node = normalizedNode(spec.value, { detectionEngine: engine });
      const { ctx } = makeCtx({
        action: spec.value, layout: "v3", params: node.parameters,
        credentials: engine === "LOCAL" || spec.value === "workflowAudit" ? null : undefined,
        respond: () => ({ body: { allowed: true, valid: true, action: "ALLOW", decision: "ALLOW", riskScore: 0, riskTypes: ["LOW_RISK"], findings: [], agentIdentityId: "ux-identity", passportId: "ux-passport", passportToken: "ux-issued-test-token", sessionId: "ux-session", status: "ACTIVE", expiresAt: "2030-01-01T00:00:00.000Z", revoked: true } }),
      });
      const result = await type.execute!.call(ctx as unknown as IExecuteFunctions);
      assert.ok(Array.isArray(result));
      const items = result.flat();
      assert.equal(items.length, 1, spec.value);
      assert.equal(items[0].json.engine, spec.value === "workflowAudit" || engine === "LOCAL" ? "local" : "cloud");
      assert.equal(items[0].json.error, undefined);
    });
  }
}

test("panel fields and Options resolve per-item expressions through the real n8n workflow evaluator", () => {
  const node = normalizedNode("inputGuard", {
    inputText: "={{ $json.message }}", detectionEngine: "CLOUD",
    options: { sessionId: "={{ $json.session }}", metadata: '={{ { tenant: $json.tenant } }}', requestTimeoutMs: "={{ $json.timeout }}" },
  });
  const workflow = new Workflow({ nodes: [node], connections: {}, active: false, nodeTypes: { getByNameAndVersion: () => type, getByName: () => new SoterGuard(), getKnownTypes: () => ({}) } });
  const input = [
    { json: { message: "First message", session: "session-1", tenant: "acme", timeout: 10000 } },
    { json: { message: "Second message", session: "session-2", tenant: "other", timeout: 20000 } },
  ];
  const { ctx } = makeCtx({ action: "inputGuard", layout: "v3", params: node.parameters });
  ctx.getNodeParameter = (name, itemIndex, fallback) => workflow.expression.getParameterValue(
    (node.parameters[name] ?? fallback) as NodeParameterValueType, null, 0, itemIndex, node.name, input, "manual", {},
  );
  const wrapped = withV3ParameterLayout(ctx as unknown as IExecuteFunctions);
  for (let index = 0; index < input.length; index++) {
    assert.equal(wrapped.getNodeParameter("inputText", index), input[index].json.message);
    assert.equal(wrapped.getNodeParameter("sessionId", index), input[index].json.session);
    assert.deepEqual(wrapped.getNodeParameter("metadata", index), { tenant: input[index].json.tenant });
    const options = wrapped.getNodeParameter("advancedOptions", index) as { requestTimeoutMs: number };
    assert.equal(options.requestTimeoutMs, input[index].json.timeout);
  }
});
