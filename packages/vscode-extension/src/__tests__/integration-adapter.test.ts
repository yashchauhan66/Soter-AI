/**
 * Phase 7 — Integration adapter behavioral tests.
 * Pure in-memory I/O; never silent write; apply + restore round-trip.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    applyProposedChange,
    detectIntegrationConfigs,
    healthCheckBroker,
    proposeBrokerRewrite,
    restoreFromBackup,
    streamSmokeTest,
    type BackupSink,
    type FileIO,
    type HttpIO,
} from "../broker/IntegrationAdapter";

function memoryIO(initial: Record<string, string> = {}): FileIO & { store: Record<string, string> } {
    const store: Record<string, string> = { ...initial };
    return {
        store,
        async readText(path: string) {
            return Object.prototype.hasOwnProperty.call(store, path) ? store[path] : null;
        },
        async writeText(path: string, content: string) {
            store[path] = content;
        },
        async exists(path: string) {
            return Object.prototype.hasOwnProperty.call(store, path);
        },
    };
}

/**
 * Stand-in for the encrypted sink. Deliberately stores backups OUTSIDE the
 * FileIO store, which is the whole point of the interface: a backup must not
 * be reachable as a file next to the secret it copies.
 */
function memorySink(): BackupSink & { entries: Map<string, string>; failNext: boolean } {
    const entries = new Map<string, string>();
    const sink = {
        entries,
        failNext: false,
        async store(originalPath: string, content: string) {
            if (sink.failNext) throw new Error("sink unavailable");
            const handle = `h${entries.size + 1}`;
            entries.set(handle, content);
            return handle;
        },
        async retrieve(handle: string) {
            return entries.has(handle) ? entries.get(handle)! : null;
        },
    };
    return sink;
}

describe("IntegrationAdapter detect + propose", () => {
    it("detects openai-compatible config and extracts base URL", async () => {
        const io = memoryIO({
            "config/openai.json": JSON.stringify({ baseURL: "https://api.openai.com/v1", model: "gpt-4" }, null, 2),
        });
        const found = await detectIntegrationConfigs(["config/openai.json", "missing.json"], io);
        assert.equal(found.length, 1);
        assert.equal(found[0].kind, "openai-compatible");
        assert.equal(found[0].currentBaseUrl, "https://api.openai.com/v1");
    });

    it("proposes a rewrite to loopback broker without writing", async () => {
        const before = '{\n  "baseURL": "https://api.openai.com/v1"\n}\n';
        const change = proposeBrokerRewrite("config/openai.json", before, "openai-compatible", 47321);
        assert.match(change.after, /127\.0\.0\.1:47321\/v1\/ai\/openai-compatible/);
        assert.equal(change.before, before);
        assert.ok(change.after !== change.before);
    });
});

