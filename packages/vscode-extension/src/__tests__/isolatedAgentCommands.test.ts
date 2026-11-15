import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as stub from "./phase2/vscode-stub";
import { registerIsolatedAgentCommands, type IsolatedAgentDependencies } from "../isolated-agent/commands";
import { initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";

const IMAGE = "node:22@sha256:" + "a".repeat(64), REGISTERED = "TEST_ONLY_REGISTERED_ISOLATED_VALUE";
async function fixture(t: TestContext, changes: Partial<IsolatedAgentDependencies> = {}) {
    const directory = await mkdtemp(path.join(await realpath(tmpdir()), "soterai-isolated-ui-")), root = path.join(directory, "project"), profile = path.join(directory, "profile");
    await mkdir(root); await mkdir(profile); await writeFile(path.join(root, "app.js"), "console.log('original public code');\n");
    stub.resetState(root); const context = stub.makeExtensionContext(profile);
    initializeBoundaryState(context.workspaceState as never);
    const cancellation = new stub.EventEmitter<void>();
    let prepares = 0, runs = 0, modelCalls = 0, starts = 0, leaseDisposed = false, classification = "PUBLIC";
    const manager = { start: async () => { starts++; return { running: true }; }, ownedSnapshot: () => ({ state: "healthy", session: "synthetic-owner" }),
        requestIsolatedAgentModel: async () => { modelCalls++; return { choices: [{ message: { content: "Public response" } }] }; } };
    const deps: IsolatedAgentDependencies = {
        chooseFiles: async () => [stub.Uri.file(path.join(root, "app.js"))] as never,
        registry: { async createGatewayRegistry(enabled) { return { available: () => !leaseDisposed && enabled(),
            async use(consume) { assert.equal(enabled(), true); return consume([REGISTERED]); }, dispose() { leaseDisposed = true; } }; } },
        prepare: async input => {
            prepares++; assert.deepEqual(input.files, ["app.js"]); assert.deepEqual(input.registeredValues, [REGISTERED]);
            return Object.freeze({ schemaVersion: 1, image: input.image, model: input.model, snapshotSha256: "b".repeat(64), approvalSha256: "c".repeat(64),
                fileCount: 1, byteCount: 32, maxTurns: 8, scope: "Synthetic isolated task" });
        },
        run: async (proposal, approval, options) => {
            runs++; assert.equal(approval, proposal.approvalSha256); assert.equal(options.isCurrent(), true);
            await options.model({ model: "fixture", messages: [{ role: "user", content: "Public task" }], tools: [] }, options.signal!);
            return { status: "COMPLETE", code: "TASK_COMPLETED", isolationVerified: true, cleanupVerified: true, output: "Public coding task completed.",
                changedFiles: [{ path: "app.js", text: "console.log('reviewed public change');\n" }] };
        }, ...changes,
    };
    registerIsolatedAgentCommands(context as never, manager as never, { isEnabled: () => true,
        classifyIntegration: async () => classification } as never, deps);
    t.mock.method(stub.window, "showInputBox", async (options: any) => options.title.includes("Docker") ? IMAGE : options.title.includes("coding task") ? "Improve the public example" : "fixture");
    t.mock.method(stub.window, "showWarningMessage", async (_message: unknown, _options: unknown, action: string) => action);
    t.mock.method(stub.window, "withProgress", async (_options: unknown, task: any) => task({}, { isCancellationRequested: false, onCancellationRequested: cancellation.event }));
    t.after(() => context.subscriptions.forEach(item => item.dispose()));
    return { root, context, cancellation, deps, run: (...args: unknown[]) => stub.commands.executeCommand("soterai.runIsolatedAgent", ...args),
        review: () => stub.commands.executeCommand("soterai.reviewIsolatedAgentResult"), deny: () => { classification = "RESTRICTED"; },
        counts: () => ({ prepares, runs, modelCalls, starts, leaseDisposed }) };
}

test("reviewed isolated task uses host broker and publishes only a separately reviewed copy", async t => {
    const f = await fixture(t), result = await f.run();
    assert.equal((result as any).status, "COMPLETE"); assert.equal(stub.state.clipboard, "");
    assert.equal(await readFile(path.join(f.root, "app.js"), "utf8"), "console.log('original public code');\n");
    assert.deepEqual(f.counts(), { prepares: 1, runs: 1, modelCalls: 1, starts: 1, leaseDisposed: false });
    assert.deepEqual(await f.review(), { status: "COPIED" });
    assert.match(stub.state.clipboard, /reviewed public change/); assert.ok(!stub.state.clipboard.includes(REGISTERED));
    assert.ok(!JSON.stringify(result).includes("reviewed public change"));
});

test("restricted files and injected command proposals cannot start an isolated task", async t => {
    const f = await fixture(t);
    assert.deepEqual(await f.run({ approvalSha256: "injected" }), { status: "UNAVAILABLE" });
    f.deny(); assert.deepEqual(await f.run(), { status: "DENIED", code: "FILE_NOT_PUBLIC" });
    assert.deepEqual(f.counts(), { prepares: 0, runs: 0, modelCalls: 0, starts: 0, leaseDisposed: false });
});

test("cancelled proposal review starts neither broker nor guest and releases its registry", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => undefined);
    assert.deepEqual(await f.run(), { status: "CANCELLED" });
    assert.deepEqual(f.counts(), { prepares: 1, runs: 0, modelCalls: 0, starts: 0, leaseDisposed: true });
});

test("workspace trust changing during approval invalidates the proposed run", async t => {
    const f = await fixture(t); t.mock.method(stub.window, "showWarningMessage", async () => { stub.state.isTrusted = false; return "Run reviewed isolated task"; });
    assert.deepEqual(await f.run(), { status: "UNAVAILABLE" });
    assert.equal(f.counts().runs, 0); assert.equal(f.counts().starts, 0);
});

test("registered output and unverified cleanup never produce a reviewable result", async t => {
    for (const returned of [{ output: REGISTERED, cleanupVerified: true }, { output: "Public output", cleanupVerified: false }]) {
        const f = await fixture(t, { run: async () => ({ status: "COMPLETE", code: "TASK_COMPLETED", isolationVerified: true, changedFiles: [], ...returned }) });
        assert.equal((await f.run() as any).status, "DENIED"); assert.deepEqual(await f.review(), { status: "UNAVAILABLE" });
        assert.equal(stub.state.clipboard, "");
    }
});

test("edited result preview cannot be copied under the earlier review", async t => {
    const f = await fixture(t); await f.run();
    t.mock.method(stub.window, "showTextDocument", async (document: any) => { document.getText = () => "Altered preview"; return { document }; });
    assert.deepEqual(await f.review(), { status: "UNAVAILABLE" }); assert.equal(stub.state.clipboard, "");
});

test("guest cancellation signal reaches the runner before completion", async t => {
    let observed: AbortSignal | undefined, entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const f = await fixture(t, { run: async (_proposal, _approval, options) => {
        observed = options.signal; entered();
        await new Promise<void>(resolve => options.signal!.addEventListener("abort", () => resolve(), { once: true }));
        return { status: "UNAVAILABLE", code: "CANCELLED", isolationVerified: true, cleanupVerified: true };
    } });
    const work = f.run(); await started; f.cancellation.fire(); await work;
    assert.equal(observed?.aborted, true); assert.deepEqual(await f.review(), { status: "UNAVAILABLE" });
});
