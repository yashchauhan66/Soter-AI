/**
 * HOOK INSTALL — editing an agent's config without destroying what is in it.
 *
 * The Claude Code user-scope target is `~/.claude/settings.json`, which is
 * commonly where a live provider key lives. An installer that clobbers that
 * file, or duplicates its entry on every run, does real damage — so these tests
 * pin preservation and idempotence as hard properties, not conveniences.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    CURSOR_EVENTS,
    HOOK_MARKER,
    claudeSettingsPath,
    cursorCommandString,
    cursorHooksPath,
    hookCommand,
    mergeClaudeCodeHooks,
    mergeCursorHooks,
} from "../hook-install";

const HANDLER = hookCommand("/usr/bin/node", "/opt/soterai/cli.js", "claude-code");

describe("Claude Code install", () => {
    it("adds the hook to a file that has none", () => {
        const { document } = mergeClaudeCodeHooks(undefined, HANDLER);
        const groups = (document.hooks as Record<string, unknown[]>).PreToolUse;
        assert.equal(groups.length, 1);
        const group = groups[0] as { matcher: string; hooks: Array<Record<string, unknown>> };
        assert.equal(group.matcher, "*", "a narrower matcher leaves tools unguarded");
        assert.equal(group.hooks[0].type, "command");
        assert.deepEqual(group.hooks[0].args, HANDLER.args);
    });

    it("PRESERVES every other key in the settings file", () => {
        // Modelled on a real settings.json: the env block is exactly the kind of
        // content an install must never touch.
        const existing = {
            env: { ANTHROPIC_BASE_URL: "https://example.invalid", ANTHROPIC_AUTH_TOKEN: "REDACTED_IN_TEST" },
            model: "claude-opus-5",
            permissions: { allow: ["Bash(npm test)"] },
        };
        const { document } = mergeClaudeCodeHooks(existing, HANDLER);
        assert.deepEqual(document.env, existing.env, "the install rewrote the user's env block");
        assert.equal(document.model, "claude-opus-5");
        assert.deepEqual(document.permissions, existing.permissions);
    });

    it("PRESERVES hooks the user already had, including other PreToolUse entries", () => {
        const existing = {
            hooks: {
                PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "/usr/local/bin/audit.sh" }] }],
                PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/usr/local/bin/lint.sh" }] }],
            },
        };
        const { document } = mergeClaudeCodeHooks(existing, HANDLER);
        const hooks = document.hooks as Record<string, unknown[]>;
        assert.equal(hooks.PostToolUse.length, 1, "an unrelated event was dropped");
        assert.equal(hooks.PreToolUse.length, 2, "the user's own PreToolUse hook was replaced instead of kept");
        const preserved = hooks.PreToolUse[0] as { hooks: Array<{ command: string }> };
        assert.equal(preserved.hooks[0].command, "/usr/local/bin/audit.sh");
    });

    it("is IDEMPOTENT: re-running replaces our entry instead of stacking duplicates", () => {
        const first = mergeClaudeCodeHooks(undefined, HANDLER);
        const second = mergeClaudeCodeHooks(first.document, HANDLER);
        const groups = (second.document.hooks as Record<string, unknown[]>).PreToolUse;
        assert.equal(groups.length, 1, "a second install added a second matcher group");
        assert.equal((groups[0] as { hooks: unknown[] }).hooks.length, 1, "a second install duplicated the handler");
        assert.equal(second.alreadyInstalled, true, "re-install must report that nothing changed");
    });

    it("upgrades an entry whose path changed, without leaving the stale one behind", () => {
        const old = mergeClaudeCodeHooks(undefined, hookCommand("/usr/bin/node", "/old/cli.js", "claude-code"));
        const upgraded = mergeClaudeCodeHooks(old.document, HANDLER);
        const group = (upgraded.document.hooks as Record<string, unknown[]>).PreToolUse[0] as { hooks: Array<{ args: string[] }> };
        assert.equal(group.hooks.length, 1, "the stale handler was left in place alongside the new one");
        assert.ok(group.hooks[0].args.includes("/opt/soterai/cli.js"));
        assert.equal(upgraded.alreadyInstalled, false);
    });

    it("invokes node with an absolute script path, not a bare `soterai`", () => {
        // A hook that cannot start is a NON-blocking error in Claude Code, so a
        // PATH miss would be a silent fail-open rather than a visible breakage.
        assert.equal(HANDLER.command, "/usr/bin/node");
        assert.ok(HANDLER.args[0].endsWith("cli.js"));
        assert.ok(HANDLER.args.some((a) => a.includes(HOOK_MARKER)), "the entry needs a marker to be replaceable");
    });
});

describe("Cursor install", () => {
    it("covers all three credential-carrying events with failClosed set", () => {
        const { document } = mergeCursorHooks(undefined, cursorCommandString("/usr/bin/node", "/opt/soterai/cli.js"));
        assert.equal(document.version, 1, "version must be a positive integer or Cursor rejects the file");
        const hooks = document.hooks as Record<string, Array<Record<string, unknown>>>;
        for (const event of CURSOR_EVENTS) {
            assert.ok(hooks[event], `missing ${event}`);
            assert.equal(
                hooks[event][0].failClosed, true,
                `${event} would fail OPEN on crash, timeout or empty output without failClosed`,
            );
        }
    });

    it("PRESERVES the user's existing hooks and version", () => {
        const existing = {
            version: 1,
            hooks: {
                beforeShellExecution: [{ command: "./scripts/approve-network.sh" }],
                afterFileEdit: [{ command: "./scripts/format.sh" }],
            },
        };
        const { document } = mergeCursorHooks(existing, cursorCommandString("/usr/bin/node", "/opt/soterai/cli.js"));
        const hooks = document.hooks as Record<string, Array<Record<string, unknown>>>;
        assert.equal(hooks.afterFileEdit.length, 1, "an unrelated event was dropped");
        assert.equal(hooks.beforeShellExecution.length, 2, "the user's own shell hook was replaced instead of kept");
        assert.equal(hooks.beforeShellExecution[0].command, "./scripts/approve-network.sh");
    });

    it("is IDEMPOTENT across re-installs", () => {
        const command = cursorCommandString("/usr/bin/node", "/opt/soterai/cli.js");
        const first = mergeCursorHooks(undefined, command);
        const second = mergeCursorHooks(first.document, command);
        const hooks = second.document.hooks as Record<string, unknown[]>;
        for (const event of CURSOR_EVENTS) assert.equal(hooks[event].length, 1, `${event} was duplicated`);
        assert.equal(second.alreadyInstalled, true);
    });

    it("quotes paths containing spaces, which is the normal case on Windows", () => {
        const command = cursorCommandString("C:\\Program Files\\nodejs\\node.exe", "C:\\Users\\a b\\cli.js");
        assert.ok(command.startsWith('"C:\\Program Files\\nodejs\\node.exe"'), `unquoted exec path: ${command}`);
        assert.ok(command.includes('"C:\\Users\\a b\\cli.js"'), `unquoted script path: ${command}`);
    });
});

describe("config locations", () => {
    it("resolves user and project scopes to the documented paths", () => {
        assert.match(claudeSettingsPath("user", "/home/dev", "/work"), /home[\\/]dev[\\/]\.claude[\\/]settings\.json$/);
        assert.match(claudeSettingsPath("project", "/home/dev", "/work"), /work[\\/]\.claude[\\/]settings\.json$/);
        assert.match(cursorHooksPath("user", "/home/dev", "/work"), /home[\\/]dev[\\/]\.cursor[\\/]hooks\.json$/);
        assert.match(cursorHooksPath("project", "/home/dev", "/work"), /work[\\/]\.cursor[\\/]hooks\.json$/);
    });
});
