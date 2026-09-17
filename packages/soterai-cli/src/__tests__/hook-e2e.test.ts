/**
 * HOOK END-TO-END — the real process, the real broker, the real exit code.
 *
 * Every other hook test injects its dependencies, which means none of them can
 * tell you what the shipped binary actually does when an agent runs it. That
 * gap is where a guard dies quietly: a hook that computes a perfect deny and
 * then exits 1 has enforced NOTHING, because Claude Code treats exit 1 as a
 * non-blocking error and runs the tool anyway. The unit tests cannot see that.
 *
 * So this spawns `soterai hook` as a child process exactly as an agent does —
 * payload on stdin, decision on stdout, verdict in the exit status — against a
 * real broker over real HTTP, and asserts on what the OS reports back.
 *
 * Every credential below is SYNTHETIC.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";

const TOKEN = "test_local_broker_token_0123456789abcdef";
const SK48 = `sk-${"Qv7mTb2LxK9dR4hZ8sN6pW3yJ1cF5gA0uE7iO2rY4tXn"}`;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(HERE, "..", "cli.ts");
const PKG_DIR = path.resolve(HERE, "..", "..");

interface RunResult { code: number | null; stdout: string; stderr: string }

/** Spawn the CLI the way an agent does: JSON on stdin, read the exit code. */
function runHook(args: string[], payload: unknown, env: Record<string, string> = {}): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            ["--import", "tsx", CLI_ENTRY, ...args],
            { cwd: PKG_DIR, env: { ...process.env, SOTERAI_BROKER_TOKEN: TOKEN, ...env } },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (c) => { stdout += String(c); });
        child.stderr.on("data", (c) => { stderr += String(c); });
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, stdout, stderr }));
        child.stdin.end(JSON.stringify(payload));
    });
}

