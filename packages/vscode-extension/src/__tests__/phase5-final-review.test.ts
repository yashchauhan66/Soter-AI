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
        const showDecision = callback("advanced/commands.ts", "showDecision", { summarize: () => "Synthetic finding" });
        assert.equal(await showDecision({ decision: "ALLOW", riskScore: 0 }, "selection"), true);
        assert.equal(await showDecision({ decision: "BLOCK", riskScore: 95 }, "selection"), false);
        assert.match(messages[0], /no recognized egress risk/);
        assert.match(messages[0], /unmarked private/);
        assert.match(messages[1], /manual check recommends withholding/);
        assert.match(messages[1], /does not intercept/);
        assert.doesNotMatch(messages.join("\n"), /blocked this send|is safe|Send Anyway/);
    } finally { restores.reverse().forEach(item => item.mock.restore()); }
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
