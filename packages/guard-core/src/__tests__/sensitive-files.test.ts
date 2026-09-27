/**
 * The canonical sensitive-file list, and the two derived forms, must stay in
 * agreement — and must cover the agent-config files that motivated it.
 *
 * The list is authored as globs and consumed both as globs (file watchers) and
 * as a path predicate. This pins: (1) the predicate matches every glob's own
 * sample path, (2) it is path-scoped where it claims to be — a bare
 * `settings.json` is NOT treated as sensitive, only `.claude/settings.json` is,
 * (3) ordinary files stay clear, (4) the agent-config subset is really a subset.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    AGENT_CONFIG_GLOBS,
    SENSITIVE_FILE_GLOBS,
    SENSITIVE_FILE_GLOB_SAMPLES,
    isSensitiveFilePath,
} from "../sensitiveFiles";

describe("sensitive file list — globs and predicate agree", () => {
    it("every glob has a sample path and no sample is orphaned", () => {
        assert.deepEqual(
            Object.keys(SENSITIVE_FILE_GLOB_SAMPLES).sort(),
            [...SENSITIVE_FILE_GLOBS].sort(),
            "a glob was added or removed without updating SENSITIVE_FILE_GLOB_SAMPLES",
        );
    });

    it("the predicate matches every glob's representative path", () => {
        for (const [glob, sample] of Object.entries(SENSITIVE_FILE_GLOB_SAMPLES)) {
            assert.equal(
                isSensitiveFilePath(sample),
                true,
                `glob ${glob} claims to match ${sample}, but isSensitiveFilePath disagrees`,
            );
        }
    });

    it("covers the agent credential configs that no prior list did", () => {
        // The whole reason this module exists.
        for (const p of [
            ".claude/settings.json",
            ".claude/settings.local.json",
            "some/nested/repo/.claude/settings.json",
            ".cursor/mcp.json",
            ".vscode/mcp.json",
            ".mcp.json",
        ]) {
            assert.equal(isSensitiveFilePath(p), true, `${p} should be sensitive`);
        }
    });

    it("is path-scoped: a bare settings.json is NOT sensitive", () => {
        // The trap the path-scoping avoids — flagging every editor's settings.
        assert.equal(isSensitiveFilePath("settings.json"), false);
        assert.equal(isSensitiveFilePath(".vscode/settings.json"), false);
        assert.equal(isSensitiveFilePath("config/settings.json"), false);
    });

    it("does not flag ordinary source and config files", () => {
        for (const p of [
            "src/index.ts",
            "package.json",
            "README.md",
            ".environment.ts", // must not be caught by the .env globs
            "app/environment.config.js",
            "tsconfig.json",
        ]) {
            assert.equal(isSensitiveFilePath(p), false, `${p} should NOT be sensitive`);
        }
    });

    it("matches a bare basename and a Windows-style relative path", () => {
        assert.equal(isSensitiveFilePath(".env"), true);
        assert.equal(isSensitiveFilePath(".env.production"), true);
        assert.equal(isSensitiveFilePath("repo\\.claude\\settings.json"), true);
    });

    it("AGENT_CONFIG_GLOBS is a real subset of the canonical list", () => {
        assert.ok(AGENT_CONFIG_GLOBS.length >= 5);
        for (const g of AGENT_CONFIG_GLOBS) {
            assert.ok(
                SENSITIVE_FILE_GLOBS.includes(g),
                `${g} is in AGENT_CONFIG_GLOBS but not the canonical list`,
            );
        }
    });
});
