'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(path.join(repo,'packages/vscode-extension/src/logs/LogController.ts')));assert(!fs.existsSync(path.join(repo,'packages/vscode-extension/src/logs/commands.ts')));
const file=path.join(repo,'packages/vscode-extension/src/__tests__/logController.test.ts'),original=fs.readFileSync(file);assert.equal(sha(original),'ddbe4fbbabcca3664c72e435e777afa538b2833256f5916c9d48e65ba5096482');let text=original.toString('utf8');
text=text.replace('TEST_ONLY_F25_ARTIFACT_CONTROLLER_PRIVATE_2ed4b967','TEST_ONLY_F25_LOG_CONTROLLER_PRIVATE_2ed4b967');
text=text.replace("const SOURCE = 'const API_KEY = \"' + PRIVATE + '\";\\nexport const PORT = 3000;\\n';","const SOURCE = 'Expected synthetic test failure\\nAPI_KEY=' + PRIVATE + '\\n    at public-test.cjs:7:3\\n';");
assert(text.includes('Expected synthetic test failure'));
text=text.replace('assert.equal(f.reads.length, 0); assert.equal(f.analyzers(), 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); await emptyLedger(f);','assert.equal(f.discovery.length, 0); assert.equal(f.reads.length, 0); assert.equal(f.analyzers(), 0); assert.equal(await f.context.secrets.get(HYGIENE_LEDGER_KEY), undefined); await emptyLedger(f);');
text=text.replace('const current = await f.ledger.createAnalyzer(f.rootUri), history = await f.ledger.createAnalyzer(f.rootUri, "history-v1");','const current = await f.ledger.createAnalyzer(f.rootUri), history = await f.ledger.createAnalyzer(f.rootUri, "history-v1"), artifact = await f.ledger.createAnalyzer(f.rootUri, "artifact-v1");');
text=text.replace('[current.analyzeSource(input), history.analyzeSource(input)]','[current.analyze(input), history.analyze(input), artifact.analyze(input)]');text=text.replace('current.dispose(); history.dispose();','current.dispose(); history.dispose(); artifact.dispose();');
const start=text.indexOf('test("F25 discovery admits generated directories'),end=text.indexOf('test("F25 public log control',start);assert(start>=0&&end>start);
const meaningful=String.raw`test("F25 saved logs in generated folders and renamed retained reports exclude Git objects and dependencies", async t => {
    const f = await fixture(t); approve(t);
    for (const file of ["dist/old.log", "build/failure.out", "coverage/failure.tap", ".next/test.log", ".cache/run.err", "caches/retained.log", "renamed.snapshot"]) await f.put(file, SOURCE);
    await f.put(".git/objects/private.txt", "PASSWORD=" + PRIVATE + "\n"); await f.put("node_modules/private.log", SOURCE);
    const value = await f.controller.review(); assert.equal(value.status, "ANALYZED"); assert.equal(value.files, 7); assert.equal(value.findings.length, 7); safe(value);
    assert(f.reads.every(file => !file.includes(join(".git", "objects")) && !file.includes("node_modules"))); assert.equal(f.opened(), 0);
});

test("F25 nested JSONL failure strings remain private and reference-looking locations are never followed", async t => {
    const f = await fixture(t); approve(t);
    await f.put("test-results/failure.jsonl", JSON.stringify({ failure: { message: SOURCE }, file: "log-private-source.ts", sourceRoot: "../../private-reference" }) + "\n");
    const value = await f.controller.review(); assert.equal(value.status, "ANALYZED"); assert.equal(value.files, 1); assert.equal(value.findings.length, 1); safe(value);
    assert(f.privateInputs.some(input => input.text === SOURCE)); assert(f.reads.every(file => !file.includes("private-reference") && !file.endsWith("log-private-source.ts")));
    assert.equal(f.opened(), 0);
});

test("F25 malformed late JSONL records and binary saved logs withhold earlier private candidates atomically", async t => {
    const f = await fixture(t); approve(t);
    await f.put("test-results/broken.jsonl", JSON.stringify({ message: SOURCE }) + '\n{"failure":"unterminated');
    await f.put("logs/binary.log", Buffer.from([0, 1, 2, 255]));
    const value = await f.controller.review(); assert(["PARTIAL", "UNAVAILABLE"].includes(value.status)); assert.equal(value.findings?.length ?? 0, 0); safe(value); await emptyLedger(f);
});

`;
text=text.slice(0,start)+meaningful+text.slice(end);
text=text.replace('await f.put("logs/public.log", "export const PORT = 3000;\\n");','await f.put("logs/public.log", "TAP version 13\\nnot ok 1 - public assertion\\nError: public failure\\n    at public-test.cjs:3:1\\n1..1\\n");');
text=text.replace('test("F25 log source findings use a disjoint key domain from current-file and historical analysis"','test("F25 saved-log findings use a disjoint key domain from current-file historical and artifact analysis"');
assert(!text.includes('source-map embedded')&&!text.includes('malformed maps')&&!text.includes('ARTIFACT_CONTROLLER'));
fs.writeFileSync(path.join(__dirname,'logController-protocol-03.test.ts'),text,{flag:'wx'});fs.writeFileSync(file,text);
const commandFile=path.join(repo,'packages/vscode-extension/src/__tests__/logCommands.test.ts'),commandOriginal=fs.readFileSync(commandFile);assert.equal(sha(commandOriginal),'65b13a28d9da5cb431a1eb6b7545d9b030e9c52cf00fc1a7c509353287360501');
const command=commandOriginal.toString('utf8').replace('Bounded local saved logs and copied source; heuristic possible exposure and manual cleanup only.','Bounded local saved logs and test failure reports; keyed heuristic possible exposure and reviewed manual cleanup only.');
fs.writeFileSync(path.join(__dirname,'logCommands-protocol-03.test.ts'),command,{flag:'wx'});fs.writeFileSync(commandFile,command);
fs.writeFileSync(path.join(__dirname,'controller-protocol-correction-03.json'),JSON.stringify({status:'PRE_PRODUCTION_LOG_FIXTURE_CORRECTION_NOT_TEST_WEAKENING',before:{controller:sha(original),commands:sha(commandOriginal)},after:{controller:sha(Buffer.from(text)),commands:sha(Buffer.from(command))},changes:['Source-code/map fixtures replaced by saved failure/TAP/plain/JSONL logs','No reference reads and malformed late-record atomic withholding remain required','Native cancellation additionally requires zero discovery','Default/history/artifact versus logs HMAC separation','All original assertions and new meaningful assertions retain their bounds/timeouts/privacy requirements'],originalSnapshot:'prepared-test-originals-01',productionStillAbsent:true},null,2),{flag:'wx'});
console.log(JSON.stringify({status:'CORRECTED_PRE_PRODUCTION_LOG_TEST_PROTOCOL',controller:sha(Buffer.from(text)),commands:sha(Buffer.from(command))}));
