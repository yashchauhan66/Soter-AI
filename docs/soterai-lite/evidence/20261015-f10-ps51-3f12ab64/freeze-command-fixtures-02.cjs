"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const ts = require("../../../../node_modules/typescript");
const root = path.resolve(__dirname, "../../../.."), fixture = "packages/vscode-extension/src/__tests__/checkedPowerShellCommands.test.ts";
const bytes = fs.readFileSync(path.join(root, fixture)), source = ts.createSourceFile(fixture, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw new Error("Fixture has TypeScript parse diagnostics.");
const declarations = [];
function unwrap(node) { return ts.isAsExpression(node) || ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node; }
function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "test") {
        let count = 1;
        for (let parent = node.parent; parent; parent = parent.parent) if (ts.isForOfStatement(parent)) {
            const items = unwrap(parent.expression); if (!ts.isArrayLiteralExpression(items)) throw new Error("Uncounted dynamic fixture loop."); count *= items.elements.length;
        }
        declarations.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, titleExpression: node.arguments[0].getText(source), expandedTests: count });
    }
    ts.forEachChild(node, visit);
}
visit(source);
const expandedTests = declarations.reduce((sum, declaration) => sum + declaration.expandedTests, 0);
if (declarations.length !== 30 || expandedTests !== 42) throw new Error("Unexpected commands fixture inventory.");
const result = { schemaVersion: 1, fixture, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), parseDiagnostics: 0,
    declarations: declarations.length, expandedTests, inventory: declarations,
    correction: "Unexecuted C07 helper default parameter replaced with rest tuple, distinguishing omitted bridge from explicit undefined. No assertion removed; explicit absent bridge now reaches production unchanged.",
    baselineTarget: "packages/vscode-extension/src/terminal/commands.ts", targetExistsAtFreeze: fs.existsSync(path.join(root, "packages/vscode-extension/src/terminal/commands.ts")),
    scope: "Static fixture freeze; compiler and runtime result not inferred. Retained synthetic directories; no production edits, shell launches or profile changes.", command: "node docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/freeze-command-fixtures-02.cjs", observedAt: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, "command-fixtures-freeze-02.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ fixture, sha256: result.sha256, declarations: result.declarations, expandedTests, targetExistsAtFreeze: result.targetExistsAtFreeze }) + "\n");
