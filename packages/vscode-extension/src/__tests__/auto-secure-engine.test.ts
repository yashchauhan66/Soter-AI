/**
 * "Secure My AI" regression tests.
 *
 * Every case here encodes a bug found during a real-user pass of the one-click
 * button: it corrupted JSON configs, wrote shell vars without `export`, sent
 * OpenAI-backed tools to the Anthropic route, resolved workspace-relative
 * candidates against the extension host's cwd, and reported success for files
 * it had refused to touch.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buildSecurePlan,
    discoverAllAiTools,
    executeSecurePlan,
    restoreAll,
    KNOWN_AI_TOOLS,
} from "../broker/AutoSecureEngine";
import { detectConfigFormat, proposeBrokerRewrite, type FileIO, type HttpIO } from "../broker/IntegrationAdapter";

function memoryIO(initial: Record<string, string> = {}): FileIO & { store: Record<string, string> } {
    const store: Record<string, string> = { ...initial };
    return {
        store,
        async readText(p: string) {
            return Object.prototype.hasOwnProperty.call(store, p) ? store[p] : null;
        },
        async writeText(p: string, c: string) { store[p] = c; },
        async exists(p: string) { return Object.prototype.hasOwnProperty.call(store, p); },
    };
}

function okHttp(status = 200): HttpIO {
    return {
        async get() { return { status, body: "ok" }; },
        async post() { return { status, body: "ok" }; },
    };
}

const PORT = 47321;

describe("proposeBrokerRewrite never corrupts the file it claims to protect", () => {
    it("refuses to append a shell directive to JSON with no base-URL field", () => {
        const before = JSON.stringify({ model: "claude-sonnet-4", permissions: { allow: [] } }, null, 2);
        const change = proposeBrokerRewrite("/home/u/.claude/settings.json", before, "anthropic-compatible", PORT);

        assert.ok(change.unsupportedReason, "must report why it could not rewrite");
        assert.equal(change.after, change.before, "an unsupported file must be a no-op");
        assert.doesNotThrow(() => JSON.parse(change.after), "output must remain valid JSON");
    });

    it("refuses YAML with no base-URL field rather than breaking the document", () => {
        const before = "model: gpt-4o\nauto-commits: false\n";
        const change = proposeBrokerRewrite("/home/u/.aider.conf.yml", before, "openai-compatible", PORT);
        assert.ok(change.unsupportedReason);
        assert.equal(change.after, change.before);
    });

    it("edits an existing base-URL field in place and keeps JSON parseable", () => {
        const before = JSON.stringify({ models: [{ apiBase: "https://api.openai.com/v1" }] }, null, 2);
        const change = proposeBrokerRewrite("/home/u/.continue/config.json", before, "continue-config", PORT);
        assert.equal(change.unsupportedReason, undefined);
        const parsed = JSON.parse(change.after) as { models: Array<{ apiBase: string }> };
        assert.equal(parsed.models[0].apiBase, `http://127.0.0.1:${PORT}/v1/ai/openai-compatible`);
    });

    it("writes `export` in shell profiles so child processes actually inherit the var", () => {
        const change = proposeBrokerRewrite("/home/u/.bashrc", "alias ll='ls -la'\n", "openai-compatible", PORT);
        assert.equal(change.unsupportedReason, undefined);
        assert.match(change.after, /^export OPENAI_BASE_URL=http:\/\/127\.0\.0\.1:47321\//m);
    });

    it("omits `export` in .env files, which dotenv loaders would treat as part of the key", () => {
        const change = proposeBrokerRewrite("/ws/.env", "PORT=3000\n", "openai-compatible", PORT);
        assert.doesNotMatch(change.after, /export /);
        assert.match(change.after, /^OPENAI_BASE_URL=/m);
    });

    it("routes anthropic and openai kinds to their own broker paths", () => {
        const a = proposeBrokerRewrite("/home/u/.zshrc", "", "anthropic-compatible", PORT);
        const o = proposeBrokerRewrite("/home/u/.zshrc", "", "openai-compatible", PORT);
        assert.match(a.after, /ANTHROPIC_BASE_URL=.*\/v1\/ai\/anthropic-compatible/);
        assert.match(o.after, /OPENAI_BASE_URL=.*\/v1\/ai\/openai-compatible/);
    });
});

describe("detectConfigFormat", () => {
    it("classifies by filename first", () => {
        assert.equal(detectConfigFormat("/a/.claude/settings.json", "{}"), "json");
        assert.equal(detectConfigFormat("/a/.aider.conf.yml", "model: x"), "yaml");
        assert.equal(detectConfigFormat("/a/.env.local", "A=1"), "dotenv");
        assert.equal(detectConfigFormat("/a/.bashrc", "alias x=y"), "shell");
    });

    it("falls back to content shape for unnamed files", () => {
        assert.equal(detectConfigFormat("/a/config", '{"baseURL":"x"}'), "json");
        assert.equal(detectConfigFormat("/a/notes", "hello"), "unknown");
    });
});

describe("discoverAllAiTools path anchoring", () => {
    it("resolves workspace-relative candidates against the workspace, not the host cwd", async () => {
        const io = memoryIO({ "/ws/.env": "OPENAI_BASE_URL=https://api.openai.com/v1\n" });
        const found = await discoverAllAiTools(io, "/home/u", "/ws");
        const env = found.find((f) => f.spec.id === "generic-env");
        assert.ok(env);
        assert.deepEqual(env.configs.map((c) => c.path), ["/ws/.env"]);
    });

    it("skips relative candidates entirely when no workspace is open", async () => {
        const io = memoryIO({ ".env": "OPENAI_BASE_URL=x\n" });
        const found = await discoverAllAiTools(io, "/home/u", undefined);
        for (const f of found) {
            for (const c of f.configs) {
                assert.ok(c.path.startsWith("/home/u"), `${c.path} must be home-anchored`);
            }
        }
    });

    it("reports monitor-only tools as monitor-only, never as covered", async () => {
        const found = await discoverAllAiTools(memoryIO(), "/home/u", "/ws");
        const copilot = found.find((f) => f.spec.id === "copilot-ext");
        assert.ok(copilot);
        assert.equal(copilot.status, "monitor-only");
        assert.equal(copilot.spec.canAutoSecure, false);
    });

    it("every auto-securable tool declares at least one config candidate", () => {
        for (const t of KNOWN_AI_TOOLS) {
            if (t.mode === "monitor") continue;
            assert.ok(t.configCandidates.length > 0, `${t.id} has no candidates but claims auto-secure`);
        }
    });
});

describe("buildSecurePlan honesty", () => {
    it("reports a JSON config it refused to rewrite instead of claiming coverage", async () => {
        const settings = "/home/u/.claude/settings.json";
        const files = { [settings]: JSON.stringify({ model: "claude-sonnet-4" }, null, 2) };
        const io = memoryIO(files);
        const discovered = await discoverAllAiTools(io, "/home/u", "/ws");
        const plan = buildSecurePlan(discovered, files, PORT);

        assert.equal(plan.proposed.length, 0);
        assert.equal(plan.unsupported.length, 1);
        assert.equal(plan.unsupported[0].path, settings);
        assert.equal(plan.brokerNeeded, false);
    });

    it("keeps each config's own kind rather than coercing everything to anthropic", async () => {
        const files = {
            "/home/u/.bashrc": "export OPENAI_BASE_URL=https://api.openai.com/v1\n",
        };
        const io = memoryIO(files);
        const discovered = await discoverAllAiTools(io, "/home/u", "/ws");
        const plan = buildSecurePlan(discovered, files, PORT);
        assert.equal(plan.proposed.length, 1);
        assert.match(plan.proposed[0].brokerBaseUrl, /openai-compatible$/);
    });
});

describe("executeSecurePlan", () => {
    it("refuses to rewrite anything while the broker is offline", async () => {
        const files = { "/home/u/.bashrc": "export OPENAI_BASE_URL=https://api.openai.com/v1\n" };
        const io = memoryIO(files);
        const discovered = await discoverAllAiTools(io, "/home/u", "/ws");
        const plan = buildSecurePlan(discovered, files, PORT);
        const deadHttp: HttpIO = {
            async get() { throw new Error("ECONNREFUSED"); },
            async post() { throw new Error("ECONNREFUSED"); },
        };
        const out = await executeSecurePlan(plan, discovered, io, deadHttp, true, `http://127.0.0.1:${PORT}/health`);

        assert.equal(out.brokerOnline, false);
        assert.equal(out.applied.length, 0);
        assert.match(out.headline, /Broker offline/);
        assert.equal(io.store["/home/u/.bashrc"], files["/home/u/.bashrc"], "no file may change");
    });

    it("does not claim redaction when the smoke test fails", async () => {
        const files = { "/home/u/.bashrc": "export OPENAI_BASE_URL=https://api.openai.com/v1\n" };
        const io = memoryIO(files);
        const discovered = await discoverAllAiTools(io, "/home/u", "/ws");
        const plan = buildSecurePlan(discovered, files, PORT);
        const flaky: HttpIO = {
            async get() { return { status: 200, body: "ok" }; },
            async post() { return { status: 500, body: "boom" }; },
        };
        const out = await executeSecurePlan(plan, discovered, io, flaky, true, `http://127.0.0.1:${PORT}/health`);

        assert.equal(out.applied.filter((a) => a.applied).length, 1);
        assert.doesNotMatch(out.headline, /Secrets now redact/);
        assert.match(out.headline, /NOT confirmed/);
        assert.match(out.headline, /Restore AI Configs/);
    });

    it("applies, backs up, and round-trips through restoreAll", async () => {
        const original = "export OPENAI_BASE_URL=https://api.openai.com/v1\n";
        const files = { "/home/u/.bashrc": original };
        const io = memoryIO(files);
        const discovered = await discoverAllAiTools(io, "/home/u", "/ws");
        const plan = buildSecurePlan(discovered, files, PORT);
        const out = await executeSecurePlan(plan, discovered, io, okHttp(), true, `http://127.0.0.1:${PORT}/health`);

        assert.match(out.headline, /Secured 1 tool config/);
        assert.match(io.store["/home/u/.bashrc"], /127\.0\.0\.1:47321/);

        const restored = await restoreAll(out.applied, io);
        assert.equal(restored.restored, 1);
        assert.deepEqual(restored.failed, []);
        assert.equal(io.store["/home/u/.bashrc"], original, "restore must return the byte-exact original");
    });

    it("writes nothing when the user did not approve", async () => {
        const original = "export OPENAI_BASE_URL=https://api.openai.com/v1\n";
        const io = memoryIO({ "/home/u/.bashrc": original });
        const discovered = await discoverAllAiTools(io, "/home/u", "/ws");
        const plan = buildSecurePlan(discovered, { "/home/u/.bashrc": original }, PORT);
        const out = await executeSecurePlan(plan, discovered, io, okHttp(), false, `http://127.0.0.1:${PORT}/health`);

        assert.equal(out.applied.every((a) => !a.applied), true);
        assert.equal(io.store["/home/u/.bashrc"], original);
    });
});
