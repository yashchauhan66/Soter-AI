// Defensive G6 regressions. All adapters are synthetic; no extension activation,
// host process, user profile, live network or real credential is used here.
import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "node:vm";
import test, { mock } from "node:test";
import ts from "typescript";
import * as stub from "./phase2/vscode-stub";
import * as coverageApi from "../security/CoverageDisclosure";
import { AutomaticIDEProtection, type SetupProgress } from "../protection/AutomaticIDEProtection";
import { deriveProtectionState, type ProtectionRuntimeFacts } from "../protection/ProtectionState";
import { BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { LedgerStore } from "../firewall/LedgerStore";
import { registerSecretBrokerCommands } from "../secret-broker/commands";
import { DEFAULT_SENSITIVE_CONTEXT_POLICY, SensitiveContextPolicyEngine } from "../secret-broker/SensitiveContextPolicy";
import { secretBrokerRuntime } from "../secret-broker/runtime";
import { registerLaunchCommands } from "../launchCommands";

const syntheticRoot = "C:/synthetic-phase5-coverage-workspace";
const facts: ProtectionRuntimeFacts = {
    enabled: true, workspaceTrusted: true, broker: "healthy", policy: "loaded",
    safeModeEnabled: true, protectedWorkspaceEnabled: true, sentinelEnabled: true,
    liveScanEnabled: true, mcpStrictModeEnabled: false, detectedAiTools: 1,
    protectedAiTools: 0, routingEvidence: "unknown",
};
const snapshot = () => ({ facts: { ...facts }, descriptor: deriveProtectionState(facts) });
type Restorable = { mock: { restore(): void } };

function setupFixture(enabled: boolean, accept: boolean) {
    stub.resetState(syntheticRoot);
    stub.state.config.set("soterai.hardening.coverageDisclosure", enabled);
    stub.state.config.set("soterai.mcpFirewall.strictMode", true);
    const writes: Array<{ section?: string; key: string; value: unknown }> = [];
    const prompts: string[] = [];
    const progress: SetupProgress[] = [];
    const originalConfiguration = stub.workspace.getConfiguration.bind(stub.workspace);
    const restores: Restorable[] = [mock.method(stub.workspace, "getConfiguration", (section?: string) => {
        const config = originalConfiguration(section);
        return {
            ...config,
            async update(key: string, value: unknown) {
                writes.push({ section, key, value });
                await config.update(key, value);
            },
        };
    })];
    const respond = async (message: string) => {
        stub.recordSink("notification", "synthetic-coverage-dialog", message);
        if (message.includes("Covers:") && message.includes("Does not cover:")) {
            prompts.push(message);
            return accept ? "Review scoped setup" : "Cancel";
        }
        return undefined;
    };
    restores.push(mock.method(stub.window, "showInformationMessage", respond));
    restores.push(mock.method(stub.window, "showWarningMessage", respond));
    let controllerCalls = 0;
    let routingCalls = 0;
    const controller = {
        lockdown: { active: false },
        async enableFullProtection() {
            controllerCalls++;
            await stub.workspace.getConfiguration("soterai").update("protection.enabled", true);
            return { snapshot: snapshot(), completed: ["synthetic managed check"], limitations: ["Synthetic adapter; agent routes UNTESTED"] };
        },
    };
    const service = new AutomaticIDEProtection({
        controller,
        routeTools: async () => {
            routingCalls++;
            return { status: "unchanged", changedConfigs: 0, verifiedTools: 0, failedTools: 0, unsupportedConfigs: 0 };
        },
        refresh: async () => snapshot(),
    });
    return {
        service, controller, writes, prompts, progress,
        calls: () => ({ controllerCalls, routingCalls }),
        dispose: () => restores.reverse().forEach(item => item.mock.restore()),
    };
}

/** Execute only the real callback: full activate() would introduce unrelated IO.
 * This is a unit adapter, not host/entry-point integration evidence. */
function directFullHandler(controller: ReturnType<typeof setupFixture>["controller"]): () => Promise<void> {
    const filename = join(__dirname, "..", "extension.ts");
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.ES2022, true);
    let callback: ts.Expression | undefined;
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === "vscode.commands.registerCommand"
            && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "soterai.enableFullProtection") {
            callback = node.arguments[1];
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(callback, "The real direct setup registration must exist; absence is not a security pass.");
    const compiled = ts.transpileModule(`module.exports = (${callback.getText(source)});`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: undefined as unknown };
    new Script(compiled, { filename }).runInNewContext({ module, vscode: stub, protectionController: controller, ...coverageApi });
    assert.equal(typeof module.exports, "function", "The direct setup callback adapter must load.");
    return module.exports as () => Promise<void>;
}

