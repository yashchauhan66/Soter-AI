/**
 * Continuous Guards behavioural tests.
 *
 * These functions had no coverage at all, which is how a screen-share warning
 * that only ever matched a root-level `.env`, a git hook installed without the
 * executable bit, a "found risky packages" claim with no scan behind it, and a
 * log scanner that reported "clean" after reading nothing all shipped together.
 *
 * The module imports `vscode`, which does not exist outside the extension host,
 * so a stub is installed into the CJS loader before the module is required.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

declare const require: (id: string) => any;

const noop = () => undefined;
const vscodeStub = {
    window: { showInformationMessage: noop, showWarningMessage: noop, showErrorMessage: noop, visibleTextEditors: [] },
    workspace: {
        workspaceFolders: undefined,
        getConfiguration: () => ({ get: (_k: string, d: unknown) => d, update: noop }),
        asRelativePath: (u: unknown) => String(u),
        fs: { writeFile: noop },
    },
    commands: { registerCommand: (id: string, fn: unknown) => ({ id, fn, dispose: noop }) },
    env: { clipboard: { readText: async () => "", writeText: async () => undefined } },
    Uri: { joinPath: (base: { fsPath: string }, ...parts: string[]) => ({ fsPath: [base.fsPath, ...parts].join("/") }) },
    ConfigurationTarget: { Global: 1 },
};

const loader = Module as unknown as { _load: (...a: unknown[]) => unknown };
const originalLoad = loader._load;
let guards: typeof import("../scanners/continuousGuards");

before(() => {
    loader._load = function (request: unknown, ...rest: unknown[]) {
        if (request === "vscode") return vscodeStub;
        return originalLoad.call(this, request, ...rest);
    };
    guards = require("../scanners/continuousGuards");
});

after(() => { loader._load = originalLoad; });

describe("buildScreenShareWarnings (#6)", () => {
    it("flags secret files at any depth, not only at the workspace root", () => {
        const flagged = guards.buildScreenShareWarnings([
            ".env",
            "sub/.env",
            "backend/.env.production",
            "C:\\other\\.env",
            "/home/u/app/.env.local",
        ]);
        assert.deepEqual(flagged, [".env", "sub/.env", "backend/.env.production", "C:\\other\\.env", "/home/u/app/.env.local"]);
    });

    it("flags key material and named secrets", () => {
        const flagged = guards.buildScreenShareWarnings([
            "keys/id_rsa.pem", "certs/server.key", "deploy/prod.p12",
            "config/credentials.json", "src/apiKeys.ts", "infra/passwords.yml",
            "/home/u/.ssh/id_ed25519", "/home/u/.aws/config",
        ]);
        assert.equal(flagged.length, 8, `expected all flagged, got ${JSON.stringify(flagged)}`);
    });

    it("does not flag ordinary source files", () => {
        assert.deepEqual(
            guards.buildScreenShareWarnings(["src/index.ts", "README.md", "package.json", "environment/setup.md"]),
            [],
        );
    });
});

describe("evaluateOsvNudge (#7)", () => {
    it("never claims risky packages were found when no scan ran", () => {
        const n = guards.evaluateOsvNudge("ask", { scanned: false, riskyCount: 0 });
        assert.equal(n.shouldNudge, true);
        assert.doesNotMatch(n.message ?? "", /found risky|flagged \d/i);
        assert.match(n.message ?? "", /No dependency scan has run/i);
    });

    it("reports the real count when a scan did run", () => {
        const n = guards.evaluateOsvNudge("never", { scanned: true, riskyCount: 3 });
        assert.equal(n.shouldNudge, true);
        assert.match(n.message ?? "", /3 risky package/);
    });

    it("stays quiet after a clean scan, and whenever OSV is already always-on", () => {
        assert.equal(guards.evaluateOsvNudge("ask", { scanned: true, riskyCount: 0 }).shouldNudge, false);
        assert.equal(guards.evaluateOsvNudge("always", { scanned: false, riskyCount: 0 }).shouldNudge, false);
    });
});

describe("parseGitHooksPath (#5)", () => {
    it("detects a husky-style core.hooksPath so a dead hook is never installed", () => {
        assert.equal(guards.parseGitHooksPath("[core]\n\trepositoryformatversion = 0\n\thooksPath = .husky\n"), ".husky");
    });

    it("ignores hooksPath declared under another section", () => {
        assert.equal(guards.parseGitHooksPath("[core]\n\tbare = false\n[other]\n\thooksPath = .nope\n"), null);
    });

    it("returns null for a normal repo config", () => {
        assert.equal(guards.parseGitHooksPath("[core]\n\tbare = false\n\tlogallrefupdates = true\n"), null);
    });

    it("strips quotes around the value", () => {
        assert.equal(guards.parseGitHooksPath('[core]\n\thooksPath = "my hooks"\n'), "my hooks");
    });
});

describe("buildPreCommitHook (#5)", () => {
    it("is a POSIX script that blocks on a match and exits 0 otherwise", () => {
        const hook = guards.buildPreCommitHook();
        assert.match(hook, /^#!\/bin\/sh/);
        assert.match(hook, /exit 1/);
        assert.match(hook, /--no-verify/, "must document the bypass — a hook the user cannot skip is a trap");
        assert.match(hook, /AKIA\[0-9A-Z\]\{16\}/);
    });
});

describe("resolveLocalModelLogFiles (#8)", () => {
    function fakeFs(dirs: string[], files: string[], entries: Record<string, string[]>) {
        return {
            async stat(p: string) {
                if (dirs.includes(p)) return { isDirectory: () => true };
                if (files.includes(p)) return { isDirectory: () => false };
                throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
            },
            async readdir(p: string) { return entries[p] ?? []; },
        };
    }

    it("expands the LM Studio log DIRECTORY into the files inside it", async () => {
        const dir = "/home/u/.cache/lm-studio/server-logs";
        const io = fakeFs([dir], [`${dir}/2026-08-09.log`, `${dir}/2026-08-08.log`], {
            [dir]: ["2026-08-09.log", "2026-08-08.log"],
        });
        const found = await guards.resolveLocalModelLogFiles("/home/u", io);
        assert.deepEqual(found, [`${dir}/2026-08-09.log`, `${dir}/2026-08-08.log`]);
    });

    it("passes plain log files straight through", async () => {
        const f = "/home/u/.ollama/logs/server.log";
        const found = await guards.resolveLocalModelLogFiles("/home/u", fakeFs([], [f], {}));
        assert.deepEqual(found, [f]);
    });

    it("returns nothing when no local model is installed", async () => {
        assert.deepEqual(await guards.resolveLocalModelLogFiles("/home/u", fakeFs([], [], {})), []);
    });

    it("bounds how many files it pulls out of one directory", async () => {
        const dir = "/home/u/.cache/lm-studio/server-logs";
        const names = Array.from({ length: 200 }, (_, i) => `log-${i}.log`);
        const io = fakeFs([dir], names.map((n) => `${dir}/${n}`), { [dir]: names });
        const found = await guards.resolveLocalModelLogFiles("/home/u", io, 40);
        assert.equal(found.length, 40);
    });
});

describe("scanAICodeForVulns (#3)", () => {
    it("matches injection-prone AI-generated patterns", () => {
        assert.ok(guards.scanAICodeForVulns("db.query(`SELECT * FROM u WHERE id=${id}`)").includes("sql_injection_risk"));
        assert.ok(guards.scanAICodeForVulns("el.innerHTML = userInput").includes("innerHTML_xss"));
        assert.ok(guards.scanAICodeForVulns("const s = process.env.SECRET || 'hunter2fallback'").includes("hardcoded_fallback_secret"));
    });

    it("is stateless across calls despite global regexes", () => {
        const code = "eval(x)";
        assert.deepEqual(guards.scanAICodeForVulns(code), guards.scanAICodeForVulns(code));
    });

    it("stays quiet on clean code", () => {
        assert.deepEqual(guards.scanAICodeForVulns("export const add = (a: number, b: number) => a + b;"), []);
    });
});

describe("RAG egress detection (#4) is reachable from this module", () => {
    it("re-exports a live implementation rather than a dead local copy", () => {
        assert.equal(typeof guards.isRagEgress, "function");
        assert.ok(guards.RAG_EGRESS_HOSTS.length > 0);
        assert.ok(guards.isRagEgress("https://my-index.api.pinecone.io/vectors/upsert"));
        assert.ok(!guards.isRagEgress("https://api.openai.com/v1/chat/completions"));
    });
});
