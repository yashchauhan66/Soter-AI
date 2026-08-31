/**
 * GAP 2 in a real extension host: are the agent tools actually callable?
 *
 * `agent-tools.test.ts` proves the logic and the protocol without a host. It
 * cannot prove registration: a tool can be contributed in the manifest, have a
 * correct handler, pass every unit test, and still be absent from
 * `vscode.lm.tools` because the name in the manifest and the name passed to
 * `registerTool` disagree by one character. VS Code reports that as nothing at
 * all — the tool is simply not there.
 *
 * So this suite asks the host. It reads `vscode.lm.tools`, invokes each tool the
 * way an agent does via `vscode.lm.invokeTool`, and asserts the result carries a
 * verdict and no raw secret.
 *
 * The pinned host is 1.104.0, which has `vscode.lm`. The floor (1.85.0) does not,
 * and `npm run test:host:floor` runs this same file there — so the graceful no-op
 * is verified by the floor run rather than by mocking absence. Both paths are
 * asserted below: when the API is missing the suite requires zero tools and no
 * thrown error, which is exactly the degradation the engine range promises.
 */

import * as assert from "assert";
import * as vscode from "vscode";

const EXTENSION_ID = "soterai.soterai-ide-guard";

/** A fake key, shaped like the thing the detectors exist to find. */
const FAKE_KEY = "sk-proj-1234567890abcdefghijklmnopqrstuv";

/** The three tools Gap 2 contributes. Read from the manifest, not hardcoded. */
function contributedToolNames(extension: vscode.Extension<unknown>): string[] {
    const tools = (extension.packageJSON as { contributes?: { languageModelTools?: Array<{ name: string }> } })
        .contributes?.languageModelTools;
    return (tools ?? []).map((tool) => tool.name);
}

/** Pull the text out of a tool result, whatever part shape the host used. */
function resultText(result: vscode.LanguageModelToolResult): string {
    return result.content
        .map((part) => (part instanceof vscode.LanguageModelTextPart ? part.value : ""))
        .join("");
}

