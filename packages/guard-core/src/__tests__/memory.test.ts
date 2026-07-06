import { describe, it } from "node:test";
import assert from "node:assert";
import { MemoryStore, sanitizeMemoryEvent, type MemoryEvent } from "../MemorySession";
import { generateCanary } from "../Canary";

function ev(partial: Partial<MemoryEvent>): MemoryEvent {
    return {
        eventId: "e1",
        timestamp: "2026-07-05T00:00:00.000Z",
        kind: "broker_request_scanned",
        source: "broker",
        decision: "allow",
        riskScore: 0,
        categories: [],
        ...partial,
    };
}

describe("MemorySession — sanitizer", () => {
    it("drops raw secrets from evidence", () => {
        const clean = sanitizeMemoryEvent(ev({ redactedEvidence: "leak sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJ1234" }));
        assert.ok(!/sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJ1234/.test(clean.redactedEvidence ?? ""));
    });

    it("never persists a raw canary token", async () => {
        const canary = await generateCanary();
        const clean = sanitizeMemoryEvent(ev({ redactedEvidence: `saw ${canary.token}`, canaryExposed: true }));
        assert.ok(!(clean.redactedEvidence ?? "").includes(canary.token));
    });
});

describe("MemoryStore", () => {
    it("tracks a brokered request and updates aggregates", () => {
        const store = new MemoryStore();
        store.startSession({ sessionId: "s1", source: "broker", tool: "cline", provider: "openai-compatible" });
        store.addEvent("s1", ev({ requestHash: "a".repeat(64), categories: ["email"], decision: "redact", contentSize: 120 }));
        const s = store.getSession("s1")!;
        assert.strictEqual(s.requestHashes.length, 1);
        assert.ok(s.riskCategories.includes("email"));
        assert.strictEqual(s.contentSizeEstimate, 120);
        assert.deepStrictEqual(s.decisions, ["redact"]);
    });

    it("records blocked protected files separately from included files", () => {
        const store = new MemoryStore();
        store.startSession({ sessionId: "s1", source: "safe-context-builder" });
        store.addEvent("s1", ev({ kind: "context_built", filePaths: ["src/app.ts"], decision: "allow" }));
        store.addEvent("s1", ev({ kind: "protected_file_attempted", filePaths: [".env"], decision: "block", protectedFileAttempt: true }));
        const s = store.getSession("s1")!;
        assert.ok(s.filesIncluded.includes("src/app.ts"));
        assert.ok(s.filesBlocked.includes(".env"));
        assert.ok(s.protectedFilesAttempted.includes(".env"));
    });

    it("marks canary exposure", () => {
        const store = new MemoryStore();
        store.addEvent("s1", ev({ kind: "broker_response_leak_detected", canaryExposed: true, decision: "block" }));
        assert.strictEqual(store.getSession("s1")!.canaryExposed, true);
    });

    it("export is redacted and canary-free", async () => {
        const canary = await generateCanary();
        const store = new MemoryStore();
        store.startSession({ sessionId: "s1", source: "broker" });
        store.addEvent("s1", ev({ redactedEvidence: `token ${canary.token}`, canaryExposed: true }));
        const dump = JSON.stringify(store.exportRedacted());
        assert.ok(!dump.includes(canary.token), "export must not contain the raw canary token");
    });

    it("clear removes a session", () => {
        const store = new MemoryStore();
        store.startSession({ sessionId: "s1", source: "broker" });
        store.clearSession("s1");
        assert.strictEqual(store.getSession("s1"), undefined);
    });
});