describe("IntegrationAdapter apply + restore (never silent)", () => {
    it("refuses to write without approval", async () => {
        const before = '{\n  "baseURL": "https://api.openai.com/v1"\n}\n';
        const io = memoryIO({ "config/openai.json": before });
        const change = proposeBrokerRewrite("config/openai.json", before, "openai-compatible", 47321);
        const result = await applyProposedChange(change, io, false, memorySink());
        assert.equal(result.applied, false);
        assert.match(result.reason ?? "", /did not approve/);
        assert.equal(io.store["config/openai.json"], before);
    });

    it("apply + restore round-trip preserves original content", async () => {
        const before = '{\n  "baseURL": "https://api.openai.com/v1"\n}\n';
        const io = memoryIO({ "config/openai.json": before });
        const sink = memorySink();
        const change = proposeBrokerRewrite("config/openai.json", before, "openai-compatible", 47321);
        const applied = await applyProposedChange(change, io, true, sink);
        assert.equal(applied.applied, true);
        assert.match(io.store["config/openai.json"], /127\.0\.0\.1:47321/);
        assert.equal(await sink.retrieve(applied.backupPath), before);

        const restored = await restoreFromBackup("config/openai.json", applied.backupPath, io, true, sink);
        assert.equal(restored.restored, true);
        assert.equal(io.store["config/openai.json"], before);
    });

    /**
     * Regression guard for the plaintext-backup secret leak.
     *
     * The old implementation wrote the pre-rewrite copy to
     * `${path}.soterai-backup-<ts>` — a sibling of the file. For a `.env` that
     * meant every secret was duplicated into a path `.gitignore` does not match
     * and file permissions do not protect. This asserts on the FileIO store
     * directly: after securing a secret-bearing `.env`, the only path the
     * filesystem knows about is the original.
     */
    it("never writes the pre-rewrite copy of a secret file to the filesystem", async () => {
        const secret = "OPENAI_API_KEY=sk-live-DEADBEEF12345\nSTRIPE_SECRET_KEY=sk_live_TOPSECRET\n";
        const io = memoryIO({ "/ws/.env": secret });
        const sink = memorySink();
        const change = proposeBrokerRewrite("/ws/.env", secret, "openai-compatible", 47321);
        const applied = await applyProposedChange(change, io, true, sink);

        assert.equal(applied.applied, true, "the rewrite should still happen");
        assert.deepEqual(
            Object.keys(io.store),
            ["/ws/.env"],
            "a backup file must never appear on the filesystem beside the original",
        );
        for (const [path, content] of Object.entries(io.store)) {
            if (path === "/ws/.env") continue;
            assert.doesNotMatch(content, /sk-live-DEADBEEF12345/, `secret leaked into ${path}`);
        }
        // The content is still recoverable — just not from a readable file.
        assert.equal(await sink.retrieve(applied.backupPath), secret);
    });

    it("leaves the original untouched when the backup sink fails", async () => {
        const secret = "OPENAI_API_KEY=sk-live-DEADBEEF12345\n";
        const io = memoryIO({ "/ws/.env": secret });
        const sink = memorySink();
        sink.failNext = true;
        const change = proposeBrokerRewrite("/ws/.env", secret, "openai-compatible", 47321);
        const applied = await applyProposedChange(change, io, true, sink);

        assert.equal(applied.applied, false);
        assert.match(applied.reason ?? "", /backup failed/);
        assert.equal(io.store["/ws/.env"], secret, "an un-undoable rewrite is worse than none");
    });

    it("refuses apply when file drifted since proposal", async () => {
        const before = '{\n  "baseURL": "https://api.openai.com/v1"\n}\n';
        const io = memoryIO({ "config/openai.json": before });
        const change = proposeBrokerRewrite("config/openai.json", before, "openai-compatible", 47321);
        io.store["config/openai.json"] = '{\n  "baseURL": "https://other.example/v1"\n}\n';
        const result = await applyProposedChange(change, io, true, memorySink());
        assert.equal(result.applied, false);
        assert.match(result.reason ?? "", /changed since proposal/);
    });

    it("refuses restore without approval", async () => {
        const io = memoryIO({ "config/openai.json": "new" });
        const sink = memorySink();
        const handle = await sink.store("config/openai.json", "old");
        const r = await restoreFromBackup("config/openai.json", handle, io, false, sink);
        assert.equal(r.restored, false);
        assert.equal(io.store["config/openai.json"], "new");
    });
});

describe("IntegrationAdapter health + stream smoke", () => {
    it("reports health OK on 200", async () => {
        const http: HttpIO = {
            async get() {
                return { status: 200, body: '{"ok":true}' };
            },
            async post() {
                return { status: 200, body: "" };
            },
        };
        const h = await healthCheckBroker(47321, http);
        assert.equal(h.ok, true);
        assert.match(h.url, /127\.0\.0\.1:47321\/health/);
    });

    it("stream smoke fails closed without auth token", async () => {
        const http: HttpIO = {
            async get() {
                return { status: 200, body: "" };
            },
            async post() {
                return { status: 200, body: "" };
            },
        };
        const s = await streamSmokeTest(47321, "", http);
        assert.equal(s.ok, false);
        assert.match(s.detail, /missing broker auth/);
    });

    it("stream smoke accepts non-404 route responses", async () => {
        const http: HttpIO = {
            async get() {
                return { status: 200, body: "" };
            },
            async post() {
                return { status: 502, body: "upstream missing" };
            },
        };
        const s = await streamSmokeTest(47321, "token", http);
        assert.equal(s.ok, true);
        assert.match(s.detail, /502/);
    });
});