export function run(): Promise<void> {
    return new Promise((resolve, reject) => {
        const failures: string[] = [];
        const passes: string[] = [];
        const notes: string[] = [];

        const check = (name: string, fn: () => void | Promise<void>) =>
            Promise.resolve()
                .then(fn)
                .then(() => {
                    passes.push(name);
                    console.log("  ok   " + name);
                })
                .catch((error: unknown) => {
                    const detail = error instanceof Error ? error.message : String(error);
                    failures.push(`${name}: ${detail}`);
                    console.log("  FAIL " + name + " -> " + detail);
                });

        void (async () => {
            const extension = vscode.extensions.getExtension(EXTENSION_ID);
            if (!extension) {
                reject(new Error(`${EXTENSION_ID} is not installed in the test host`));
                return;
            }
            await extension.activate();

            const contributed = contributedToolNames(extension);
            const hostHasLm = typeof (vscode as { lm?: { registerTool?: unknown } }).lm?.registerTool === "function";
            notes.push(`host ${vscode.version}: vscode.lm.registerTool ${hostHasLm ? "present" : "ABSENT"}`);

            // ── the floor path: no API, no tools, no crash ────────────────────
            if (!hostHasLm) {
                await check("activation succeeds on a host without vscode.lm", () => {
                    // Reaching here at all is the assertion: activate() above did
                    // not throw. This is the case `engines.vscode: ^1.85.0`
                    // promises and the reason the floor is not raised.
                    assert.ok(extension.isActive, "the extension did not activate on a host without vscode.lm");
                });

                await check("registers no agent tools rather than pretending", () => {
                    const registered = (vscode as { lm?: { tools?: readonly { name: string }[] } }).lm?.tools ?? [];
                    const ours = registered.filter((tool) => tool.name.startsWith("soterai_"));
                    assert.strictEqual(ours.length, 0, `${ours.length} SoterAI tools on a host with no tool API`);
                });

                console.log(`\n${passes.length} passed, ${failures.length} failed (host has no language model API)`);
                for (const note of notes) console.log("  note: " + note);
                if (failures.length > 0) {
                    reject(new Error(`${failures.length} agent-tool host test(s) failed:\n  ` + failures.join("\n  ")));
                } else {
                    resolve();
                }
                return;
            }

            // ── the modern path: every contributed tool is really callable ────
            await check("every contributed tool appears in vscode.lm.tools", () => {
                const registered = new Set(vscode.lm.tools.map((tool) => tool.name));
                const missing = contributed.filter((name) => !registered.has(name));
                assert.deepStrictEqual(
                    missing,
                    [],
                    `contributed but never registered: ${missing.join(", ")} — an agent cannot see these`,
                );
                assert.ok(contributed.length >= 3, `only ${contributed.length} tools contributed`);
                notes.push(`registered tools: ${contributed.join(", ")}`);
            });

            await check("each registered tool carries a description and an input schema", () => {
                for (const name of contributed) {
                    const info = vscode.lm.tools.find((tool) => tool.name === name);
                    assert.ok(info, `${name} vanished between listing and lookup`);
                    assert.ok(info!.description.length > 0, `${name} has no description for the model`);
                    assert.ok(info!.inputSchema, `${name} exposes no input schema, so its input is unvalidated`);
                    assert.match(
                        info!.description,
                        /ADVISORY/,
                        `${name} does not tell the model it cannot block the action`,
                    );
                }
            });

            await check("invokeTool on soterai_check_command blocks a destructive command", async () => {
                const result = await vscode.lm.invokeTool("soterai_check_command", {
                    input: { command: "rm -rf /" },
                    toolInvocationToken: undefined,
                });
                const payload = JSON.parse(resultText(result));
                assert.strictEqual(payload.verdict, "block", `verdict was ${payload.verdict}`);
                assert.ok(payload.findings.length > 0, "a blocked command produced no finding to show the user");
                assert.ok(payload.coverage.includes("ADVISORY"), "the result omits its own coverage limit");
                notes.push(`check_command: ${payload.summary.slice(0, 120)}`);
            });

            await check("invokeTool on soterai_scan_text returns a verdict and never the raw secret", async () => {
                const result = await vscode.lm.invokeTool("soterai_scan_text", {
                    input: { text: `const key = "${FAKE_KEY}";` },
                    toolInvocationToken: undefined,
                });
                const text = resultText(result);
                // The whole serialised result, not just the fields expected to be
                // clean: this is what leaves the machine.
                assert.ok(!text.includes(FAKE_KEY), "the raw key crossed the tool boundary into a model prompt");
                const payload = JSON.parse(text);
                assert.ok(["warn", "block"].includes(payload.verdict), `a planted key was reported as ${payload.verdict}`);
                assert.ok(payload.redactedText, "no safe rewrite was offered");
                assert.ok(!payload.redactedText.includes(FAKE_KEY), "the 'redacted' copy still holds the raw key");
                notes.push(`scan_text: verdict=${payload.verdict} score=${payload.riskScore}`);
            });

            await check("invokeTool on soterai_check_dependency flags a typo-squat", async () => {
                const result = await vscode.lm.invokeTool("soterai_check_dependency", {
                    input: { command: "npm install expresss" },
                    toolInvocationToken: undefined,
                });
                const payload = JSON.parse(resultText(result));
                assert.notStrictEqual(payload.verdict, "allow", "a classic typo-squat was allowed");
                assert.match(payload.summary, /typosquat/i);
                notes.push(`check_dependency: ${payload.summary.slice(0, 120)}`);
            });

            await check("a clean input is allowed, so the tools are not simply always negative", async () => {
                // Without this, three tools that returned "block" unconditionally
                // would pass every assertion above.
                const result = await vscode.lm.invokeTool("soterai_check_command", {
                    input: { command: "npm run build" },
                    toolInvocationToken: undefined,
                });
                const payload = JSON.parse(resultText(result));
                assert.strictEqual(payload.verdict, "allow", `an ordinary build command was ${payload.verdict}`);
            });

            await check("every tool answers without throwing when its input is missing", async () => {
                // An agent will send a malformed call. A throw surfaces to the user
                // as a failed agent turn, which is worse than a clean "nothing to
                // check".
                for (const name of contributed) {
                    const result = await vscode.lm.invokeTool(name, { input: {}, toolInvocationToken: undefined });
                    const payload = JSON.parse(resultText(result));
                    assert.ok(payload.verdict, `${name} returned no verdict for an empty input`);
                }
            });

            await check("the MCP server bundle the provider points at exists in this install", async () => {
                // The provider hands VS Code a path. If the build stops emitting
                // it, the MCP handshake hangs and nothing names the cause.
                const { MCP_SERVER_RELATIVE_PATH } = await import("../../agent/mcpServer");
                const uri = vscode.Uri.joinPath(extension.extensionUri, ...MCP_SERVER_RELATIVE_PATH.split("/"));
                const stat = await vscode.workspace.fs.stat(uri);
                assert.ok(stat.size > 0, `${MCP_SERVER_RELATIVE_PATH} is present but empty`);
                notes.push(`MCP server bundle: ${Math.round(stat.size / 1024)} KB at ${MCP_SERVER_RELATIVE_PATH}`);
            });

            console.log(`\n${passes.length} passed, ${failures.length} failed`);
            for (const note of notes) console.log("  note: " + note);
            if (failures.length > 0) {
                reject(new Error(`${failures.length} agent-tool host test(s) failed:\n  ` + failures.join("\n  ")));
            } else {
                resolve();
            }
        })().catch(reject);
    });
}
