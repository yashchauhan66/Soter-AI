'use strict';
// INERT: the supplied authority is UNBOUND. Do not execute during active F28.
// A versioned, reviewed successor may build ONE test driver only after F28's
// source and transition byte proofs. This never authorizes native09.
const I = require('./supplementary-preparation-invariants-01.cjs');
const { fs, path, assert, repo, own, current, read, sha, file, fact, exact } = I;
async function main() {
  const authority = read(own('supplementary-build-binding-01.json'));
  assert.equal(authority.status, 'BOUND_AFTER_F28_DONE_BYTES_ONE_SUPPLEMENTARY_DRIVER_BUILD_ONLY', 'UNBOUND_NOT_EXECUTABLE: F28 source/transition and strict receipt remain pending.');
  const snapshot = I.retained();
  assert.equal(authority.sourceProofSha256, snapshot.currentInputs.proof.sha256);
  assert.equal(authority.currentArtifactSha256, snapshot.currentInputs.vsix.sha256);
  for (const [field, commitField, expectedStatus] of [
    ['f28SourceByteProof', 'f28SourceCommit', 'PASS_EXACT_LOCAL_F28_SOURCE14_AND_EVIDENCE_BYTES_TRANSITION_PENDING'],
    ['f28TransitionByteProof', 'f28TransitionCommit', 'PASS_EXACT_LOCAL_F28_DONE_TRANSITION_BYTES']
  ]) {
    assert.match(authority[commitField], /^[a-f0-9]{40}$/);
    const receipt = read(exact(authority[field]));
    assert.equal(receipt.status, expectedStatus); assert.equal(receipt.feature, 'F28');
    assert.equal(receipt.commit, authority[commitField]);
    assert.equal(receipt.mismatches, 0); assert.equal(receipt.unexpectedPaths, 0); assert.equal(receipt.indexEmpty, true);
  }
  const sourceProof = read(file(authority.f28SourceByteProof.path)), transitionProof = read(file(authority.f28TransitionByteProof.path));
  assert.equal(transitionProof.parent, sourceProof.commit);
  const guardPath = file(current + 'current-native-admission-05.cjs');
  assert.equal(fact(guardPath).sha256, authority.currentNativeGuardSha256);
  const A = require(guardPath), binding = A.binding(authority.currentNativeBindingSha256);
  assert.deepEqual(binding.sourceProof, snapshot.currentInputs.proof);
  const typecheckResult = read(exact(authority.supplementaryTypecheckResult));
  assert.equal(typecheckResult.exitCode, 0);
  const typecheckRaw = own('supplementary-native-typecheck-01.txt');
  assert.equal(sha(fs.readFileSync(typecheckRaw)), typecheckResult.sha256.toLowerCase());
  assert.deepEqual(typecheckResult.arguments, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', path.relative(repo, own('supplementary-native-tsconfig-01.json')).split(path.sep).join('/')]);
  const proof = read(file(snapshot.currentInputs.proof.path)); proof.files.forEach(exact);
  const previous = read(file(snapshot.currentInputs.native26DriverProvenance.path));
  assert.equal(previous.drivers.length, 26);
  const unchanged26 = previous.drivers.map(row => ({ ...row })); unchanged26.forEach(exact);
  const out = own('supplementary-prebuilt-hosts-01'); assert(!fs.existsSync(out));
  assert(!fs.existsSync(own('supplementary-precommit-driver-provenance-01.json')));
  const { parserBundleOptions } = require(path.join(repo, 'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
  const esbuild = require('esbuild');
  const built = await esbuild.build({ ...parserBundleOptions(repo), metafile: true, absWorkingDir: repo,
    entryPoints: { 'lite-precommit-guard-host': snapshot.originalContract.diagnosticSource.path }, outdir: out,
    bundle: true, platform: 'node', format: 'cjs', external: ['vscode'],
    tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'), sourcemap: false, logLevel: 'warning' });
  const inputs = Object.keys(built.metafile.inputs).sort();
  assert.equal(inputs.length, 2); assert(!inputs.some(input => /node_modules|phase2|vscode-stub/.test(input)));
  assert.deepEqual(inputs, [snapshot.originalContract.diagnosticSource.path, snapshot.originalContract.diagnosticHelper.path].sort());
  const files = fs.readdirSync(out); assert.deepEqual(files, ['lite-precommit-guard-host.js']);
  const driver = fact(path.join(out, files[0]));
  assert.equal(driver.bytes, snapshot.originalContract.retainedDriver.bytes);
  assert.equal(driver.sha256, snapshot.originalContract.retainedDriver.sha256, 'Changed output requires diagnosis before any launcher binding.');
  proof.files.forEach(exact); unchanged26.forEach(exact); A.binding(authority.currentNativeBindingSha256); I.retained();
  const provenance = {
    status: 'F26A_CURRENT1076_SUPPLEMENTARY_DRIVER1_PREPARED_NOT_NATIVE_ACCEPTANCE', observedAt: new Date().toISOString(),
    feature: 'F26a', sourceProof: snapshot.currentInputs.proof, currentArtifact: snapshot.currentInputs.vsix,
    f28SourceCommit: sourceProof.commit, f28TransitionCommit: transitionProof.commit, buildAuthority: fact(own('supplementary-build-binding-01.json')),
    strictConfig: fact(own('supplementary-native-tsconfig-01.json')), strictTypecheckResult: authority.supplementaryTypecheckResult,
    entryPoints: { 'lite-precommit-guard-host': snapshot.originalContract.diagnosticSource.path },
    sourceInputs: inputs.map(input => fact(file(input))), auxiliaryInputs: [fact(path.join(repo, 'packages/vscode-extension/scripts/parserBundleOptions.cjs')), fact(path.join(repo, 'packages/vscode-extension/tsconfig.json'))],
    drivers: [driver], retainedDriverComparison: { byteExact: true, original: snapshot.originalContract.retainedDriver },
    current26Provenance: snapshot.currentInputs.native26DriverProvenance, unchangedCurrent26: unchanged26,
    originalOracles: { primary: 30, restart: 4, total: 34 }, diagnosticReversalByteExact: true, original34AddExpressionsByteEqual: true,
    native09: 'EXPLICIT_USER_DEFERRED_NOT_RUN', nativeLaunches: 0, productionChanges: 0, signalsRequested: 0
  };
  fs.writeFileSync(own('supplementary-precommit-driver-provenance-01.json'), JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: provenance.status, supplementaryDrivers: 1, originalOracles: 34, current26Unchanged: true, driver, nativeLaunches: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
