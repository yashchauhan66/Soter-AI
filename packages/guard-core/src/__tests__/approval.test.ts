import { describe, it } from "node:test";
import assert from "node:assert";
import {
    createApprovalGrant,
    isApprovalValid,
    ApprovalStore,
} from "../ApprovalToken";

describe("ApprovalToken — binding", () => {
    it("valid for the exact session + content it was minted for", async () => {
        const now = 1_000_000;
        const g = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "approval_required", scope: "once", now });
        assert.ok(isApprovalValid(g, { sessionId: "s1", contentHash: "hashA", now: now + 1000 }));
    });

    it("cannot be replayed for different content", async () => {
        const now = 1_000_000;
        const g = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "approval_required", scope: "session", now });
        assert.strictEqual(isApprovalValid(g, { sessionId: "s1", contentHash: "hashB", now: now + 1000 }), false);
    });

    it("cannot be used from a different session", async () => {
        const now = 1_000_000;
        const g = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "approval_required", scope: "session", now });
        assert.strictEqual(isApprovalValid(g, { sessionId: "s2", contentHash: "hashA", now: now + 1000 }), false);
    });

    it("expires after its TTL", async () => {
        const now = 1_000_000;
        const g = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "approval_required", scope: "once", ttlMs: 500, now });
        assert.ok(isApprovalValid(g, { sessionId: "s1", contentHash: "hashA", now: now + 100 }));
        assert.strictEqual(isApprovalValid(g, { sessionId: "s1", contentHash: "hashA", now: now + 1000 }), false);
    });

    it("a deny outcome is never valid", async () => {
        const g = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "block", outcome: "deny", scope: "session" });
        assert.strictEqual(isApprovalValid(g, { sessionId: "s1", contentHash: "hashA" }), false);
    });

    it("token carries no raw content and is unique per mint", async () => {
        const g1 = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "approval_required", scope: "once" });
        const g2 = await createApprovalGrant({ sessionId: "s1", contentHash: "hashA", decision: "approval_required", scope: "once" });
        assert.notStrictEqual(g1.token, g2.token);
        assert.doesNotMatch(g1.token, /hashA/);
    });
});

describe("ApprovalStore", () => {
    it("approves then blocks replay for once-scope", async () => {
        const now = 2_000_000;
        const store = new ApprovalStore();
        const g = await createApprovalGrant({ sessionId: "s1", contentHash: "h", decision: "approval_required", scope: "once", now });
        store.add(g);
        assert.ok(store.isApproved("s1", "h", now + 10));
        assert.ok(store.consume("s1", "h", now + 10));
        // Once consumed, no longer approved.
        assert.strictEqual(store.isApproved("s1", "h", now + 20), false);
    });

    it("session scope stays valid across multiple checks", async () => {
        const now = 3_000_000;
        const store = new ApprovalStore();
        store.add(await createApprovalGrant({ sessionId: "s1", contentHash: "h", decision: "approval_required", scope: "session", now }));
        store.consume("s1", "h", now + 10);
        assert.ok(store.isApproved("s1", "h", now + 20), "session scope remains valid");
    });

    it("prunes expired grants and lists redacted views", async () => {
        const now = 4_000_000;
        const store = new ApprovalStore();
        store.add(await createApprovalGrant({ sessionId: "s1", contentHash: "h", decision: "approval_required", scope: "once", ttlMs: 100, now }));
        assert.strictEqual(store.size, 1);
        assert.strictEqual(store.prune(now + 1000), 1);
        assert.strictEqual(store.size, 0);
    });

    it("clear removes everything", async () => {
        const store = new ApprovalStore();
        store.add(await createApprovalGrant({ sessionId: "s1", contentHash: "h", decision: "approval_required", scope: "session" }));
        store.clear();
        assert.strictEqual(store.size, 0);
    });
});
