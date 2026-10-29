"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const ts = require("typescript"), esbuild = require("esbuild"), evidence = __dirname;
const input = path.join(evidence, "native-prepush-02.host.ts.txt"), source = fs.readFileSync(input, "utf8"), virtual = input.slice(0, -4);
const ast = ts.createSourceFile(virtual, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const parseErrors = ast.parseDiagnostics.map(d => ({ code: d.code, category: d.category, message: ts.flattenDiagnosticMessageText(d.messageText, " ") }));
const options = { noEmit: true, strict: true, skipLibCheck: true, esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10, types: ["node", "vscode"], lib: ["lib.es2022.d.ts"] };
const host = ts.createCompilerHost(options), getSource = host.getSourceFile.bind(host), exists = host.fileExists.bind(host), read = host.readFile.bind(host);
host.fileExists = name => path.resolve(name).toLowerCase() === virtual.toLowerCase() || exists(name);
host.readFile = name => path.resolve(name).toLowerCase() === virtual.toLowerCase() ? source : read(name);
host.getSourceFile = (name, language, onError, create) => path.resolve(name).toLowerCase() === virtual.toLowerCase() ? ts.createSourceFile(name, source, language, true) : getSource(name, language, onError, create);
const program = ts.createProgram([virtual], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({ code: d.code, category: d.category, line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
    message: ts.flattenDiagnosticMessageText(d.messageText, " ") }));
const transformed = esbuild.transformSync(source, { loader: "ts", target: "node22", format: "cjs", sourcefile: virtual });
// Do not write the transformed executable. This is a source-only admission gate.
let inPrimary = false, primary = 0, restart = 0; const cases = [];
for (const line of source.split(/\r?\n/)) {
    if (line.trim() === 'if (phase === "primary") {') inPrimary = true;
    if (line.trim() === '} else {') inPrimary = false;
    const match = /^\s*add\("([^"]+)"/.exec(line); if (match) { cases.push({ phase: inPrimary ? "primary" : "restart", scope: match[1] }); if (inPrimary) primary++; else restart++; }
}
assert.equal(primary, 30); assert.equal(restart, 6);
assert(!/\[\s*["'](?:push|fetch|clone|pull)["']/.test(source));
assert(!/\b(?:execFile|execSync|spawnSync|process\.kill|\.destroy|\.kill)\s*\(/.test(source));
assert(source.includes('configuredGitPush: "NOT_AUTHORIZED_NOT_RUN_REQUIRED_FOR_FEATURE_DONE"'));
assert(source.includes('status, "ACTUAL_F26B_PRIMARY_EDITOR_CLOSED"'));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const result = { status: diagnostics.length || parseErrors.length ? "FAIL_SOURCE_ONLY_NOT_EXECUTED" : "PASS_SOURCE_ONLY_NOT_EXECUTED_NO_DRIVER_EMIT", input: path.basename(input), bytes: Buffer.byteLength(source), sha256: sha(source),
    parseErrors, diagnostics, transformedInMemoryOnly: true, transformedSha256: sha(transformed.code), cases, expectedPrimary: primary, expectedRestart: restart,
    noExecutableWritten: true, noCodeLaunch: true, noGitPush: true, noNative09: true, observedAt: new Date().toISOString() };
fs.writeFileSync(path.join(evidence, "native-fixture-static-result-02.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ status: result.status, sourceSha256: result.sha256, expectedPrimary: primary, expectedRestart: restart, parseErrors, diagnostics }) + "\n");
if (diagnostics.length || parseErrors.length) process.exitCode = 1;
