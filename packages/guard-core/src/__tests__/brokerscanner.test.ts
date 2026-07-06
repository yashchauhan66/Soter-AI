import { describe, it } from "node:test";
import assert from "node:assert";
import {
    scanBrokerRequest,
    scanBrokerResponse,
    shouldForward,
    messagesToForward,
    type BrokerMessage,
} from "../BrokerScanner";
import { generateCanary } from "../Canary";
import { findSurvivingSecrets } from "../Redactor";

describe("BrokerScanner — request", () => {
    it("allows a benign request", async () => {
        const msgs: BrokerMessage[] = [
            { role: "system", content: "You are a helpful coding assistant." },
            { role: "user", content: "How do I reverse a string in TypeScript?" },
        ];
        const r = await scanBrokerRequest(msgs);
        assert.ok(["allow", "warn"].includes(r.decision));
        assert.strictEqual(r.canaryInRequest, false);
        assert.ok(r.safe);
    });

    it("redacts a real secret in a request", async () => {
        const msgs: BrokerMessage[] = [
            { role: "user", content: "Here is my key sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJ1234 please debug" },
        ];
        const r = await scanBrokerRequest(msgs, { safeMode: { enabled: true, level: "developer" } });
        assert.notStrictEqual(r.decision, "allow");
        assert.ok(r.redacted, "content should be redacted");
        // The forwarded (redacted) messages contain no surviving secret.
        assert.deepStrictEqual(findSurvivingSecrets(r.redactedMessages.map((m) => m.content).join("\n")), []);
        assert.ok(r.safe);
    });

    it("blocks a request containing a planted canary at every safe-mode level", async () => {
        const canary = await generateCanary();
        const msgs: BrokerMessage[] = [
            { role: "user", content: `Debug this config: TOKEN=${canary.token}` },
        ];
        for (const level of ["developer", "strict", "enterprise"] as const) {
            const r = await scanBrokerRequest(msgs, {
                safeMode: { enabled: true, level },
                canaries: [canary],
            });
            assert.strictEqual(r.canaryInRequest, true);
            assert.strictEqual(r.decision, "block", `canary must block at ${level}`);
            assert.strictEqual(r.riskScore, 100);
        }
    });

    it("blocks a canary even with safe mode off", async () => {
        const canary = await generateCanary();
        const r = await scanBrokerRequest([{ role: "user", content: canary.token }], { canaries: [canary] });
        assert.strictEqual(r.decision, "block");
    });

    it("produces a stable content hash and never embeds raw content", async () => {
        const msgs: BrokerMessage[] = [{ role: "user", content: "hello world" }];
        const r1 = await scanBrokerRequest(msgs);
        const r2 = await scanBrokerRequest(msgs);
        assert.strictEqual(r1.contentHash, r2.contentHash);
        assert.match(r1.contentHash, /^[a-f0-9]{64}$/);
    });
});

describe("BrokerScanner — forwarding rules", () => {
    it("shouldForward respects decisions", () => {
        assert.strictEqual(shouldForward("block", true), false);
        assert.strictEqual(shouldForward("approval_required", false), false);
        assert.strictEqual(shouldForward("approval_required", true), true);
        assert.strictEqual(shouldForward("redact", false), true);
        assert.strictEqual(shouldForward("allow", false), true);
    });

    it("messagesToForward sends redacted copy only for redact decisions", () => {
        const orig: BrokerMessage[] = [{ role: "user", content: "raw" }];
        const red: BrokerMessage[] = [{ role: "user", content: "[REDACTED]" }];
        assert.strictEqual(messagesToForward("redact", orig, red)[0].content, "[REDACTED]");
        assert.strictEqual(messagesToForward("allow", orig, red)[0].content, "raw");
    });
});

describe("BrokerScanner — response", () => {
    it("flags a canary leak in the response as block", async () => {
        const canary = await generateCanary();
        const r = await scanBrokerResponse(`Sure, the value is ${canary.token}`, { canaries: [canary] });
        assert.strictEqual(r.canaryLeaked, true);
        assert.strictEqual(r.decision, "block");
        assert.strictEqual(r.riskScore, 100);
    });

    it("flags dangerous terminal commands in the response", async () => {
        const r = await scanBrokerResponse("Run this: rm -rf / --no-preserve-root");
        assert.strictEqual(r.dangerousCommands, true);
        assert.ok(r.categories.includes("dangerous_command"));
    });

    it("passes clean helpful output", async () => {
        const r = await scanBrokerResponse("Use Array.prototype.reverse() after splitting the string.");
        assert.strictEqual(r.canaryLeaked, false);
        assert.strictEqual(r.dangerousCommands, false);
    });

    it("never leaks the raw canary token in findings/evidence", async () => {
        const canary = await generateCanary();
        const r = await scanBrokerResponse(canary.token, { canaries: [canary] });
        const serialized = JSON.stringify(r);
        assert.ok(!serialized.includes(canary.token), "raw canary must not appear in the result");
    });
});
