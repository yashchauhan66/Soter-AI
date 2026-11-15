import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { registerProjectJourney } from "../project-journey/commands";
async function fixture(t: TestContext, text = "console.log('public')") {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-guided-")); await fs.writeFile(path.join(root, "app.js"), text);
    stub.resetState(root); const context = Object.assign(stub.makeExtensionContext(path.join(root, "storage")), { extension: { packageJSON: { version: "0.7.0" } } });
    registerProjectJourney(context as never);
    t.mock.method(stub.window, "withProgress", async (_options: unknown, task: any) => task({}, new stub.CancellationTokenSource().token));
    t.after(() => context.subscriptions.forEach(item => item.dispose()));
    return () => stub.commands.executeCommand("soterai.openProjectJourney");
}
test("guided setup returns to recommendations after scan and context instead of closing", async t => {
    const run = await fixture(t); let picks = 0, contextCalls = 0; const recommendations: string[] = [], scanDescriptions: string[] = [];
    stub.registeredCommands.set("soterai.chooseReviewedContext", () => { contextCalls++; return { status: "PREVIEWED" }; });
    t.mock.method(stub.window, "showQuickPick", async (items: any) => {
        picks++; recommendations.push(items[0].id); scanDescriptions.push(items.find((row: any) => row.id === "scan").description);
        return picks <= 2 ? items[0] : undefined;
    });
    assert.deepEqual(await run(), { status: "CANCELLED" }); assert.equal(picks, 3); assert.equal(contextCalls, 1);
    assert.deepEqual(recommendations, ["scan", "context", "tool"]); assert.match(scanDescriptions[1], /No detections/);
});
test("a finding recommends review and never opens its original file", async t => {
    const run = await fixture(t, "DB_PASSWORD=BlueMango7!"); let picks = 0, documents = 0; const recommendations: string[] = [];
    t.mock.method(stub.workspace, "openTextDocument", async () => { documents++; throw Error(); });
    t.mock.method(stub.window, "showQuickPick", async (items: any) => { recommendations.push(items[0].id); return ++picks === 1 ? items[0] : undefined; });
    assert.deepEqual(await run(), { status: "CANCELLED" }); assert.equal(documents, 0); assert.deepEqual(recommendations, ["scan", "vault"]);
});
test("injected choices and unsupported workspace cannot dispatch a workflow", async t => {
    const run = await fixture(t); let calls = 0;
    stub.registeredCommands.set("soterai.chooseReviewedContext", () => { calls++; });
    t.mock.method(stub.window, "showQuickPick", async () => ({ id: "context", label: "injected" }));
    assert.deepEqual(await run(), { status: "UNAVAILABLE" }); assert.equal(calls, 0);
    stub.state.isTrusted = false; assert.deepEqual(await run(), { status: "UNAVAILABLE" });
});
test("setup pauses to let the developer select source text without losing scan progress", async t => {
    const run = await fixture(t); let picks = 0;
    stub.registeredCommands.set("soterai.chooseReviewedContext", () => ({ status: "SELECTION_REQUIRED" }));
    t.mock.method(stub.window, "showQuickPick", async (items: any) => { picks++; return picks <= 2 ? items[0] : undefined; });
    assert.deepEqual(await run(), { status: "SELECTION_REQUIRED" }); assert.equal(picks, 2);
});
