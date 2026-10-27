import "./phase2/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import * as stub from "./phase2/vscode-stub";
import { registerPreCommitHooks } from "../history-hooks/commands";
import { PreCommitController } from "../history-hooks/PreCommitController";
import { registerContinuousGuardCommands } from "../scanners/continuousGuards";

for (const copy of [false, true]) test("F26a full activation ordering retains reviewed legacy " + (copy ? "copy guidance" : "install routing"), async t => {
    stub.resetState("C:\\Synthetic F26a Legacy\\workspace");
    const context = stub.makeExtensionContext("C:\\Synthetic F26a Legacy\\profile");
    stub.state.configInspect.set("soterai.lite.historyHooks.preCommit", { defaultValue: false, globalValue: true });
    let calls = 0, clipboard = 0;
    t.mock.method(fsp, "readFile", async () => { throw Error("Synthetic legacy read refused."); });
    t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    t.mock.method(stub.window, "showInformationMessage", async () => undefined);
    t.mock.method(stub.env.clipboard, "writeText", async () => { clipboard++; });
    t.mock.method(PreCommitController.prototype, "install", async () => { calls++; return Object.freeze({ status: "APPLIED" as const }); });
    t.mock.method(PreCommitController.prototype, "current", () => true);
    const controller = registerPreCommitHooks(context as never);
    // Exact existing activation order: canonical scanner registrations first,
    // continuous guards afterwards. Neither legacy command may be overwritten.
    registerContinuousGuardCommands(context as never, { scanText: async () => ({ findings: [] }) });
    t.after(() => { controller.dispose(); context.subscriptions.forEach(value => value.dispose()); });
    const handler = stub.registeredCommands.get("soterai." + (copy ? "copyPreCommitHookScript" : "installGitSecretHook")); assert.ok(handler);
    await handler({ approved: true, root: "caller path is not authority" });
    assert.equal(calls, copy ? 0 : 1, "Legacy install must reach only the new owner-reviewed controller.");
    assert.equal(clipboard, 0, "Legacy copy must not release the old executable fallback hook.");
});
