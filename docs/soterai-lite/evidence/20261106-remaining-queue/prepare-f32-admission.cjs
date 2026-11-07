'use strict';
// Prepare a concrete task-authorized run. OS/sandbox launch approval remains
// external to this record and must still be granted by the execution tool.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../20261103-f32-lifecycle-2e95d6a4');
const own = n => path.join(root, n);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = p => { const b = fs.readFileSync(p); return { path: p, bytes: b.length, sha256: hash(b) }; };
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const write = (n, v) => fs.writeFileSync(own(n), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const a = structuredClone(read(own('installed-extra06-admission.json')));
a.status = 'ROOT_REVIEWED_F32_INSTALLED_EXTRA07_FINAL_INPUTS'; a.extraAttempt = 'PROPOSAL08';
a.runRoot = 'D:\\SoterAI-Lite-test-profiles\\f32-installed-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + '-' + crypto.randomBytes(4).toString('hex');
assert(!fs.existsSync(a.runRoot));
a.debugPorts = [54721, 54722, 54723, 54724, 54725, 54726, 54727, 54728]; a.configuredBrokerPort = 54729;
a.syntheticCanary = 'SOTERAI_F32_SYNTHETIC_CURRENT_HOST_20261106';
for (const [key, name] of Object.entries({ runner: 'run-installed-lifecycle-proposed-07.cjs', custody: 'installed-owner-custody-proposed-06.ps1', guiHelper: 'native-owned-gui-phase-proposed-07.cjs' })) a.fixtures[key] = fact(own(name));
a.vendorReceipt = fact(own('public-vendor-observation-04.json'));
a.vendorReview = fact(own('current-vendor-review-03.json'));
a.finalQualification = fact(own('current-package-qualification-03.json'));
a.installerSizeQualification = fact(own('vendor-installed-size-qualification-04.json'));
a.previousExtra06 = Object.fromEntries(Object.entries({ consumed: 'installed-extra06-consumed.json', admission: 'installed-extra06-admission.json', failure: 'retained-native-extra06-01/installed-extra06-failure.json', codeClose: 'retained-native-extra06-01/primary-code-owned-close.json', rootResult: 'installed-extra06-native-01.txt.result.json' }).map(([key, name]) => [key, fact(own(name))]));
write('installed-extra07-user-approval.json', {
  feature: 'F32', status: 'USER_REQUESTED_F32_COMPLETION_LOCAL_VERIFICATION', extraAttempt: 'PROPOSAL08', approved: true, maxAttempts: 1,
  observedAt: new Date().toISOString(), syntheticOnly: true, signalsRequested: 0, runRoot: a.runRoot,
  userAnswer: 'FEATURE-QUEUE.json ke remaning f32, f26a, finalgates, f31 ko comlete kro fats | continue kro, and complete fast remaninig work',
  authorityScope: 'Current user task authorizes local feature verification; sandbox escalation is separate and not asserted by this record.',
  proposal: fact(own('CURRENT-HOST-VERIFICATION-PROPOSAL08.md')), runner: a.fixtures.runner, sourceProof: a.sourceProof, currentVsix: a.currentVsix,
});
a.extraApproval = fact(own('installed-extra07-user-approval.json'));
write('installed-extra07-admission.json', a);
const admission = fact(own('installed-extra07-admission.json'));
const runner = require(a.fixtures.runner.path);
runner.reviewedAdmission(admission.path, admission.sha256);
runner.verifyExtraApproval(a);
const result = { status: 'PASS_CURRENT_HOST_STATIC_ADMISSION_NOT_LAUNCHED', observedAt: new Date().toISOString(), admission, runRoot: a.runRoot, currentVsix: a.currentVsix, currentHost: '1.145.1' };
fs.writeFileSync(path.join(__dirname, 'f32-admission.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
