'use strict';
// Records the owner's actual messages as the single bounded extra06 approval and builds the exact admission.
// No native, profile, listener or consumption action. Fails closed if any extra06 artifact already exists.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const own = n => path.join(__dirname, n), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = p => { const b = fs.readFileSync(p); return { path: path.resolve(p), bytes: b.length, sha256: sha(b) }; };
for (const name of ['installed-extra06-user-approval.json', 'installed-extra06-admission.json', 'installed-extra06-consumed.json', 'extra06-approval-materialization-01.json']) assert(!fs.existsSync(own(name)), name);
const prep = require('./prepare-installed-extra06-admission-proposed-01.cjs'), runner = require(own('run-installed-lifecycle-proposed-06.cjs'));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const options = { runRoot: 'D:\\SoterAI-Lite-test-profiles\\f32-installed-' + stamp + '-' + crypto.randomBytes(4).toString('hex'),
  debugPorts: [64200, 64201, 64202, 64203, 64204, 64205, 64206, 64207], configuredBrokerPort: 64208,
  syntheticCanary: 'SOTERAI_F32_SYNTHETIC_' + crypto.randomBytes(8).toString('hex').toUpperCase() };
assert(!fs.existsSync(options.runRoot));
const candidate = prep.makeAdmission(options);
const messages = ['do which you went , you have all permision', 'now continue kro or jo bhi issuse aaye usko khud fix kro', 'ok continue kro mena sandbox off kr diya hai'];
const approval = { feature: 'F32', status: 'USER_APPROVED_ONE_BOUNDED_EXTRA06_VISIBLE_GUI_DIAGNOSTIC', extraAttempt: 'PROPOSAL07', approved: true, maxAttempts: 1,
  observedAt: new Date().toISOString(), signalsRequested: 0, syntheticOnly: true, runRoot: options.runRoot,
  proposal: fact(own('I06-ROOT-CAUSE-PROPOSAL07.md')), runner: candidate.fixtures.runner, sourceProof: candidate.sourceProof, currentVsix: candidate.currentVsix,
  userAnswer: messages.join(' | '), ownerMessages: messages, ownerAction: 'Owner disabled the Kiro command sandbox (C:\\Users\\USER\\.kiro\\settings\\sandbox.json enabled:false) so the agent shell can reach D:\\',
  controls: fact(own('extra06-controls-02.txt')), vendorReceipt: candidate.vendorReceipt };
const approvalPath = own('installed-extra06-user-approval.json');
fs.writeFileSync(approvalPath, JSON.stringify(approval, null, 2) + '\n', { flag: 'wx' });
const admission = prep.makeAdmission({ ...options, extraApproval: fact(approvalPath) });
const target = own('installed-extra06-admission.json');
fs.writeFileSync(target, JSON.stringify(admission, null, 2) + '\n', { flag: 'wx' });
runner.verifyExtraApproval(admission); runner.reviewedAdmission(target, fact(target).sha256);
assert(!fs.existsSync(own('installed-extra06-consumed.json'))); assert(!fs.existsSync(options.runRoot));
const report = { feature: 'F32', status: 'PASS_EXPLICIT_EXTRA06_APPROVAL_AND_EXACT_ADMISSION_NATIVE_NOT_RUN', observedAt: new Date().toISOString(),
  approval: fact(approvalPath), admission: fact(target), runner: admission.fixtures.runner, options, normalRoundsConsumed: 3, extra05Consumed: 1, extra06Approved: 1, extra06Consumed: 0, signalsRequested: 0 };
fs.writeFileSync(own('extra06-approval-materialization-01.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 1));
