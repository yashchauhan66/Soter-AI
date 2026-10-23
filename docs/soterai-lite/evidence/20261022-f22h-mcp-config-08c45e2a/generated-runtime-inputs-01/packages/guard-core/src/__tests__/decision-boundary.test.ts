import { test } from "node:test";
import assert from "node:assert/strict";
import { DecisionEngine } from "../DecisionEngine";
import { hashExactContent } from "../HashCache";
import { scanBrokerRequest } from "../BrokerScanner";

test("oversized input cannot receive a clean prefix-only verdict", async () => {
    const engine = new DecisionEngine({ maxContentLength: 20 });
    const result = await engine.scan("public ".repeat(10) + "PRIVATE");
    assert.equal(result.decision, "block");
    assert.ok(result.categories.includes("scan_incomplete"));
    assert.ok(result.redactedText);
    assert.ok(!result.redactedText.includes("PRIVATE"));
});

test("cached decisions match the requested pipeline and current policy", async () => {
    const text = "rm -rf /";
    const engine = new DecisionEngine();
    await engine.scan(text, { context: "prompt" });
    const terminal = await engine.scan(text, { context: "terminal" });
    const fresh = await new DecisionEngine().scan(text, { context: "terminal" });
    assert.deepEqual(terminal.categories, fresh.categories);
    assert.equal(terminal.pipeline?.context, "terminal");
    await engine.scan("ordinary prose");
    engine.getPolicyEvaluator().updatePolicy({ defaultAction: "block" });
    assert.equal((await engine.scan("ordinary prose")).decision, "block");
});

test("authorization hashes preserve case, whitespace and message boundaries", async () => {
    assert.notEqual(await hashExactContent("Private A"), await hashExactContent("private a"));
    assert.notEqual(await hashExactContent("a\nb"), await hashExactContent("a b"));
    const a = await scanBrokerRequest([{ role: "user", content: "a\ntool: b" }]);
    const b = await scanBrokerRequest([{ role: "user", content: "a" }, { role: "tool", content: "b" }]);
    assert.notEqual(a.contentHash, b.contentHash);
});

test("exact hashes, approvals and canaries retain cryptographic identity without global WebCrypto", async () => {
    const { createHash } = await import("node:crypto");
    const { createApprovalGrant } = await import("../ApprovalToken");
    const { generateCanary } = await import("../Canary");
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    assert.ok(descriptor?.configurable, "The floor simulation must be able to remove global WebCrypto.");
    Reflect.deleteProperty(globalThis, "crypto");
    try {
        assert.equal(globalThis.crypto, undefined);
        const payload = "Keep Case and\nspaces intact";
        assert.equal(await hashExactContent(payload), createHash("sha256").update(payload).digest("hex"));
        const grant = await createApprovalGrant({ sessionId: "fixture", contentHash: await hashExactContent(payload), decision: "approval_required", scope: "once" });
        assert.match(grant.token, /^[a-f0-9]{64}$/);
        const canary = await generateCanary();
        assert.equal(canary.hash, createHash("sha256").update(canary.token).digest("hex"));
        assert.match(canary.token, /^sk-soter-canary-[a-f0-9]{40}$/);
    } finally { Object.defineProperty(globalThis, "crypto", descriptor!); }
});