function successMessages(): string[] {
    return stub.sinks.filter(item => item.sink === "notification" && /(?:Full Protection configured|setup verified|controls configured|setup complete|fully enforced)/i.test(item.text))
        .map(item => item.text);
}

for (const mode of ["flag disabled", "disclosure rejected"] as const) {
    test(`G6 automatic setup: ${mode} means no controller calls, setting writes or success`, async () => {
        const target = setupFixture(mode !== "flag disabled", false);
        try {
            const result = await target.service.run(update => target.progress.push(update));
            assert.deepEqual({ ...target.calls(), writes: target.writes, ready: result.status === "ready",
                completeStages: target.progress.filter(item => item.status === "complete"), success: successMessages() },
            { controllerCalls: 0, routingCalls: 0, writes: [], ready: false, completeStages: [], success: [] });
        } finally { target.dispose(); }
    });
    test(`G6 direct full setup: ${mode} means no controller calls, setting writes or success`, async () => {
        const target = setupFixture(mode !== "flag disabled", false);
        try {
            await directFullHandler(target.controller)();
            assert.deepEqual({ ...target.calls(), writes: target.writes, success: successMessages() },
                { controllerCalls: 0, routingCalls: 0, writes: [], success: [] });
        } finally { target.dispose(); }
    });
}

test("G6 automatic positive control: accepted disclosure permits synthetic managed setup", async () => {
    const target = setupFixture(true, true);
    try {
        const result = await target.service.run();
        assert.equal(target.calls().controllerCalls, 1);
        assert.equal(target.calls().routingCalls, 1);
        assert.ok(target.writes.some(item => item.key === "broker.autoStart" && item.value === true));
        assert.equal(result.status, "attention", "Unknown route evidence must not become full verification.");
    } finally { target.dispose(); }
});

test("G6 direct full positive control: accepted disclosure reaches the synthetic controller", async () => {
    const target = setupFixture(true, true);
    try {
        await directFullHandler(target.controller)();
        assert.equal(target.calls().controllerCalls, 1);
        assert.ok(target.writes.some(item => item.key === "protection.enabled" && item.value === true));
    } finally { target.dispose(); }
});

test("G6 flag withdrawal during either entry-point disclosure prevents subsequent mutations", async () => {
    for (const entry of ["automatic", "direct"] as const) {
        const target = setupFixture(true, true);
        const withdraw = mock.method(stub.window, "showInformationMessage", async (message: string) => {
            assert.match(message, /Covers:/);
            stub.state.config.set("soterai.hardening.coverageDisclosure", false);
            return "Review scoped setup";
        });
        try {
            if (entry === "automatic") await target.service.run();
            else await directFullHandler(target.controller)();
            assert.deepEqual({ ...target.calls(), writes: target.writes, success: successMessages() },
                { controllerCalls: 0, routingCalls: 0, writes: [], success: [] });
        } finally { withdraw.mock.restore(); target.dispose(); }
    }
});

