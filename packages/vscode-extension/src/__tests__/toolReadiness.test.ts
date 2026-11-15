import assert from "node:assert/strict";
import { test } from "node:test";
import { toolReadiness } from "../project-journey/ToolReadiness";
import { CLINE_PIN } from "../adapters/ClineAdapterPolicy";
import { CLAUDE_PIN } from "../adapters/ClaudeAdapterPolicy";
test("tool setup distinguishes absent, incompatible and present versions without claiming routing", () => {
    assert.match(toolReadiness("Cline", () => undefined), /Install the owner-reviewed/);
    assert.match(toolReadiness("Cline", () => "0.0.1"), /Review compatibility/);
    assert.match(toolReadiness("Cline", () => CLINE_PIN.version), /live routing is unverified/);
    assert.match(toolReadiness("Claude Code", () => CLAUDE_PIN.version), /Artifact verification/);
    assert.ok(!toolReadiness("Cline", () => "PRIVATE_VERSION_VALUE").includes("PRIVATE_VERSION_VALUE"));
});
