'use strict';
// Static evidence checks only: no Code, Git, sockets, subprocess or test run.
// Read-only by default. Optional: --receipt <new-filename.json> in this directory.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const read = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const json = file => JSON.parse(read(file).replace(/^\uFEFF/, ''));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const repo = path.resolve(__dirname, '../../../../..');
const oldRoot = path.join(repo, 'docs/soterai-lite/evidence/20261102-f26a-native09-preparation');
const old = read(path.join(oldRoot, 'run-precommit-native12-current-01.ps1'));
const current = read(path.join(__dirname, 'run-precommit-native14.ps1'));
const admission = json(path.join(__dirname, 'native14-admission.json'));
const checks = [];
const args = process.argv.slice(2);
assert(args.length === 0 || args.length === 2 && args[0] === '--receipt' && /^[a-z0-9-]+[.]json$/.test(args[1]), 'Use --receipt <new-filename.json>, or no arguments for read-only validation.');
function check(name, work) { work(); checks.push({ name, status: 'PASS' }); }
check('Candidate admits actual pre-commit commands through its unmodified release metadata', () => {
 const manifest = json(admission.manifest.path);
 assert.equal(manifest.soteraiLiteRelease?.schemaVersion, 1);
 assert.equal(manifest.soteraiLiteRelease?.channel, 'pre-release');
 assert(Array.isArray(manifest.soteraiLiteRelease?.unsupportedFeatures));
 assert(!manifest.soteraiLiteRelease.unsupportedFeatures.includes('preCommit'));
});
check('Exact unchanged original supplementary driver and original30+4 semantic fixture', () => {
 assert.equal(hash(admission.driver.path), '8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced');
 const semantic = json(admission.semantic.path);
 assert.equal(semantic.primary.length, 30); assert.equal(semantic.restart.length, 4);
 assert.equal(hash(path.join(repo, semantic.file)), semantic.sha256);
});
check('Native result assertions are byte identical except current VS Code version', () => {
 const select = body => body.slice(body.indexOf('function Assert-F26AResult('), body.indexOf('$taskResults=@()'));
 assert.equal(select(current), select(old).replaceAll("$Observed.hostVersion -cne '1.144.0'", "$Observed.hostVersion -cne '1.145.1'"));
});
check('Original primary, real offline Git and restart phase body is unchanged except diagnostic copy', () => {
 const select = body => body.slice(body.indexOf('$taskResults=@()'));
 assert.equal(select(current), select(old).replaceAll("@('.driver-error.json','.startup.jsonl')", "@('.driver-error.json','.startup.jsonl','.progress.jsonl')"));
 assert(current.includes("$taskOfflineRoot.Substring(2) -cne $taskWorkspace.Substring(2)"));
 assert(current.includes('root=$taskOfflineRoot'));
});
check('Offline owner helper changes only current Code and packaged worker digests', () => {
 const previous = read(admission.offlinePredecessor.path);
 const expected = previous.replace("const CODE_SHA = '9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb';", 'const CODE_SHA = ' + JSON.stringify(admission.code.sha256) + ';')
  .replace("const WORKER = '36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb';", 'const WORKER = ' + JSON.stringify(admission.runtimeFiles[3].sha256) + ';');
 assert.equal(read(admission.offline.path), expected);
 new vm.Script(expected, { filename: admission.offline.path });
});
check('Generated developer bootstrap JavaScript parses', () => {
 const start = current.indexOf("$taskBootstrap=@'\n") + "$taskBootstrap=@'\n".length;
 const end = current.indexOf("\n'@\n$taskBootstrapPath=", start);
 assert(start > 0 && end > start);
 new vm.Script(current.slice(start, end), { filename: 'native14-bootstrap.cjs' });
});
check('Native11 exact drive-case mismatch is reproduced from retained receipt bytes', () => {
 const run = path.join(oldRoot, 'f26a-precommit-native-20261102T140059Z-3bd8bf22');
 const state = json(path.join(run, 'precommit-restart-state.json'));
 const offline = json(path.join(run, 'precommit-owner-absent.json'));
 assert.notEqual(offline.owner.cwd, state.root);
 assert.equal(offline.owner.cwd.slice(2), state.root.slice(2));
 assert.equal(offline.owner.cwd.toLowerCase(), state.root.toLowerCase());
 const result = json(path.join(run, 'primary-results.json'));
 assert.equal(result.passed, 30); assert.equal(result.failed, 0);
 assert.equal(json(path.join(run, 'restart.driver-error.json')).setup.caseId, 'F26A-HR02');
});
check('Prepared current source, vendor and runtime inputs remain exact', () => {
 for (const row of [admission.vsix, admission.manifest, admission.code, admission.git, ...admission.sourceFiles, ...admission.runtimeFiles, ...admission.vendorFiles, ...admission.jsonBuiltin.files]) {
  assert.equal(fs.statSync(row.path).size, row.bytes, row.path); assert.equal(hash(row.path), row.sha256, row.path);
 }
});
const result = { status: 'PASS_STATIC_ONLY_NOT_NATIVE_ACCEPTANCE', observedAt: new Date().toISOString(), checks, nativeLaunches: 0, nativeChecks: { required: 34, executed: 0 } };
if (args.length) fs.writeFileSync(path.join(__dirname, args[1]), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
