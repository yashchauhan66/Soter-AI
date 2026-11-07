const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), home = __dirname, sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const fixture = 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts';
const sourceFile = path.join(home, 'native-source-inputs-03.json'), fullFile = path.join(home, 'full-inputs-02.json');
const source = json(sourceFile), full = json(fullFile), sourceFact = fact(sourceFile), fullFact = fact(fullFile);
if (sourceFact.sha256 !== 'f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab' || fullFact.sha256 !== '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322' || source.files.length !== 989 || full.files.length !== 989) throw Error('Input proof changed.');
const delta = source.files.filter((item, i) => item.path !== full.files[i].path || item.bytes !== full.files[i].bytes || item.sha256 !== full.files[i].sha256);
if (delta.length !== 1 || delta[0].path !== fixture || delta[0].sha256 !== 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741') throw Error('Non-fixture full-source delta refused.');
for (const item of source.files) { const current = fact(path.join(repo, item.path)); if (current.bytes !== item.bytes || current.sha256 !== item.sha256) throw Error('Current source drift: ' + item.path); }
function gate(name) { const file = path.join(home, name + '.txt'), receipt = json(file + '.result.json'); if (receipt.exitCode !== 0 || receipt.sha256.toLowerCase() !== fact(file).sha256) throw Error('Gate unavailable: ' + name); return { raw: fact(file), receipt: fact(file + '.result.json') }; }
const compiler = gate('compiler-14'), historicalFull = gate('full-tests-02'), build = gate('native-build-03');
const oldDriverFile = path.join(home, 'native-driver-provenance-02.json'), driverFile = path.join(home, 'native-driver-provenance-03.json');
const oldDrivers = json(oldDriverFile), drivers = json(driverFile), equality = [];
if (drivers.status !== 'BUILT_NOT_RUN_ESM_PARSER_INLINED' || drivers.drivers.length !== 21 || oldDrivers.drivers.length !== 21) throw Error('Current21driver provenance required.');
for (const item of drivers.drivers) {
 const current = fact(path.join(home, item.path)); if (current.bytes !== item.bytes || current.sha256 !== item.sha256) throw Error('Current driver bytes differ.');
 const old = oldDrivers.drivers.filter(entry => path.basename(entry.path) === path.basename(item.path)); if (old.length !== 1) throw Error('Driver membership changed.');
 const prior = fact(path.join(home, old[0].path)); if (prior.bytes !== old[0].bytes || prior.sha256 !== old[0].sha256) throw Error('Historical driver drift.');
 if (path.basename(item.path) !== 'lite-precommit-guard-host.js') { if (current.bytes !== prior.bytes || current.sha256 !== prior.sha256) throw Error('Affected driver byte drift.'); equality.push({ name: path.basename(item.path), before: prior, after: current }); }
}
if (equality.length !== 20) throw Error('Twenty unchanged affected drivers required.');
const inspection = json(path.join(home, 'vsix-inspection-01.json'));
for (const item of inspection.verifiedSourceInputs) { const current = fact(path.join(repo, item.path)); if (current.bytes !== item.bytes || current.sha256 !== item.sha256) throw Error('Bundled source drift: ' + item.path); }
const vsix = fact(path.join(repo, 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix'));
if (vsix.sha256 !== 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91' || vsix.bytes !== 1705050) throw Error('VSIX drift.');
const equalityFile = path.join(home, 'native-fixture-equivalence-03.json');
fs.writeFileSync(equalityFile, JSON.stringify({ status: 'NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED', time: new Date().toISOString(), sourceProof: sourceFact, fullSourceProof: fullFact, changedFixture: fixture, unchangedOtherInputs: 988, compiler, historicalFull, build, unchangedAffectedDrivers: 20, equality, bundledSourceInputsRechecked: inspection.verifiedSourceInputs.length, vsix, attribution: 'Full02 result remains on historical full02 freeze. Sole nativefixture literal corrected, fresh compiler14 and21driver03 build; twenty affected driver bytes and every packaged runtime source input remain exact. No native result reused.' }, null, 2) + '\n', { flag: 'wx' });
let hostGuard = fs.readFileSync(path.join(home, 'host-current-binding-01.ps1'), 'utf8');
hostGuard = hostGuard.split('full-inputs-02.json').join('native-source-inputs-03.json').split(fullFact.sha256).join(sourceFact.sha256)
 .split('native-driver-provenance-02.json').join('native-driver-provenance-03.json').split(fact(oldDriverFile).sha256).join(fact(driverFile).sha256);
hostGuard += '\n# Native-only fixture delta: full02 historical attribution; compiler14/driver03 and20affected byte equality required.\n'
 + "if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-fixture-equivalence-03.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '" + fact(equalityFile).sha256 + "'){throw 'Native fixture equivalence proof changed.'}\n";
fs.writeFileSync(path.join(home, 'host-current-binding-02.ps1'), hostGuard, { flag: 'wx' });
const result = { status: 'NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED', time: new Date().toISOString(), sourceProof: sourceFact, fullSourceProof: fullFact, fullReceipt: historicalFull.receipt, compilerReceipt: compiler.receipt, driverProvenance: fact(driverFile), unchangedOtherInputs: 988, changedFixture: fixture, unchangedAffectedDrivers: 20, vsix, equivalence: fact(equalityFile), hostBinding: fact(path.join(home, 'host-current-binding-02.ps1')) };
fs.writeFileSync(path.join(home, 'native-current-binding-03.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, unchanged: 988, exactAffectedDrivers: 20, currentBinding: fact(path.join(home, 'native-current-binding-03.json')) }));
