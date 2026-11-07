// Bind newly observed F26a facts into new owned copies; never alter prepared or historical evidence.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const home = __dirname, repo = path.resolve(home, '../../../..');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const gates = {};
for (const name of ['compiler-13','full-tests-02','backend-typecheck-01','backend-tests-01','native-build-01','package-01','post-full-gates-01']) {
 const file = path.join(home, name + '.txt'), receipt = read(file + '.result.json');
 if (receipt.exitCode !== 0 || sha(fs.readFileSync(file)) !== receipt.sha256.toLowerCase()) throw Error('Gate not current PASS: ' + name);
 gates[name] = { raw: fact(file), receipt: fact(file + '.result.json'), exitCode: receipt.exitCode };
}
const fullRaw = fs.readFileSync(path.join(home, 'full-tests-02.txt'), 'utf8');
if (!/^# tests 4221\r?$/m.test(fullRaw) || !/^# pass 4217\r?$/m.test(fullRaw) || !/^# fail 0\r?$/m.test(fullRaw) || !/^# skipped 4\r?$/m.test(fullRaw)) throw Error('Actual full counts differ.');
const proofFile = path.join(home, 'full-inputs-02.json'), proof = read(proofFile);
if (sha(fs.readFileSync(proofFile)) !== '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322' || proof.files.length !== 989) throw Error('Full freeze differs.');
for (const entry of proof.files) { const current = fact(path.join(repo, entry.path)); if (current.bytes !== entry.bytes || current.sha256 !== entry.sha256) throw Error('Frozen input drift: ' + entry.path); }
const packageRaw = fs.readFileSync(path.join(home, 'package-01.txt'), 'utf8');
const packaged = packageRaw.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line)).find(item => item.status === 'PACKAGED_NOT_HOST_VERIFIED');
if (!packaged || packaged.sha256 !== 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91' || packaged.extensionSha256 !== 'f1611d1d7931288560e1dc9342cfcd4541d6f1ee5a3b8642c6303f1883b58184') throw Error('Package receipt differs.');
const vsix = fact(path.join(repo, packaged.output)), basename = path.basename(packaged.output);
if (vsix.bytes !== packaged.bytes || vsix.sha256 !== packaged.sha256) throw Error('Actual VSIX differs.');
const driverFile = path.join(home, 'native-driver-provenance-02.json'), drivers = read(driverFile);
if (drivers.status !== 'BUILT_NOT_RUN_ESM_PARSER_INLINED' || drivers.drivers.length !== 21) throw Error('Driver provenance differs.');
for (const entry of drivers.drivers) { const current = fact(path.join(home, entry.path)); if (current.bytes !== entry.bytes || current.sha256 !== entry.sha256) throw Error('Built driver drift.'); }
const replacements = {
 '__F26A_TEMPLATE_BOUND__': 'F26A_CURRENT_FACTS_BOUND',
 '__F26A_VSIX_BASENAME__': basename,
 '__F26A_FULL02_RECEIPT_SHA256__': gates['full-tests-02'].receipt.sha256,
 '__F26A_DRIVER02_PROVENANCE_SHA256__': fact(driverFile).sha256,
 '__F26A_HOST_REVIEW_SHA256__': fact(path.join(home, 'host-version-review-01.json')).sha256,
};
const outputs = [];
for (const [input, output] of [ ['inspect-vsix-03.template.ps1','inspect-vsix-01.ps1'], ['artifact-binding-03.template.ps1','artifact-binding-01.ps1'], ['host-current-binding-01.template.ps1','host-current-binding-01.ps1'] ]) {
 let source = fs.readFileSync(path.join(home, input), 'utf8');
 for (const [key, value] of Object.entries(replacements)) source = source.split(key).join(value);
 if (/__F26A_[A-Z0-9_]+__/.test(source)) throw Error('Unbound template marker: ' + output);
 fs.writeFileSync(path.join(home, output), source, { flag: 'wx' });
 outputs.push({ input: fact(path.join(home, input)), output: fact(path.join(home, output)) });
}
fs.writeFileSync(path.join(home, 'current-gate-binding-01.json'), JSON.stringify({ status: 'CURRENT_CHECKED_FACTS_BOUND_NOT_CONTENT_OR_NATIVE_VERIFIED', time: new Date().toISOString(), gates, source: fact(proofFile), sourceCount: proof.files.length, full: { tests: 4221, pass: 4217, fail: 0, skip: 4 }, vsix, driverProvenance: fact(driverFile), outputs }, null, 2) + '\n', { flag: 'wx' });
console.log('Actual current compiler/full/backend/build/package facts checked; three new helpers bound. Content/native pending.');
