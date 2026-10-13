// Restricted-review regressions use actual callback bodies with synthetic API adapters.
// No activation, host execution, real file contents, clipboard or network is used.
import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "node:vm";
import test, { mock } from "node:test";
import ts from "typescript";
import * as stub from "./phase2/vscode-stub";
import { confirmScopedChange } from "../security/ScopedConfirmation";
import { SensitiveContextPolicyEngine } from "../secret-broker/SensitiveContextPolicy";

function callback(file: string, name: string, bindings: Record<string, unknown>): (...args: any[]) => Promise<any> {
    const filename = join(__dirname, "..", file);
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.ES2022, true);
    let expression: string | undefined;
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === "vscode.commands.registerCommand"
            && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === name) expression = node.arguments[1].getText(source);
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) expression = node.initializer.getText(source);
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(source);
        ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(expression, `Actual ${name} callback must exist; absence is not a pass.`);
    const compiled = ts.transpileModule(`module.exports = (${expression});`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: undefined as unknown };
    new Script(compiled, { filename }).runInNewContext({ module, vscode: stub, ...bindings });
    assert.equal(typeof module.exports, "function");
    return module.exports as (...args: any[]) => Promise<any>;
}

for (const mode of ["disabled", "cancel", "withdraw-during-dialog", "confirmed"] as const) {
    test(`VD-01 unlock uses the actual scoped confirmation guard: ${mode}`, async () => {
        stub.resetState("C:/synthetic-review");
        stub.state.config.set("soterai.hardening.scopedConfirmation", mode !== "disabled");
        let unlocks = 0;
        const prompts: string[] = [];
        const dialog = mock.method(stub.window, "showWarningMessage", async (text: string) => {
            prompts.push(text);
            if (mode === "withdraw-during-dialog") stub.state.config.set("soterai.hardening.scopedConfirmation", false);
            return mode === "cancel" ? undefined : "Confirm this change";
        });
        try {
            await callback("extension.ts", "soterai.unlockProtection", {
                confirmScopedChange, protectionController: { async unlock() { unlocks++; } },
            })();
            assert.equal(unlocks, mode === "confirmed" ? 1 : 0);
            assert.equal(prompts.length, mode === "disabled" ? 0 : 1);
            prompts.forEach(text => assert.match(text, /not agent-proof/));
        } finally { dialog.mock.restore(); }
    });
}

test("VD-02 actual manual checker gives bounded public and high-risk recommendations", async () => {
    stub.resetState("C:/synthetic-review");
    const messages: string[] = [];
    const restores = ["showInformationMessage", "showWarningMessage", "showErrorMessage"].map(name =>
        mock.method(stub.window, name as "showInformationMessage", async (text: string) => { messages.push(text); return undefined; }));
    try {
        const presentDecision = callback("advanced/commands.ts", "presentDecision", { summarize: () => "Synthetic finding" });
        assert.equal(await presentDecision({ decision: "ALLOW", riskScore: 0 }, "selection"), true,
            "Positive public control must complete through the actual presentDecision function.");
        assert.equal(await presentDecision({ decision: "BLOCK", riskScore: 95 }, "selection"), false,
            "Negative high-risk control must withhold through the actual presentDecision function.");
        assert.equal(messages.length, 2, "Both controls must produce an actual decision notification.");
        assert.match(messages[0], /no recognized egress risk/);
        assert.match(messages[0], /unmarked private/);
        assert.match(messages[1], /manual check recommends withholding/);
        assert.match(messages[1], /does not intercept/);
        assert.doesNotMatch(messages.join("\n"), /blocked this send|is safe|Send Anyway/);
    } finally { restores.reverse().forEach(item => item.mock.restore()); }
});

test("project privacy withholds risky original overrides through the actual manual checker", async () => {
    stub.resetState("C:/synthetic-review");
    const dialog = mock.method(stub.window, "showWarningMessage", async () => "Keep Original");
    try {
        const presentDecision = callback("advanced/commands.ts", "presentDecision", { summarize: () => "Synthetic finding" });
        assert.equal(await presentDecision({ decision: "REDACT", riskScore: 70 }, "selection"), false);
        stub.state.config.set("soterai.projectPrivacy.enabled", false);
        assert.equal(await presentDecision({ decision: "REDACT", riskScore: 70 }, "selection"), true,
            "Rollback retains the legacy explicitly chosen override outside project privacy mode.");
    } finally { dialog.mock.restore(); }
});

test("project privacy overrides raw-reveal settings through the real policy adapter", async () => {
    stub.resetState("C:/synthetic-review");
    stub.state.config.set("soterai.sensitiveContext.allowRawReveal", true);
    // A class is both constructor and static adapter; the test lookup reads no actual project policy.
    class TestPolicy extends SensitiveContextPolicyEngine {
        static loadFromWorkspace() { return SensitiveContextPolicyEngine.parse({}); }
    }
    const actual = callback("secret-broker/commands.ts", "policyForCurrentWorkspace", { currentWorkspace: () => "", SensitiveContextPolicyEngine: TestPolicy });
    assert.equal((await actual()).canReveal(), false);
    stub.state.config.set("soterai.projectPrivacy.enabled", false);
    assert.equal((await actual()).canReveal(), true);
});

test("VD-02 actual file-scan callback does not certify safety or third-party enforcement", async () => {
    stub.resetState("C:/synthetic-review");
    const messages: string[] = [];
    const restores = ["showInformationMessage", "showWarningMessage", "showErrorMessage"].map(name =>
        mock.method(stub.window, name as "showInformationMessage", async (text: string) => { messages.push(text); return undefined; }));
    restores.push(mock.method(stub.workspace, "openTextDocument", async () => ({ getText: () => "public synthetic text" })) as any);
    try {
        let decision = "allow";
        const scan = callback("commands.ts", "scanFileHandler", {
            state: { engine: { async scan() { return { decision, findings: [], riskScore: decision === "allow" ? 0 : 95 }; } }, setScannedFile() {} },
            telemetry: { trackDetection() {} }, refreshViews() {}, updateDiagnostics() {},
        });
        await scan(stub.Uri.file("C:/synthetic-review/public.txt"));
        decision = "block";
        await scan(stub.Uri.file("C:/synthetic-review/public.txt"));
        assert.equal(messages.length, 2, "Both positive and high-risk controls must complete.");
        assert.match(messages[0], /no recognized critical findings/);
        assert.match(messages[0], /unmarked private/);
        assert.match(messages[1], /does not intercept/);
        assert.doesNotMatch(messages.join("\n"), /is safe|Safeguards active|blocked this send/);
    } finally { restores.reverse().forEach(item => item.mock.restore()); }
});

test("VD-03 retired marketplace artwork stays historical, excluded and unreferenced by release README", () => {
    const root = join(__dirname, "../..");
    const ignore = readFileSync(join(root, ".vscodeignore"), "utf8");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    assert.match(ignore, /^media\/marketplace\/\*\*$/m);
    assert.match(ignore, /^media\/screenshots\/\*\*$/m);
    assert.doesNotMatch(readme, /!\[[^\]]*\]\(https:\/\/soterai\.in\/marketplace\/screenshots\//);
    assert.match(readme, /Historical marketplace captures have been retired/);
    assert.ok(readFileSync(join(root, "media/marketplace/control-panel-protection.png")).length > 0,
        "Historical evidence must be preserved, not deleted to conceal a claim.");
});
