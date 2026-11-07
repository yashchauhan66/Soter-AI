'use strict';
// Rebind the reviewed lifecycle harness to the already-installed 1.145.1.
// This creates inert successors only; it does not launch or install anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../20261103-f32-lifecycle-2e95d6a4');
const repo = path.resolve(__dirname, '../../../..');
const own = n => path.join(root, n);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const fact = p => { const b = fs.readFileSync(p); return { path: p, bytes: b.length, sha256: hash(b) }; };
const pin = row => { const got = fact(row.path); assert.equal(got.bytes, row.bytes, row.path); assert.equal(got.sha256, row.sha256, row.path); };
const save = (name, value) => fs.writeFileSync(own(name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const vendor = read(own('public-vendor-observation-04.json'));
assert.equal(vendor.currentHost.version, '1.145.1');
assert.equal(vendor.currentHost.commit, '6bab64e2d12b04d04c0d99c27ff166023efd1dda');
assert.equal(vendor.twoStableObservations, true);
for (const row of vendor.vendorFacts) pin(row);
const signatures = read(own('current-signature-observation-04.json'));
assert.equal(signatures.vendorReceiptSha256, fact(own('public-vendor-observation-04.json')).sha256);
for (const row of signatures.rows) { assert.equal(row.status, 'Valid'); assert.equal(fact(row.path).sha256, row.sha256); }
const inputs = read(own('full-inputs-04.json'));
for (const row of inputs.files) pin({ ...row, path: path.resolve(repo, row.path) });
const prior = read(own('installed-extra06-admission.json'));
pin(prior.currentVsix); pin(prior.oldVsix);
const cli = read(own('vendor-installed-size-qualification-04.json'));
assert.equal(cli.vendorReceiptSha256, fact(own('public-vendor-observation-04.json')).sha256);
assert.equal(cli.currentVsixSha256, prior.currentVsix.sha256);
assert.equal(cli.oldVsixSha256, prior.oldVsix.sha256);
for (const key of ['current', 'old']) {
  pin(cli[key].installedManifest); pin(cli[key].installedVsixManifest);
  for (const closed of [cli[key].installClose, cli[key].listClose]) {
    pin(closed); const value = read(closed.path);
    assert.equal(value.exitCode, 0); assert(value.actualClose && value.stdoutEOF && value.stderrEOF);
    assert.equal(value.signal, null);
    for (const stream of value.streams) pin({ path: closed.path.replace('owned-close.json', stream.name + '.bin'), bytes: stream.bytes, sha256: stream.sha256 });
  }
}
const oldHash = 'f1e1d79be5f50a238681738f813c4b353aad69f4b05f068899ec98a2d1b74c32';
const replacements = [
  ['a717861c07586a53d83b80d742cd3f59b20a6273', vendor.currentHost.commit],
  ['a717861c07', '6bab64e2d1'], ['1.145.0', '1.145.1'],
  [oldHash, vendor.currentHost.executable.sha256], ['238751544', String(vendor.currentHost.executable.bytes)],
];
function successor(from, to, changes = []) {
  let text = fs.readFileSync(own(from), 'utf8');
  for (const [before, after] of [...replacements, ...changes]) text = text.replaceAll(before, after);
  save(to, text); return fact(own(to));
}
successor('native-owned-gui-phase-proposed-06.cjs', 'native-owned-gui-phase-proposed-07.cjs', [['EXTRA06', 'EXTRA07'], ['PROPOSAL07', 'PROPOSAL08']]);
successor('installed-owner-custody-proposed-05.ps1', 'installed-owner-custody-proposed-06.ps1');
successor('installed-trust-static-controls-corrected-08.test.cjs', 'installed-trust-static-controls-corrected-09.test.cjs');
let runner = fs.readFileSync(own('run-installed-lifecycle-proposed-06.cjs'), 'utf8');
for (const [before, after] of [...replacements,
  ['extra06', 'extra07'], ['EXTRA06', 'EXTRA07'], ['PROPOSAL07', 'PROPOSAL08'],
  ['installed-owner-custody-proposed-05.ps1', 'installed-owner-custody-proposed-06.ps1'],
  ['native-owned-gui-phase-proposed-06.cjs', 'native-owned-gui-phase-proposed-07.cjs'],
  ['USER_APPROVED_ONE_BOUNDED_EXTRA07_VISIBLE_GUI_DIAGNOSTIC', 'USER_REQUESTED_F32_COMPLETION_LOCAL_VERIFICATION'],
  ['I06-ROOT-CAUSE-PROPOSAL08.md', 'CURRENT-HOST-VERIFICATION-PROPOSAL08.md'],
  ["errorName: error instanceof Error ? error.name : 'UnknownFailure', completed,", "errorName: error instanceof Error ? error.name : 'UnknownFailure', errorMessage: error instanceof Error ? error.message : undefined, errorStack: error instanceof Error ? error.stack : undefined, completed,"],
  ["errorName: error instanceof Error ? error.name : 'UnknownFailure', signalsRequested: 0", "errorName: error instanceof Error ? error.name : 'UnknownFailure', errorMessage: error instanceof Error ? error.message : undefined, errorStack: error instanceof Error ? error.stack : undefined, signalsRequested: 0"],
]) runner = runner.replaceAll(before, after);
// Preserve and verify the consumed prior attempt, including its actual crash.
const history = `
function verifyPreviousExtra06(a) {
 const p = a.previousExtra06; assert(p);
 for (const row of Object.values(p)) pin(row);
 const consumed = pinnedJson(p.consumed), failed = pinnedJson(p.failure), closed = pinnedJson(p.codeClose);
 assert.equal(consumed.status, 'CONSUMED_ONE_EXPLICIT_EXTRA06_NO_RETRY');
 assert.notEqual(consumed.runRoot.toLowerCase(), a.runRoot.toLowerCase());
 assert.equal(failed.status, 'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE');
 assert.equal(closed.exitCode, 2147483651);
 assert(closed.actualClose && closed.stdoutEOF && closed.stderrEOF);
 assert.equal(closed.signal, null); assert.equal(closed.signalsRequested, 0);
 for (const stream of closed.streams) pin({ path:p.codeClose.path.replace('owned-close.json',stream.name+'.bin'),bytes:stream.bytes,sha256:stream.sha256 });
}
`;
runner = runner.replace('function reviewedAdmission(admissionFile, expectedSha) {', history + '\nfunction reviewedAdmission(admissionFile, expectedSha) {');
runner = runner.replaceAll('verifyPreviousRound03(a); verifyPreviousExtra05(a);', 'verifyPreviousRound03(a); verifyPreviousExtra05(a); verifyPreviousExtra06(a);');
save('run-installed-lifecycle-proposed-07.cjs', runner);
const oldReview = read(own('current-vendor-review-02.json'));
const oldVendor = read(own('public-vendor-observation-03.json'));
assert.deepEqual(vendor.playwright, oldVendor.playwright);
const workbench = vendor.vendorFacts.find(r => r.path.endsWith('workbench.desktop.main.js'));
const source = fs.readFileSync(workbench.path, 'utf8');
assert(source.includes('"window.dialogStyle":{type:"string",enum:["native","custom"],default:"native"'));
const changed = vendor.vendorFacts.filter(r => !oldVendor.vendorFacts.some(p => p.sha256 === r.sha256 && p.bytes === r.bytes));
save('current-vendor-review-03.json', { ...oldReview,
  observedAt: new Date().toISOString(), vendorReceiptSha256: fact(own('public-vendor-observation-04.json')).sha256,
  vendor: { version: vendor.currentHost.version, commit: vendor.currentHost.commit, appRoot: vendor.currentHost.appRoot },
  signatures: fact(own('current-signature-observation-04.json')), installerContract: fact(own('vendor-installed-size-qualification-04.json')),
  vendorDelta: { unchangedRows: vendor.vendorFacts.length - changed.length, changedRows: changed.length, changedPaths: changed.map(r => r.path), playwrightGraphUnchanged: true },
  dialogStyleWitness: { file: workbench, setting: 'window.dialogStyle', default: 'native', configured: 'custom', settingOffset: source.indexOf('"window.dialogStyle":{'), useCustomDialogOffset: source.indexOf('get useCustomDialog(){') },
  basis: { ...oldReview.basis, currentCodeSigner: 'Current installed 1.145.1 hashes freshly matched the retained valid Authenticode observations.', exactInstallerMetadataSerialization: 'Both actual 1.145.1 CLI installations and closed streams repinned; no new installation performed by this preparation.' },
  supersedes: fact(own('current-vendor-review-02.json')),
});
const oldQualification = read(own('current-package-qualification-02.json'));
for (const row of oldQualification.ownedCloseReceipts) pin(row);
save('current-package-qualification-03.json', { ...oldQualification,
  observedAt: new Date().toISOString(), currentVendorReceiptSha256: fact(own('public-vendor-observation-04.json')).sha256,
  supersedes: fact(own('current-package-qualification-02.json')),
  vendorChange: { from: oldQualification.vendorChange.to, to: { version: vendor.currentHost.version, commit: vendor.currentHost.commit } },
  reverification: { at: new Date().toISOString(), sourceFilesRepinned: inputs.files.length, vsixRepinned: prior.currentVsix.sha256, retainedExecutionNotRerun: true },
});
save('CURRENT-HOST-VERIFICATION-PROPOSAL08.md', '# Current F32 installed lifecycle verification\n\n6 November 2026. The owner explicitly requested completion of F32, F26a, F31 and final gates and repeated the instruction to continue. This successor uses the already-installed VS Code 1.145.1. It retains the extra06 startup failure: Electron reported inaccessible installation ACLs on the previous 1.145.0 build. The subsequent installed build has a recorded successful isolated GUI preflight. No ACL or OS changes are proposed.\n\nOnly vendor version/hash bindings, successor receipt names and assertion diagnostics change. The custom-dialog fixture remains enabled. All original 44 assertions, 59 observations, eight lifecycle phases, exact 0.7.0 package and genuine 0.6.3 upgrade remain mandatory. One fresh isolated synthetic run is prepared; prior attempts cannot be reused. Native launch remains subject to the environment approval boundary. No normal profile, download, login, publication, raw-secret restoration or process termination is included.\n');
fs.writeFileSync(path.join(__dirname, 'f32-preparation.json'), JSON.stringify({ status: 'PREPARED_NO_NATIVE_LAUNCH', observedAt: new Date().toISOString(), currentHost: vendor.currentHost.version, sourceFiles: inputs.files.length, runner: fact(own('run-installed-lifecycle-proposed-07.cjs')), vendor: fact(own('public-vendor-observation-04.json')) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PREPARED_NO_NATIVE_LAUNCH', sourceFiles: inputs.files.length, vendorFiles: vendor.vendorFacts.length, currentHost: vendor.currentHost.version }));
