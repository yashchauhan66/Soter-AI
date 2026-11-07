// Prepared evidence authoring only. Root supplies the exact new binding hash
// after actual build03 + twenty-driver equality. This never launches anything.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name), relative = file => path.relative(repo, file).replace(/\\/g, '/');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const parse = raw => JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
function fact(file) { const raw = fs.readFileSync(file); return { path: relative(file), bytes: raw.length, sha256: sha(raw) }; }
function checked(row, expected) {
 assert(row && row.path === expected && /^[a-f0-9]{64}$/.test(row.sha256) && Number.isInteger(row.bytes));
 const file = path.resolve(repo, row.path); assert(file.startsWith(repo + path.sep)); assert.deepEqual(fact(file), row); return parse(fs.readFileSync(file));
}
function gate(row, expected) {
 const receipt = checked(row, expected); assert.equal(receipt.exitCode, 0); const rawFile = path.resolve(repo, expected.replace(/\.result\.json$/, ''));
 assert.equal(sha(fs.readFileSync(rawFile)), receipt.sha256.toLowerCase()); return receipt;
}
function replace(text, needle, value) { const count = text.split(needle).length - 1; assert(count > 0, 'Missing exact predecessor anchor: ' + needle); return text.split(needle).join(value); }
assert.equal(process.argv.length, 3, 'Supply the externally checked native-current-binding03 SHA256.');
const expectedBinding = process.argv[2]; assert.match(expectedBinding, /^[a-f0-9]{64}$/);
const bindingFile = own('native-current-binding-03.json'), bindingRaw = fs.readFileSync(bindingFile); assert.equal(sha(bindingRaw), expectedBinding);
const binding = parse(bindingRaw), prefix = relative(__dirname) + '/';
assert.equal(binding.status, 'NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED'); assert.equal(binding.unchangedOtherInputs, 988); assert.equal(binding.unchangedAffectedDrivers, 20);
assert.equal(binding.changedFixture, 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts');
const native = checked(binding.sourceProof, prefix + 'native-source-inputs-03.json');
assert.equal(binding.sourceProof.sha256, 'f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab'); assert.equal(native.fileCount, 989); assert.equal(native.files.length, 989);
const fullProof = checked(binding.fullSourceProof, prefix + 'full-inputs-02.json'); assert.equal(binding.fullSourceProof.sha256, '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322');
const prior = new Map(fullProof.files.map(row => [row.path, row]));
const changed = native.files.filter(row => { assert(prior.has(row.path)); const before = prior.get(row.path); return row.bytes !== before.bytes || row.sha256 !== before.sha256; }).map(row => row.path);
assert.deepEqual(changed, [binding.changedFixture]);
gate(binding.compilerReceipt, prefix + 'compiler-14.txt.result.json'); assert.equal(binding.compilerReceipt.sha256, '4f78702568234099b8b827d30b929208c4c58b2464482f6ce22cfbb0bf5d8ddd');
gate(binding.fullReceipt, prefix + 'full-tests-02.txt.result.json'); assert.equal(binding.fullReceipt.sha256, '2cfdcf7e1cf975b01dd73a0e2093452e0513d18e836b15ca2af91cb0822ad859');
checked(binding.equivalence, prefix + 'native-fixture-equivalence-03.json');
assert.equal(binding.hostBinding.path, prefix + 'host-current-binding-02.ps1'); assert.deepEqual(fact(own('host-current-binding-02.ps1')), binding.hostBinding);
assert.equal(binding.vsix.path, 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix'); assert.deepEqual(fact(path.join(repo, binding.vsix.path)), binding.vsix);
assert.equal(binding.vsix.sha256, 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91');
const built = checked(binding.driverProvenance, prefix + 'native-driver-provenance-03.json');
assert.equal(built.status, 'BUILT_NOT_RUN_ESM_PARSER_INLINED'); assert.equal(built.drivers.length, 21); assert.equal(built.unchangedDriverCount, 20);
assert.equal(built.inputProof.sha256, binding.sourceProof.sha256); assert.equal(built.priorFullInputProof.sha256, binding.fullSourceProof.sha256);
assert.equal(built.compiler.sha256, binding.compilerReceipt.sha256); assert.equal(built.full.sha256, binding.fullReceipt.sha256);
assert.equal(built.driverComparisons.length, 21); assert.equal(built.driverComparisons.filter(row => row.name !== 'lite-precommit-guard-host.js' && row.bytesIdentical === true).length, 20);
for (const row of built.drivers) { assert.match(row.path, /^prebuilt-native-hosts-03\/lite-[a-z0-9-]+-host[.]js$/); assert.deepEqual(fact(own(row.path)), { path: prefix + row.path, bytes: row.bytes, sha256: row.sha256 }); }
const driver = built.drivers.find(row => row.path === 'prebuilt-native-hosts-03/lite-precommit-guard-host.js'); assert(driver);
const freezeFile = own('native-host-freeze-02.json'), freezeRaw = fs.readFileSync(freezeFile), freeze = parse(freezeRaw);
assert.equal(sha(freezeRaw), '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a');
assert.equal(freeze.sha256, 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741'); assert.equal(freeze.primary.length, 30); assert.equal(freeze.restart.length, 4);
const oldLauncherFile = own('run-precommit-native-02.ps1'), oldOfflineFile = own('precommit-offline-owner-01.cjs');
const launcherRaw = fs.readFileSync(oldLauncherFile), offlineRaw = fs.readFileSync(oldOfflineFile);
let launcher = launcherRaw.toString('utf8'), offline = offlineRaw.toString('utf8');
const oldDriver = 'd126f808fd018fa34b62570cc94be6c322eecbf824426b7c8266648082450cdd';
launcher = replace(launcher, oldDriver, driver.sha256); launcher = replace(launcher, '69660', String(driver.bytes));
launcher = replace(launcher, 'prebuilt-native-hosts-02/lite-precommit-guard-host.js', driver.path);
launcher = replace(launcher, 'native-host-freeze-01.json', 'native-host-freeze-02.json');
launcher = replace(launcher, '090ee2ae998f18b44456dbd63727be2e9f4d8e4dc04ca5bc1c96767a0ad03e6e', sha(freezeRaw));
launcher = replace(launcher, '91f6823b50b6c36aa5c8d277386978d3f92e15251c9f7ab2194d31ecc35b636d', freeze.sha256);
launcher = replace(launcher, 'native-driver-provenance-02.json', 'native-driver-provenance-03.json');
launcher = replace(launcher, 'fc7d56817bec6fe869cf2819ed833c77ac70695d6aff043e40a6245bafcbc2f6', binding.driverProvenance.sha256);
launcher = replace(launcher, 'host-current-binding-01.ps1', 'host-current-binding-02.ps1');
launcher = replace(launcher, 'precommit-offline-owner-01.cjs', 'precommit-offline-owner-03.cjs');
offline = replace(offline, oldDriver, driver.sha256);
const nativeChecks = `function Assert-F26ANative03Binding {\r\n Assert-F26AFile (Join-Path $PSScriptRoot 'native-current-binding-03.json') '${expectedBinding}' ${bindingRaw.length}\r\n Assert-F26AFile (Join-Path $PSScriptRoot 'native-source-inputs-03.json') '${binding.sourceProof.sha256}' ${binding.sourceProof.bytes}\r\n Assert-F26AFile (Join-Path $PSScriptRoot 'native-driver-provenance-03.json') '${binding.driverProvenance.sha256}' ${binding.driverProvenance.bytes}\r\n Assert-F26AFile (Join-Path $PSScriptRoot 'native-fixture-equivalence-03.json') '${binding.equivalence.sha256}' ${binding.equivalence.bytes}\r\n Assert-F26AFile (Join-Path $PSScriptRoot 'host-current-binding-02.ps1') '${binding.hostBinding.sha256}' ${binding.hostBinding.bytes}\r\n}\r\n`;
const anchor = 'function Assert-F26ANativeRuntimes {'; assert.equal(launcher.split(anchor).length, 2); launcher = launcher.replace(anchor, nativeChecks + anchor);
const invoke = 'function Assert-F26ANativeRuntimes {\r\n Assert-F26AEditorHost';
const invokeLf = 'function Assert-F26ANativeRuntimes {\n Assert-F26AEditorHost';
if (launcher.includes(invoke)) launcher = launcher.replace(invoke, invoke + '\r\n Assert-F26ANative03Binding');
else { assert(launcher.includes(invokeLf)); launcher = launcher.replace(invokeLf, invokeLf + '\n Assert-F26ANative03Binding'); }
assert(!launcher.includes(oldDriver) && !offline.includes(oldDriver));
assert(!launcher.includes('native-host-freeze-01.json') && !launcher.includes('native-driver-provenance-02.json') && !launcher.includes('host-current-binding-01.ps1'));
for (const required of ['STOP_UNCONFIRMED', 'RETAIN_PROCESS_AND_PIPE_READERS_UNTIL_NATURAL_CLOSE_AND_BOTH_EOF_NO_LATER_PHASE', "'--disable-extension=vscode.git'", "'git.enabled'=$false", 'expectedChecks=@{primary=30;restart=4}']) assert(launcher.includes(required));
const targets = ['run-precommit-native-03.ps1', 'precommit-offline-owner-03.cjs', 'precommit-launcher03-inherited-run02.txt', 'precommit-launcher03-inherited-offline01.txt', 'precommit-launcher03-custody.json'];
for (const name of targets) assert(!fs.existsSync(own(name)), 'Immutable output already exists: ' + name);
fs.writeFileSync(own(targets[2]), launcherRaw, { flag: 'wx' }); fs.writeFileSync(own(targets[3]), offlineRaw, { flag: 'wx' });
fs.writeFileSync(own(targets[0]), launcher, { flag: 'wx' }); fs.writeFileSync(own(targets[1]), offline, { flag: 'wx' });
const receipt = { status: 'MATERIALIZED_CURRENT_NATIVE_FIXTURE_ONLY_NOT_EXECUTED', time: new Date().toISOString(),
 binding: fact(bindingFile), helpers: [fact(own(targets[0])), fact(own(targets[1]))], ancestors: [fact(oldLauncherFile), fact(oldOfflineFile)],
 snapshots: [fact(own(targets[2])), fact(own(targets[3]))], semanticFreeze: fact(freezeFile), driver, unchangedAffectedDrivers: 20,
 sourceProof: binding.sourceProof, fullSourceProof: binding.fullSourceProof, compiler: binding.compilerReceipt, full: binding.fullReceipt,
 vsix: binding.vsix, independence: 'LOW', limitations: 'Generator only writes exact reviewed successor evidence. No native/build/compiler/test/Git/source execution. Root must syntax-check and custody-snapshot generated helpers before actual new native. Old failed observations remain immutable and unregraded.' };
fs.writeFileSync(own(targets[4]), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