describe("soterai hook: end-to-end through the real binary", () => {
    let broker: BrokerServer;
    let brokerUrl: string;
    let dir: string;

    before(async () => {
        broker = new BrokerServer({ token: TOKEN, port: 0 });
        brokerUrl = (await broker.start()).url;
        dir = await mkdtemp(path.join(tmpdir(), "soterai-hook-"));
    });

    after(async () => {
        await broker.stop();
        await rm(dir, { recursive: true, force: true });
    });

    it("DENIES a Read of a file holding a credential — exit 2, deny on stdout", async () => {
        // A settings-shaped file: the tool input is only a path, so nothing in
        // the call itself is suspicious. Only reading the target reveals it.
        const secretsFile = path.join(dir, "settings.json");
        await writeFile(secretsFile, JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: SK48 } }, null, 2), "utf8");

        const result = await runHook(["hook", "claude-code", "--url", brokerUrl], {
            session_id: "t1",
            hook_event_name: "PreToolUse",
            tool_name: "Read",
            cwd: dir,
            permission_mode: "default",
            tool_input: { file_path: secretsFile },
            tool_use_id: "toolu_01",
        });

        assert.equal(
            result.code, 2,
            `exit ${result.code} does not block: Claude Code only blocks on exit 2. stderr=${result.stderr}`,
        );
        const payload = JSON.parse(result.stdout.trim());
        assert.equal(payload.hookSpecificOutput.permissionDecision, "deny");
        assert.equal(payload.hookSpecificOutput.hookEventName, "PreToolUse");
        assert.match(payload.hookSpecificOutput.permissionDecisionReason, /ai_api_key/);
        assert.ok(result.stderr.trim().length > 0, "stderr must carry the reason as a fallback");

        // The whole point of the guard is that the value does not travel.
        assert.ok(!result.stdout.includes(SK48), "the deny response leaked the secret it was blocking");
        assert.ok(!result.stderr.includes(SK48), "stderr leaked the secret it was blocking");
    });

    it("DENIES a shell command that reads a credential file it merely NAMES", async () => {
        const envFile = path.join(dir, "prod.env");
        await writeFile(envFile, `OPENAI_API_KEY=${SK48}\n`, "utf8");

        const result = await runHook(["hook", "claude-code", "--url", brokerUrl], {
            hook_event_name: "PreToolUse",
            tool_name: "Bash",
            cwd: dir,
            tool_input: { command: `cat ${envFile}`, description: "show config" },
        });

        assert.equal(result.code, 2, `expected a block, got exit ${result.code}. stderr=${result.stderr}`);
        assert.match(JSON.parse(result.stdout.trim()).hookSpecificOutput.permissionDecisionReason, /ai_api_key/);
    });

    it("CONTROL: a clean Read is allowed — exit 0 and NO stdout", async () => {
        // Without this control the suite could pass by denying everything.
        const cleanFile = path.join(dir, "util.ts");
        await writeFile(cleanFile, "export function add(a: number, b: number) { return a + b; }\n", "utf8");

        const result = await runHook(["hook", "claude-code", "--url", brokerUrl], {
            hook_event_name: "PreToolUse",
            tool_name: "Read",
            cwd: dir,
            tool_input: { file_path: cleanFile },
        });

        assert.equal(result.code, 0, `a clean read must not be blocked. stderr=${result.stderr}`);
        assert.equal(
            result.stdout.trim(), "",
            'emitting permissionDecision:"allow" would suppress the user\'s own approval prompt',
        );
    });

    it("FAILS CLOSED when the broker is unreachable — exit 2, not exit 1", async () => {
        // The most important failure mode: the guard being down must not be
        // indistinguishable from the guard saying yes.
        const result = await runHook(["hook", "claude-code", "--url", "http://127.0.0.1:1"], {
            hook_event_name: "PreToolUse",
            tool_name: "Read",
            cwd: dir,
            tool_input: { file_path: path.join(dir, "settings.json") },
        });

        assert.equal(result.code, 2, `an unchecked call must be blocked, got exit ${result.code}`);
        assert.equal(JSON.parse(result.stdout.trim()).hookSpecificOutput.permissionDecision, "deny");
    });

    it("--on-error=allow opts out, and says so on stderr instead of passing silently", async () => {
        const result = await runHook(["hook", "claude-code", "--url", "http://127.0.0.1:1", "--on-error", "allow"], {
            hook_event_name: "PreToolUse",
            tool_name: "Read",
            cwd: dir,
            tool_input: { file_path: path.join(dir, "settings.json") },
        });

        assert.equal(result.code, 0, "the documented opt-out must actually let the call through");
        assert.match(result.stderr, /--on-error=allow/, "an opt-out that is silent is indistinguishable from working");
    });

    it("answers Cursor in Cursor's dialect, with an EXPLICIT allow for clean calls", async () => {
        const cleanFile = path.join(dir, "readme.md");
        await writeFile(cleanFile, "# Project\n\nNothing sensitive here.\n", "utf8");

        const allowed = await runHook(["hook", "cursor", "--url", brokerUrl], {
            hook_event_name: "beforeReadFile",
            cursor_version: "1.0.0",
            file_path: cleanFile,
            content: "# Project\n\nNothing sensitive here.\n",
        });
        assert.equal(allowed.code, 0);
        assert.equal(
            JSON.parse(allowed.stdout.trim()).permission, "allow",
            "under failClosed:true an empty stdout blocks the action — silence would break every clean read",
        );

        const denied = await runHook(["hook", "cursor", "--url", brokerUrl], {
            hook_event_name: "beforeReadFile",
            cursor_version: "1.0.0",
            file_path: path.join(dir, "settings.json"),
            content: `{"token":"${SK48}"}`,
        });
        const payload = JSON.parse(denied.stdout.trim());
        assert.equal(payload.permission, "deny");
        assert.ok(payload.user_message.length > 0);
        assert.ok(!denied.stdout.includes(SK48), "the Cursor deny response leaked the secret");
    });

    it("blocks a malformed payload rather than treating it as a clean call", async () => {
        const result = await runHook(["hook", "claude-code", "--url", brokerUrl], "this is not an object");
        assert.equal(result.code, 2, "unparseable input must not be an implicit allow");
    });
});
