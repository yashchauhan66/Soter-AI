import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSecurePlan, KNOWN_AI_TOOLS } from "../broker/AutoSecureEngine";
test("F19 legacy generic Claude env rewriting refuses unpinned routing and drops full-redaction claims", () => {
    const spec = KNOWN_AI_TOOLS.find(tool => tool.id === "claude-code")!;
    const file = "/synthetic/.claude/settings.json", before = '{"baseURL":"https://provider.invalid/v1"}';
    const plan = buildSecurePlan([{ spec, status: "found", configs: [{ kind: "anthropic-compatible", path: file, exists: true, notes: [] }] }], { [file]: before }, 12345);
    assert.equal(plan.proposed.length, 0); assert.ok(plan.unsupported.some(item => item.toolId === "claude-code")); assert.doesNotMatch(spec.coverageNote, /full redaction/i);
});
