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
        const result = await applyProposedChange(change, io, false);
        assert.equal(result.applied, false);
        assert.match(result.reason ?? "", /did not approve/);
        assert.equal(io.store["config/openai.json"], before);
    });

    it("apply + restore round-trip preserves original content", async () => {
        const before = '{\n  "baseURL": "https://api.openai.com/v1"\n}\n';
        const io = memoryIO({ "config/openai.json": before });
        const change = proposeBrokerRewrite("config/openai.json", before, "openai-compatible", 47321);
        const applied = await applyProposedChange(change, io, true, ".soterai-backup-test");
        assert.equal(applied.applied, true);
        assert.ok(applied.backupPath.endsWith(".soterai-backup-test"));
        assert.match(io.store["config/openai.json"], /127\.0\.0\.1:47321/);
        assert.equal(io.store[applied.backupPath], before);

        const restored = await restoreFromBackup("config/openai.json", applied.backupPath, io, true);
        assert.equal(restored.restored, true);
        assert.equal(io.store["config/openai.json"], before);
    });

    it("refuses apply when file drifted since proposal", async () => {
        const before = '{\n  "baseURL": "https://api.openai.com/v1"\n}\n';
        const io = memoryIO({ "config/openai.json": before });
        const change = proposeBrokerRewrite("config/openai.json", before, "openai-compatible", 47321);
        io.store["config/openai.json"] = '{\n  "baseURL": "https://other.example/v1"\n}\n';
        const result = await applyProposedChange(change, io, true);
        assert.equal(result.applied, false);
        assert.match(result.reason ?? "", /changed since proposal/);
    });

    it("refuses restore without approval", async () => {
        const io = memoryIO({
            "config/openai.json": "new",
            "config/openai.json.bak": "old",
        });
        const r = await restoreFromBackup("config/openai.json", "config/openai.json.bak", io, false);
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
