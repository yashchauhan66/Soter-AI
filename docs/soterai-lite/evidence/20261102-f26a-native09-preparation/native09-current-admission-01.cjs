'use strict';
// Read-only F26a metadata admission. No Code/Git/child/listener/profile/approval
// operation. The separate exact launcher/proposal still needs fresh native09
// approval superseding the recorded defer; this module confers no run authority.
const I = require('./supplementary-preparation-invariants-01.cjs');
const { fs, path, assert, repo, own, old, current: currentRoot, read, sha, file, fact } = I;
const GUARD = { path: currentRoot + 'current-native-admission-05.cjs', bytes: 8293, sha256: '251638db0be53eb3e79f808316e08c9d192e0eca10741fbc8484fb8353f3e368' };
I.exact(GUARD);
const A = require(file(GUARD.path));
const F28_BINDING_SHA = '6ad782a541704d8da93321093d479f5947684371802818b711802ded0587a8b3';
const SOURCE_COMMIT = '3c3f6e0567c2398d9fda8c614122697cebc0b335';
const TRANSITION_COMMIT = '60a24c6b827dd562c275363ca9946367b3ce3ebd';
const F28_SOURCE = { path: currentRoot + 'f28-source-byte-proof-03.json', bytes: 113453, sha256: '8c234126dc4edd6107905d02b27d5a2191455da27a58026e09b137efde01784d' };
const F28_TRANSITION = { path: currentRoot + 'f28-transition-byte-proof-01.json', bytes: 5066, sha256: 'c8d1fa275363ea476adfb375df98a663f3efc98d655961ae88a3ac6f024ff70a' };
const HOST_REVIEW = { path: 'docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/host-version-review-code1144-01.json', bytes: 6070, sha256: 'b1106807aebdeb57297b1b21bd7b8c8bae6f49353eceec6a46b3c03949a89a53' };
const TOOL_INVENTORY = { path: 'docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/accessibility-tooling-code1144-edge1570030-02.json', bytes: 7195, sha256: '2b939a93491307ef4801553d57233800c06612b7f10fdb6e6af9a333e01f6461' };
const HISTORY_CHECKPOINT = { path: 'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/start-checkpoint-01.json', bytes: 2898, sha256: 'b2388188f92a9db2d77214bb0fb576a6bf6f05fb4f56207803abd5912d3aaca3' };
const STATUS = 'F26A_CURRENT1076_NATIVE09_BOUND_NOT_AUTHORIZED_NOT_RUN';
function relativeFile(value) {
  assert.equal(typeof value, 'string');
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(/^(docs|packages|apps|node_modules)[\\/]/.test(value) ? repo : __dirname, value);
}
function pin(row) { return A.pin({ ...row, path: relativeFile(row.path) }); }
function workspaceFact(row) {
  assert(row && typeof row.path === 'string' && !path.isAbsolute(row.path));
  assert.equal(row.path, row.path.replaceAll('\\', '/')); assert(!row.path.split('/').some(part => part === '..' || part === '' || part === '.'));
  const target = path.resolve(repo, row.path); assert(target.startsWith(repo + path.sep));
  pin({ ...row, path: target }); return target;
}
function canonical(name) {
  const raw = fs.readFileSync(own(name + '.txt')), result = read(own(name + '.txt.result.json'));
  assert.equal(result.exitCode, 0, name); assert.equal(sha(raw), result.sha256.toLowerCase(), name); return result;
}
function originalChecks() {
  const snapshot = I.retained(), freeze = read(file(snapshot.originalContract.freeze.path));
  assert.equal(freeze.primary.length, 30); assert.equal(freeze.restart.length, 4);
  assert.equal(freeze.sha256, 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741');
  const copied = fact(own('original-native34-freeze-01.json'));
  assert.equal(copied.bytes, snapshot.originalContract.freeze.bytes); assert.equal(copied.sha256, snapshot.originalContract.freeze.sha256);
  pin(copied); return snapshot;
}
function barriers() {
  pin(F28_SOURCE); pin(F28_TRANSITION);
  const source = read(file(F28_SOURCE.path)), transition = read(file(F28_TRANSITION.path));
  assert.equal(source.status, 'PASS_EXACT_LOCAL_F28_SOURCE14_AND_EVIDENCE_BYTES_TRANSITION_PENDING');
  assert.equal(transition.status, 'PASS_EXACT_LOCAL_F28_DONE_TRANSITION_BYTES');
  assert.equal(source.commit, SOURCE_COMMIT); assert.equal(transition.commit, TRANSITION_COMMIT); assert.equal(transition.parent, source.commit);
  assert.equal(source.fileCount, 339); assert.equal(transition.fileCount, 14);
  for (const proof of [source, transition]) {
    assert.equal(proof.feature, 'F28'); assert.equal(proof.mismatches, 0); assert.equal(proof.unexpectedPaths, 0); assert.equal(proof.indexEmpty, true);
  }
  assert.equal(transition.featureState, 'DONE_SCOPED_F26A_SELECTED_AFTER_TRANSITION_BYTES');
  const barrier = read(own('../20261101-f28-reliability-9a4c2e71/transition-barrier-01.json'));
  assert.equal(barrier.status, 'F28_DONE_SCOPED_SOURCE_AND_TRANSITION_BYTES_PASS_F26A_SELECTED');
  assert.equal(barrier.sourceCommit, SOURCE_COMMIT); assert.equal(barrier.transitionCommit, TRANSITION_COMMIT);
  assert.deepEqual(barrier.sourceProof, F28_SOURCE); assert.deepEqual(barrier.transitionProof, F28_TRANSITION);
  assert.equal(barrier.acceptance.sha256, '3a598a322e6ad742faa47ac8f076505b28e02c0ff90665cbe8bc8ea59026c2b2');
  pin(barrier.acceptance); assert.equal(barrier.releaseReady, false);
  return { sourceProof: F28_SOURCE, transitionProof: F28_TRANSITION, barrier: fact(file(currentRoot + 'transition-barrier-01.json')), acceptance: barrier.acceptance, sourceCommit: SOURCE_COMMIT, transitionCommit: TRANSITION_COMMIT };
}
function current() {
  const prior = A.binding(F28_BINDING_SHA), snapshot = originalChecks(), byteBarriers = barriers();
  assert.deepEqual(prior.sourceProof, snapshot.currentInputs.proof); assert.deepEqual(prior.vsix, snapshot.currentInputs.vsix);
  assert.deepEqual(prior.hostReview, HOST_REVIEW);
  const source = read(file(prior.sourceProof.path)); assert.equal(source.fileCount, 1076); assert.equal(source.files.length, 1076);
  const content = read(file(snapshot.currentInputs.content.path));
  assert.equal(content.entryCount, 15); assert.equal(content.runtimeCount, 4); assert.equal(content.machineSettings, 88);
  assert.deepEqual(content.full, { tests: 4780, pass: 4776, fail: 0, cancelled: 0, skipped: 4 });
  const contentEntries = content.entries.map(row => ({ ...row, path: currentRoot + 'vsix-extracted-02/' + row.path }));
  contentEntries.forEach(pin);
  const runtimes = contentEntries.filter(row => /^extension\/dist\/[^/]+\.js$/.test(row.path.slice((currentRoot + 'vsix-extracted-02/').length))).map(row => ({ ...row, name: path.basename(row.path) }));
  assert.equal(runtimes.length, 4); assert.equal(runtimes.find(row => row.name === 'extension.js').sha256, prior.frontendSha256);
  const manifest = read(path.join(repo, prior.extractedRoot, 'package.json'));
  const flag = manifest.contributes.configuration.properties['soterai.lite.historyHooks.preCommit'];
  assert.equal(flag.default, false); assert.equal(flag.scope, 'machine');
  assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.historyHooks.preCommit'));
  for (const command of ['installPreCommitGuard', 'resumePreCommitGuard', 'restorePreCommitGuard', 'preCommitGuardStatus']) assert.equal(manifest.contributes.commands.filter(row => row.command === 'soterai.' + command).length, 1);
  const provenance = read(own('supplementary-precommit-driver-provenance-01.json'));
  assert.equal(provenance.status, 'F26A_CURRENT1076_SUPPLEMENTARY_DRIVER1_PREPARED_NOT_NATIVE_ACCEPTANCE');
  assert.equal(provenance.feature, 'F26a'); assert.deepEqual(provenance.sourceProof, prior.sourceProof); assert.deepEqual(provenance.currentArtifact, prior.vsix);
  assert.equal(provenance.f28SourceCommit, SOURCE_COMMIT); assert.equal(provenance.f28TransitionCommit, TRANSITION_COMMIT);
  assert.equal(provenance.drivers.length, 1); assert.equal(provenance.sourceInputs.length, 2);
  assert.deepEqual(provenance.originalOracles, { primary: 30, restart: 4, total: 34 });
  assert.equal(provenance.diagnosticReversalByteExact, true); assert.equal(provenance.original34AddExpressionsByteEqual, true);
  assert.deepEqual(provenance.sourceInputs, [snapshot.originalContract.diagnosticSource, snapshot.originalContract.diagnosticHelper]);
  assert.equal(provenance.retainedDriverComparison.byteExact, true); assert.deepEqual(provenance.retainedDriverComparison.original, snapshot.originalContract.retainedDriver);
  const newDriver = provenance.drivers[0];
  assert.equal(relativeFile(newDriver.path), own('supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'));
  assert.equal(newDriver.bytes, 74473); assert.equal(newDriver.sha256, '8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced');
  const oldDrivers = read(file(prior.driverProvenance.path));
  assert.deepEqual(provenance.current26Provenance, prior.driverProvenance); assert.deepEqual(provenance.unchangedCurrent26, oldDrivers.drivers);
  for (const row of [...provenance.drivers, ...provenance.sourceInputs, ...provenance.auxiliaryInputs, ...provenance.unchangedCurrent26, provenance.buildAuthority, provenance.strictConfig, provenance.strictTypecheckResult]) pin(row);
  const buildAuthority = read(file(provenance.buildAuthority.path));
  assert.equal(buildAuthority.status, 'BOUND_AFTER_F28_DONE_BYTES_ONE_SUPPLEMENTARY_DRIVER_BUILD_ONLY');
  assert.equal(buildAuthority.f28SourceCommit, SOURCE_COMMIT); assert.equal(buildAuthority.f28TransitionCommit, TRANSITION_COMMIT);
  assert.deepEqual(buildAuthority.f28SourceByteProof, F28_SOURCE); assert.deepEqual(buildAuthority.f28TransitionByteProof, F28_TRANSITION);
  assert.equal(buildAuthority.currentNativeBindingSha256, F28_BINDING_SHA); assert.equal(buildAuthority.currentNativeGuardSha256, GUARD.sha256);
  assert.equal(buildAuthority.native09, 'EXPLICIT_USER_DEFERRED_NOT_RUN');
  const strict = canonical('supplementary-native-typecheck-01'), build = canonical('supplementary-driver-build-01');
  assert.deepEqual(strict.arguments, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', path.relative(repo, own('supplementary-native-tsconfig-01.json')).replaceAll('\\', '/')]);
  assert.deepEqual(build.arguments, [path.relative(repo, own('build-supplementary-driver-02.cjs')).replaceAll('\\', '/')]);
  assert.deepEqual(provenance.strictTypecheckResult, fact(own('supplementary-native-typecheck-01.txt.result.json')));
  pin(TOOL_INVENTORY); pin(HISTORY_CHECKPOINT);
  const inventory = read(file(TOOL_INVENTORY.path)), module = read(file(HISTORY_CHECKPOINT.path));
  assert.equal(inventory.pins.length, 11); assert.equal(inventory.versions.playwright, '1.61.1'); assert.equal(inventory.versions.axe, '4.12.1');
  assert.equal(inventory.versions.codeCurrentPinVersion, '1.144.0'); assert.equal(inventory.versions.edgeFileVersionObserved, '157.0.4341.30');
  assert.equal(module.installedModule.files.length, 4);
  for (const row of [...inventory.pins, ...module.installedModule.files]) {
    assert(prior.vendorFacts.some(existing => existing.path === row.path && existing.bytes === row.bytes && existing.sha256 === row.sha256), 'Vendor pin must remain one of the original current reviewed facts.');
    pin(row);
  }
  const metadata = [
    prior.sourceProof, prior.serial, snapshot.currentInputs.content, prior.driverProvenance, prior.hostReview,
    TOOL_INVENTORY, HISTORY_CHECKPOINT, byteBarriers.sourceProof, byteBarriers.transitionProof, byteBarriers.barrier, byteBarriers.acceptance,
    fact(own('supplementary-precommit-driver-provenance-01.json')), provenance.buildAuthority, provenance.strictConfig,
    provenance.strictTypecheckResult, fact(own('supplementary-native-typecheck-01.txt')), fact(own('supplementary-driver-build-01.txt')), fact(own('supplementary-driver-build-01.txt.result.json')),
    fact(own('build-supplementary-driver-02.cjs')), fact(own('supplementary-preparation-invariants-01.cjs')),
    snapshot.originalContract.freeze, snapshot.originalContract.originalSource, snapshot.originalContract.diagnosticSource,
    snapshot.originalContract.diagnosticHelper, snapshot.originalContract.transform, fact(own('original-native34-freeze-01.json')),
    snapshot.oldPacket.defer, fact(own('readiness-snapshot-01.json')), fact(__filename),
    fact(own('native09-host-current-binding-01.ps1')), fact(own('native09-artifact-binding-01.ps1')),
    ...provenance.sourceInputs, ...provenance.auxiliaryInputs, ...provenance.drivers, ...provenance.unchangedCurrent26,
    ...contentEntries, { ...prior.vsix }
  ];
  for (const name of ['compiler-full-02', 'focused-current-02', 'backend-typecheck-01', 'backend-tests-01', 'full-tests-02', 'readiness-02', 'package-02', 'content-02']) for (const suffix of ['.txt', '.txt.result.json', '-owned-close.json', '-verification.json', '-stdout.bin', '-stderr.bin']) metadata.push(fact(file(currentRoot + name + suffix)));
  const factsByPath = new Map();
  for (const row of [...source.files, ...metadata]) {
    if (factsByPath.has(row.path)) assert.deepEqual(row, factsByPath.get(row.path));
    else factsByPath.set(row.path, row);
  }
  const facts = [...factsByPath.values()].sort((left, right) => left.path.localeCompare(right.path)); facts.forEach(workspaceFact);
  return {
    status: STATUS, feature: 'F26a', fileCount: 1076, sourceProof: prior.sourceProof, vsix: prior.vsix,
    frontendSha256: prior.frontendSha256, contentInspection: snapshot.currentInputs.content, extractedRoot: prior.extractedRoot,
    contentEntries, runtimes, driverProvenance: fact(own('supplementary-precommit-driver-provenance-01.json')), newDriver,
    hostReview: prior.hostReview, historyModuleCheckpoint: HISTORY_CHECKPOINT, toolInventory: TOOL_INVENTORY,
    nativeOracles: { primary: 30, restart: 4, total: 34 }, facts,
    native07: 'CONSUMED_FAILED_RETAINED_NO_RETRY', native08: 'CONSUMED_PRIMARY30_PASS_OFFLINE_ADMISSION_FAIL_RESTART4_NOT_RUN', native09: 'EXPLICIT_USER_DEFERRED_NOT_RUN',
    f26aNative09: 'USER_DEFERRED_NOT_RUN', configuredGitPush: 'NO_REMAINING_AUTHORITY_NOT_RUN', releaseReady: false,
    f28ByteBarriers: byteBarriers, guard: fact(__filename), priorNativeBinding: fact(file(currentRoot + 'native-binding-03.json')),
    currentVendorFacts: prior.vendorFacts, originalCaseFreeze: snapshot.originalContract.freeze,
    supplementalBuildAuthority: provenance.buildAuthority, supplementaryStrictResult: provenance.strictTypecheckResult,
    full: content.full, physicalAdmission: prior.physicalAdmission
  };
}
function validate(binding) {
  const now = current();
  for (const [key, value] of Object.entries(now)) if (key !== 'facts') assert.deepEqual(binding[key], value, key);
  assert(Array.isArray(binding.facts)); assert.equal(new Set(binding.facts.map(row => row.path)).size, binding.facts.length);
  assert(binding.facts.length >= now.facts.length);
  const selected = new Map(binding.facts.map(row => [row.path, row]));
  for (const required of now.facts) assert.deepEqual(selected.get(required.path), required, required.path);
  binding.facts.forEach(workspaceFact); return binding;
}
function guard() { return validate(read(own('native09-current-binding-01.json'))); }
module.exports = { repo, own, read, sha, fact, pin, pinSource: pin, relativeFile, canonical, originalChecks, barriers, current, validate, guard };
if (require.main === module) try {
  const answer = process.argv.includes('--current') ? current() : guard();
  console.log(JSON.stringify(process.argv.includes('--emit-binding') ? answer : { status: answer.status, sourceCount: answer.fileCount, supplementaryDrivers: 1, originalOracles: 34, full: answer.full, f26aNative09: answer.f26aNative09, configuredGitPush: answer.configuredGitPush, nativeLaunches: 0 }));
} catch (error) { console.error(error); process.exitCode = 1; }