test("G6 local handling report preserves unmarked, same-user and provider-routing limits", async () => {
    stub.resetState(syntheticRoot);
    const context = stub.makeExtensionContext(syntheticRoot);
    registerLaunchCommands(context as never);
    try {
        await stub.commands.executeCommand("soterai.openPrivacyGuarantee");
        const report = stub.sinks.filter(item => item.sink === "untitled-document").map(item => item.text).join("\n");
        assert.match(report, /SoterAI detector scans run locally/);
        assert.match(report, /unmarked private information/i);
        assert.match(report, /Other tools can read original files/);
        assert.match(report, /Routed AI requests can reach/);
        assert.match(report, /not agent-proof/);
        assert.match(report, /UNTESTED/);
        assert.doesNotMatch(report, /Raw secrets stay on the user's machine|The model sees placeholders and safe metadata, not raw sensitive values/);
    } finally { context.subscriptions.forEach(item => item.dispose()); }
});

async function withSecretCommands<T>(run: () => Promise<T>, selection?: string): Promise<T> {
    stub.resetState(syntheticRoot);
    const context = stub.makeExtensionContext(syntheticRoot);
    const restores: Restorable[] = [
        mock.method(LedgerStore, "append", async () => {}),
        mock.method(SensitiveContextPolicyEngine, "loadFromWorkspace", () => structuredClone(DEFAULT_SENSITIVE_CONTEXT_POLICY)),
    ];
    if (selection !== undefined) {
        const document = stub.makeDocument(stub.Uri.file(`${syntheticRoot}/public-example.txt`), selection);
        const range = new stub.Selection(document.positionAt(0), document.positionAt(selection.length));
        stub.state.activeEditor = { document, selection: range, selections: [range] };
        restores.push(mock.method(BoundarySnapshot, "load", async () => ({
            blocks: () => false, read: async () => selection, selection: () => selection,
        }) as never));
    }
    registerSecretBrokerCommands(context as never, () => {});
    try { return await run(); }
    finally {
        secretBrokerRuntime.enforcedApi.revokeAll();
        await secretBrokerRuntime.refs.clear();
        context.subscriptions.forEach(item => item.dispose());
        restores.reverse().forEach(item => item.mock.restore());
    }
}

const publicText = "SYNTHETIC_PUBLIC_RELEASE_NOTE: version 12 is ready.";
const unmarkedText = "Synthetic private purchase plan: buy nineteen apricot crates on Thursday.";
const fakeKey = "sk-proj-" + "FAKEcoverageCredential73921".repeat(3);
const promptInput = `${publicText}\n${unmarkedText}\nOPENAI_API_KEY=${fakeKey}`;
async function generatedPrompt(): Promise<string> {
    return withSecretCommands(async () => {
        await stub.commands.executeCommand("soterai.buildSafePromptForAI");
        assert.ok(stub.sinks.some(item => item.sink === "clipboard"), "The real prompt command must produce output.");
        return stub.state.clipboard;
    }, promptInput);
}

test("G6 prompt positive control: public text remains and a recognized fake credential is replaced", async () => {
    const prompt = await generatedPrompt();
    assert.ok(prompt.includes(publicText));
    assert.ok(prompt.includes(unmarkedText), "This fixture establishes the unmarked-data limitation.");
    assert.ok(!prompt.includes(fakeKey));
    assert.match(prompt, /SECRET_REF|REDACTED_|BLOCKED_/);
});

test("G6 generated prompt states unmarked-data limits without an unconditional privacy proof", async () => {
    const prompt = await generatedPrompt();
    assert.doesNotMatch(prompt, /Privacy proof:|Raw secrets sent to AI:\s*no|AI gets the context, not the secret/i);
    assert.match(prompt, /unmarked.*private|private.*unmarked|unrecognized.*sensitive/i);
});

async function capabilityDemo(): Promise<string> {
    return withSecretCommands(async () => {
        await stub.commands.executeCommand("soterai.testProtection");
        const rendered = stub.sinks.filter(item => item.sink === "webview.html").map(item => item.text).join("\n");
        assert.ok(rendered, "The real synthetic capability command must render a result.");
        return rendered;
    });
}

test("G6 synthetic capability positive control: authorized and denied scope checks actually run", async () => {
    const html = await capabilityDemo();
    for (const label of ["Approved host + method + path", "Wrong host", "Replay past use limit", "After revocation"]) assert.ok(html.includes(label));
    assert.doesNotMatch(html, /UNEXPECTED/);
    assert.match(html, /confirmed/);
});

test("G6 synthetic capability result labels simulation and does not claim deployed verified protection", async () => {
    const html = await capabilityDemo();
    assert.doesNotMatch(html, /Verified protected|Reproducible local proof|outbound Authorization header/i);
    assert.match(html, /synthetic/i);
    assert.match(html, /simulat|mock|in.process/i);
    assert.match(html, /UNTESTED/);
});
