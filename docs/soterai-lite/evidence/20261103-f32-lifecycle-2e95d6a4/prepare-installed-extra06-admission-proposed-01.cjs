'use strict';
// Inert API: no import-time file write/listener/profile/approval/native action.
// Successor of prepare-installed-extra05-admission-proposed-01.cjs for the single extra06 attempt.
// Root supplies a fresh root and already reviewed numeric ports; no automatic probe, approval
// fabrication, consumption or native invocation is performed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const own = n => path.join(__dirname, n), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = f => { const b = fs.readFileSync(f); return { path: path.resolve(f), bytes: b.length, sha256: sha(b) }; };
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const FIXTURES = {
  runner: 'run-installed-lifecycle-proposed-06.cjs', launch: 'installed-launch-contract-proposed-04.cjs',
  manifest: 'installed-manifest-admission-proposed-02.cjs', observer: 'installed-observer-proposed-05.cjs',
  oldObserver: 'installed-upgrade-old-observer-proposed-04.cjs', observerManifest: 'installed-observer-package-proposed-01.json',
  renderer: 'installed-renderer-proposed-05.cjs', custody: 'installed-owner-custody-proposed-05.ps1',
  brokerObservation: 'installed-broker-observation-proposed-03.cjs', brokerCustody: 'installed-broker-custody-proposed-02.ps1',
  guiHelper: 'native-owned-gui-phase-proposed-06.cjs', trustDiagnostics: 'installed-trust-diagnostics-proposed-05.cjs',
};
function makeAdmission({ runRoot, debugPorts, configuredBrokerPort, syntheticCanary, extraApproval }) {
  const prior = read(own('installed-extra05-admission.json')), a = structuredClone(prior);
  assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(runRoot));
  assert(!fs.existsSync(runRoot)); assert.notEqual(runRoot.toLowerCase(), prior.runRoot.toLowerCase());
  assert(Array.isArray(debugPorts) && debugPorts.length === 8 && new Set(debugPorts).size === 8);
  for (const port of [...debugPorts, configuredBrokerPort]) assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535 && port !== 47321);
  assert(!debugPorts.includes(configuredBrokerPort)); assert(/^SOTERAI_F32_SYNTHETIC_[A-Z0-9_]{8,80}$/.test(syntheticCanary));
  assert.notDeepEqual(debugPorts, prior.debugPorts); assert.notEqual(syntheticCanary, prior.syntheticCanary);
  a.status = 'ROOT_REVIEWED_F32_INSTALLED_EXTRA06_FINAL_INPUTS'; a.extraAttempt = 'PROPOSAL07';
  a.runRoot = runRoot; a.debugPorts = debugPorts; a.configuredBrokerPort = configuredBrokerPort; a.syntheticCanary = syntheticCanary;
  for (const [key, name] of Object.entries(FIXTURES)) a.fixtures[key] = fact(own(name));
  // Current vendor 1.145.0 (a717861c07) evidence replaces the 1.144.1 chain. Package/source/VSIX facts are unchanged.
  a.vendorReceipt = fact(own('public-vendor-observation-03.json'));
  a.vendorReview = fact(own('current-vendor-review-02.json'));
  a.finalQualification = fact(own('current-package-qualification-02.json'));
  a.installerSizeQualification = fact(own('vendor-installed-size-qualification-03.json'));
  a.previousExtra05 = {
    approval: fact(own('installed-extra05-user-approval.json')), admission: fact(own('installed-extra05-admission.json')),
    consumed: fact(own('installed-extra05-consumed.json')), rootResult: fact(own('installed-extra05-native-01.txt.result.json')),
    checkpoint: fact(own('native-extra05-checkpoint-01.json')), failure: fact(own('retained-native-extra05-01/installed-extra05-failure.json')),
  };
  if (extraApproval) { assert.equal(extraApproval.path, own('installed-extra06-user-approval.json')); a.extraApproval = extraApproval; }
  else delete a.extraApproval;
  return a;
}
function prepareAdmission(options) {
  const a = makeAdmission(options), target = own('installed-extra06-admission.json');
  fs.writeFileSync(target, JSON.stringify(a, null, 2) + '\n', { flag: 'wx' });
  const row = fact(target); require(a.fixtures.runner.path).reviewedAdmission(row.path, row.sha256);
  return { status: 'PASS_STATIC_EXTRA06_ADMISSION_NATIVE_NOT_RUN', admission: row, extraApprovalPresent: !!a.extraApproval };
}
module.exports = { FIXTURES, makeAdmission, prepareAdmission };
