// Read-only shared gate. Unknown forthcoming facts remain unbound and refuse.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const home = __dirname, repo = path.resolve(home, '../../../..'), relativeHome = path.relative(repo, home).replace(/\\/g, '/');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const own = name => path.join(home, name), fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const PROTOCOL = 'packages/vscode-extension/src/history-hooks/OwnerHookProtocol.ts';
const REVIEW = 'packages/vscode-extension/src/__tests__/ownerHookNativeEnvironment.review.test.ts';
const FIXTURE = 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts';
const OUTPUT = 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt02.vsix';
function ordinary(file) {
    const full = path.resolve(file); assert(full.startsWith(repo + path.sep), 'Workspace input required.');
    let cursor = full;
    while (cursor.length >= repo.length) { assert(!fs.lstatSync(cursor).isSymbolicLink(), 'Linked build input refused.'); cursor = path.dirname(cursor); }
    return full;
}
function checkedFact(pin, expectedPath) {
    assert.equal(pin.path, expectedPath); assert(Number.isSafeInteger(pin.bytes) && pin.bytes >= 0);
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    const file = ordinary(path.join(repo, pin.path)), actual = fact(file); assert.deepEqual(actual, pin); return { file, raw: fs.readFileSync(file), fact: actual };
}
function gate(name, expectedFact) {
    const receiptFile = own(name + '.txt.result.json'), rawFile = own(name + '.txt');
    if (expectedFact) checkedFact(expectedFact, relativeHome + '/' + name + '.txt.result.json');
    const receipt = json(receiptFile), raw = fs.readFileSync(rawFile);
    assert.equal(receipt.exitCode, 0, 'Gate not passed: ' + name); assert.equal(receipt.file, 'node');
    assert.equal(path.resolve(receipt.output).toLowerCase(), rawFile.toLowerCase()); assert.equal(receipt.sha256.toLowerCase(), sha(raw));
    return { receipt: fact(receiptFile), raw: fact(rawFile), value: receipt, text: raw.toString('utf8') };
}
function check() {
    const binding = json(own('post-full04-binding.json'));
    assert.equal(binding.status, 'CURRENT_FULL03_COMPILER15_INPUTS04_BOUND');
    assert.equal(binding.outputVsix, OUTPUT); assert.equal(binding.fileCount, 990);
    const proofInput = checkedFact(binding.sourceProof, relativeHome + '/full-inputs-04.json');
    const proof = JSON.parse(proofInput.raw.toString('utf8').replace(/^\uFEFF/, ''));
    assert.equal(proof.fileCount, 990); assert.equal(proof.files.length, 990);
    const previousFile = own('native-source-inputs-03.json'), previousRaw = fs.readFileSync(previousFile);
    assert.equal(sha(previousRaw), 'f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab');
    const previous = json(previousFile), before = new Map(previous.files.map(row => [row.path, row]));
    assert.equal(before.size, 989); const current = new Map();
    for (const row of proof.files) {
        assert(typeof row.path === 'string' && !row.path.includes('\\') && !path.isAbsolute(row.path) && !row.path.split('/').includes('..'));
        assert(!current.has(row.path)); current.set(row.path, row);
        checkedFact(row, row.path);
    }
    const added = [...current.keys()].filter(file => !before.has(file)); const removed = [...before.keys()].filter(file => !current.has(file));
    const changed = [...before.keys()].filter(file => current.has(file) && (before.get(file).bytes !== current.get(file).bytes || before.get(file).sha256 !== current.get(file).sha256));
    assert.deepEqual(added, [REVIEW]); assert.deepEqual(removed, []); assert.deepEqual(changed, [PROTOCOL]);
    assert.equal(current.get(FIXTURE).sha256, 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741'); assert.equal(current.get(FIXTURE).bytes, 66256);
    const semantic = json(own('native-host-freeze-02.json'));
    assert.equal(fact(own('native-host-freeze-02.json')).sha256, '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a');
    assert.equal(semantic.sha256, current.get(FIXTURE).sha256); assert.equal(semantic.primary.length, 30); assert.equal(semantic.restart.length, 4);
    const compiler = gate('compiler-15', binding.compilerReceipt), full = gate('full-tests-03', binding.fullReceipt);
    assert.deepEqual(compiler.value.arguments, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'packages/vscode-extension/tsconfig.json']);
    assert.deepEqual(full.value.arguments, ['--import', 'tsx', '--test', '--test-concurrency=1', '../vscode-extension/src/__tests__/**/*.test.ts']);
    const summary = {};
    for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped']) {
        const rows = [...full.text.matchAll(new RegExp('^# ' + key + ' ([0-9]+)\\r?$', 'gm'))]; assert.equal(rows.length, 1, 'Full summary: ' + key); summary[key] = Number(rows[0][1]);
    }
    assert.deepEqual(summary, binding.expectedFullSummary); assert(summary.tests >= 4223); assert.equal(summary.fail, 0); assert.equal(summary.cancelled, 0);
    assert.equal(summary.skipped, 4); assert.equal(summary.pass + summary.skipped, summary.tests);
    return { binding: fact(own('post-full04-binding.json')), inputProof: { ...proofInput.fact, fileCount: 990 }, compiler: { receipt: compiler.receipt, raw: compiler.raw },
        full: { receipt: full.receipt, raw: full.raw, summary }, semanticFreeze: fact(own('native-host-freeze-02.json')),
        deltaFromNative03: { changed, added, removed, unchanged: 988 }, sourceFiles: proof.files, outputVsix: OUTPUT };
}
module.exports = { check, gate, fact, json, sha, own, repo, home, ordinary, OUTPUT };
if (require.main === module) { try { const value = check(); delete value.sourceFiles; console.log(JSON.stringify(value)); } catch (error) { console.error(error); process.exitCode = 1; } }
