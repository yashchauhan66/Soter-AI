const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), home = __dirname, sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const priorFile = path.join(home, 'native-source-inputs-03.json'), prior = json(priorFile), changedPath = 'packages/vscode-extension/src/history-hooks/OwnerHookProtocol.ts';
const newPath = 'packages/vscode-extension/src/__tests__/ownerHookNativeEnvironment.review.test.ts';
assert.equal(prior.files.length, 989); const changes = [];
const files = prior.files.map(item => { const current = fact(path.join(repo, item.path)); if (current.bytes !== item.bytes || current.sha256 !== item.sha256) changes.push(item.path); return current; });
assert.deepEqual(changes, [changedPath]); assert(!files.some(item => item.path === newPath)); files.push(fact(path.join(repo, newPath))); files.sort((a, b) => a.path.localeCompare(b.path)); assert.equal(new Set(files.map(item => item.path)).size, 990);
const sourceBefore = fact(path.join(home, 'OwnerHookProtocol.before-native-environment-01.ts')), expectedBefore = prior.files.find(item => item.path === changedPath); assert.equal(sourceBefore.sha256, expectedBefore.sha256); assert.equal(sourceBefore.bytes, expectedBefore.bytes);
const testBefore = fact(path.join(home, 'ownerHookNativeEnvironment.review.test.ts.baseline-01.txt')); assert.equal(testBefore.sha256, files.find(item => item.path === newPath).sha256);
const gates = {};
for (const name of ['native-environment-before-01','native-environment-after-01']) {
 const file = path.join(home, name + '.txt'), receipt = json(file + '.result.json'); assert.equal(receipt.sha256.toLowerCase(), fact(file).sha256); assert.equal(receipt.exitCode, name.includes('before') ? 1 : 0); gates[name] = { raw: fact(file), receipt: fact(file + '.result.json') };
}
const value = { status: 'CURRENT990_PRODUCT_ENVIRONMENT_FIX_FULL_VERIFICATION_PENDING', time: new Date().toISOString(), fileCount: files.length, files, priorNativeProof: fact(priorFile), changedExistingPaths: changes, addedPaths: [newPath], unchangedExistingInputs: 988,
 productCorrection: { before: sourceBefore, after: files.find(item => item.path === changedPath), semantics: 'Admit only the captured genuine native process.env object despite its native prototype. Proxies/copied native prototypes/getters/unknown GIT selectors/path and key caps remain denied. Native Node and CodeNode before2FAIL/current2PASS included in focused70PASS; no IDE/hook evidence inferred.' }, test: testBefore, gates };
const output = path.join(home, 'full-inputs-04.json'); fs.writeFileSync(output, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
let entry = fs.readFileSync(path.join(home, 'run-full-tests-02.ps1'), 'utf8').split('full-inputs-02.json').join('full-inputs-04.json').split('full-tests-start-02.json').join('full-tests-start-03.json').split('full-tests-02.txt').join('full-tests-03.txt');
fs.writeFileSync(path.join(home, 'run-full-tests-03.ps1'), entry, { flag: 'wx' });
console.log(JSON.stringify({ proof: fact(output), files: files.length, changedExisting: 1, added: 1, focusedPass: 70 }));
