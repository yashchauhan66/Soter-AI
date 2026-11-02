'use strict';
// TEXT PREPARATION ONLY. Never builds, typechecks, launches a child or writes an
// executable launcher/helper. Every generated launcher/helper unconditionally
// refuses execution and retains unresolved current binding/provenance fields.
const I = require('./supplementary-preparation-invariants-01.cjs');
const { fs, path, assert, own, current, read, file, fact, retained, deadlines, bootstrap, sha } = I;
function put(name, value) { fs.writeFileSync(own(name), value, { flag: 'wx' }); }
function prepare() {
  assert.deepEqual(process.argv.slice(2), ['--prepare-inert-text-only']);
  const snapshot = retained(), original = fs.readFileSync(file(snapshot.oldPacket.candidate.path), 'utf8');
  const originalHelper = fs.readFileSync(file(snapshot.oldPacket.helper.path), 'utf8');
  const code = snapshot.currentInputs.codePinRecordedByCurrentReview;
  const worker = snapshot.currentInputs.runtimeFacts.find(row => row.path.endsWith('/pre-commit-client.js'));
  assert(worker);
  const changes = [];
  function replace(source, before, after) {
    assert.notEqual(before, after); const count = source.split(before).length - 1;
    assert(count > 0, 'Missing exact replacement: ' + before);
    const beforePositions = []; let offset = 0;
    for (;;) { const index = source.indexOf(before, offset); if (index < 0) break; beforePositions.push(index); offset = index + before.length; }
    changes.push({ before, after, occurrences: count, afterPositions: beforePositions.map((position, index) => position + index * (after.length - before.length)) });
    return source.replaceAll(before, after);
  }
  const helperChanges = [];
  let helper = originalHelper;
  for (const [before, after] of [
    ['325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6', code.sha256],
    ['67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449', worker.sha256],
    ['8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced', '__UNBOUND_SUPPLEMENTARY_DRIVER_SHA256__']
  ]) {
    const count = helper.split(before).length - 1; assert.equal(count, 1);
    helperChanges.push({ before, after, occurrences: count }); helper = helper.replaceAll(before, after);
  }
  const helperGuard = "throw new Error('UNBOUND_NOT_EXECUTABLE_F26A_NATIVE09: post-F28 driver, binding and explicit superseding approval are absent.');\n";
  helper = helper.replace("'use strict';", "'use strict';\n" + helperGuard);
  const helperSuffix = value => value.slice(value.indexOf('  const stdoutFile ='));
  assert.equal(helperSuffix(helper), helperSuffix(originalHelper));
  let reversedHelper = helper.replace(helperGuard, '');
  // The inserted extra newline is tracked explicitly; retain original CRLFs.
  reversedHelper = reversedHelper.replace("'use strict';\n", "'use strict';");
  for (const change of [...helperChanges].reverse()) reversedHelper = reversedHelper.replaceAll(change.after, change.before);
  assert.equal(reversedHelper, originalHelper);
  let candidate = original;
  const oldBlockStart = candidate.indexOf('# Additional exact helper custody before any helper invocation.');
  const oldBlockEnd = candidate.indexOf('foreach($taskInput in @(', oldBlockStart);
  assert(oldBlockStart > 0 && oldBlockEnd > oldBlockStart);
  const oldBlock = candidate.slice(oldBlockStart, oldBlockEnd);
  assert.equal((oldBlock.match(/Assert-F26AFile/g) || []).length, 6);
  const newBlock = `# UNBOUND text-only successor helper custody. All future helpers require new exact-byte binding.
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-current-admission-UNBOUND-01.cjs') '__UNBOUND_CURRENT_GUARD_SHA256__' 0
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-host-current-binding-UNBOUND-01.ps1') '__UNBOUND_HOST_HELPER_SHA256__' 0
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-artifact-binding-UNBOUND-01.ps1') '__UNBOUND_ARTIFACT_HELPER_SHA256__' 0
Assert-F26AFile (Join-Path $taskRepo '${current}current-native-admission-05.cjs') '251638db0be53eb3e79f808316e08c9d192e0eca10741fbc8484fb8353f3e368' 8293
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-offline-owner-UNBOUND-01.cjs') '__UNBOUND_OFFLINE_HELPER_SHA256__' 0
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/native-physical-admission-14.cjs') '6d8aba0bdc97360823f92af00ec5f27d5f05c27389214724e37d53a0e6b5a11d' 3547
`;
  candidate = replace(candidate, oldBlock, newBlock);
  for (const [before, after] of [
    ['16b37a33f203158756f46b3effc54e4fbffdd1a1e2a679d8f239138e3f7d7c18', snapshot.currentInputs.vsix.sha256],
    ['831acd4b52ba7ac888e1030b79f0ccf16956ff3f2efcd9e8f49cdff479e34a0a', snapshot.currentInputs.frontendSha256],
    ['67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449', worker.sha256],
    ['8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced', '__UNBOUND_SUPPLEMENTARY_DRIVER_SHA256__'],
    ['325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6', code.sha256],
    ['238249784', String(code.bytes)],
    ['1.143.1', snapshot.currentInputs.codeVersionRecordedByCurrentReview],
    ['packages/soterai-lite/soterai-lite-0.7.0-f26a-20261029-attempt02.vsix', snapshot.currentInputs.vsix.path],
    ["Join-Path $PSScriptRoot 'vsix-extracted-09/extension'", "Join-Path $taskRepo '" + current + "vsix-extracted-02/extension'"],
    ['prebuilt-native-hosts-09/lite-precommit-guard-host.js', 'supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'],
    ["$_.path -ceq 'supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'", "$_.path -ceq 'docs/soterai-lite/evidence/20261102-f26a-native09-preparation/supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'"],
    ['precommit-offline-owner-09b.cjs', 'native09-offline-owner-UNBOUND-01.cjs'],
    ['native-host-freeze-02.json', 'original-native34-freeze-01.json'],
    ['native-driver-provenance-09.json', 'supplementary-precommit-driver-provenance-01.json'],
    ['6009609cebcb75e194eda092666ff920ad2f4e76ceda6457a3c0232d1491415e', '__UNBOUND_SUPPLEMENTARY_PROVENANCE_SHA256__'],
    ['BUILT_CURRENT1037_DRIVERS25_NOT_NATIVE_ACCEPTANCE', 'F26A_CURRENT1076_SUPPLEMENTARY_DRIVER1_PREPARED_NOT_NATIVE_ACCEPTANCE'],
    ['@($taskProvenance.drivers).Count -ne 25', '@($taskProvenance.drivers).Count -ne 1'],
    ['Current21-driver provenance', 'Current one supplementary driver provenance'],
    ['host-current-binding-08.ps1', 'native09-host-current-binding-UNBOUND-01.ps1'],
    ['artifact-binding-08.ps1', 'native09-artifact-binding-UNBOUND-01.ps1'],
    ['native-current-binding-09.json', 'native09-current-binding-UNBOUND-01.json'],
    ['1795ad43eb9c19d9038d32bfa46ceae4d04fc4456538ea7413b6b601df8bf512', '__UNBOUND_NATIVE09_BINDING_SHA256__'],
    [' 217804', ' 0'],
    ['FRESH1037_FULL09_COMPILER09_BUILD09_ATTEMPT02_BOUND_NATIVE_NOT_RUN', 'F26A_CURRENT1076_NATIVE09_BOUND_NOT_AUTHORIZED_NOT_RUN'],
    ['$taskCurrentBinding.fileCount -ne 1037', '$taskCurrentBinding.fileCount -ne 1076'],
    ['Fresh current990 binding required.', 'Current1076 exact F26a supplementary binding required.'],
    ['NATIVE09-OFFLINE-FIXTURE-PROPOSAL01.md', 'NATIVE09-CURRENT-ARTIFACT-PROPOSAL-UNBOUND-01.md'],
    ['native06', 'native09']
  ]) candidate = replace(candidate, before, after);
  const candidateGuard = "throw 'UNBOUND_NOT_EXECUTABLE_F26A_NATIVE09: source/transition proofs, supplementary driver, current helpers and fresh explicit approval are pending.'\n";
  const guardMarker = '# PREPARED_NOT_EXECUTED. Every Code/Git launch is owned; no signals or pipe aborts.';
  candidate = replace(candidate, guardMarker, candidateGuard + guardMarker);
  assert.equal(bootstrap(candidate), bootstrap(original));
  assert.deepEqual(deadlines(candidate), deadlines(original));
  let reversed = candidate;
  for (const row of [...changes].reverse()) {
    for (const position of [...row.afterPositions].reverse()) {
      assert.equal(reversed.slice(position, position + row.after.length), row.after);
      reversed = reversed.slice(0, position) + row.before + reversed.slice(position + row.after.length);
    }
  }
  assert.equal(reversed, original);
  const requiredUnresolved = [...new Set([...candidate.matchAll(/__UNBOUND_[A-Z0-9_]+__/g), ...helper.matchAll(/__UNBOUND_[A-Z0-9_]+__/g)].map(match => match[0]))].sort();
  assert.deepEqual(requiredUnresolved, [
    '__UNBOUND_ARTIFACT_HELPER_SHA256__', '__UNBOUND_CURRENT_GUARD_SHA256__',
    '__UNBOUND_HOST_HELPER_SHA256__', '__UNBOUND_NATIVE09_BINDING_SHA256__',
    '__UNBOUND_OFFLINE_HELPER_SHA256__', '__UNBOUND_SUPPLEMENTARY_DRIVER_SHA256__',
    '__UNBOUND_SUPPLEMENTARY_PROVENANCE_SHA256__'
  ]);
  const outputs = ['native09-launcher-UNBOUND-01.ps1.txt', 'native09-offline-owner-UNBOUND-01.cjs.txt', 'original-native34-freeze-01.json', 'inert-successor-review-01.json'];
  outputs.forEach(name => assert(!fs.existsSync(own(name)), name));
  put(outputs[0], candidate); put(outputs[1], helper);
  put(outputs[2], fs.readFileSync(file(snapshot.originalContract.freeze.path)));
  const review = {
    status: 'TEXT_ONLY_UNBOUND_NOT_EXECUTABLE_NATIVE09_SUCCESSORS_NO_APPROVAL_OR_NATIVE_COVERAGE', observedAt: new Date().toISOString(),
    originalCandidate: snapshot.oldPacket.candidate, originalHelper: snapshot.oldPacket.helper,
    candidate: fact(own(outputs[0])), helper: fact(own(outputs[1])), original34Freeze: fact(own(outputs[2])),
    candidateChanges: changes, helperChanges, bootstrapByteExact: true, launcherReversalByteExact: true, helperReversalByteExact: true,
    offlineSpawnOwnershipAndOracleSuffixByteExact: true, originalDeadlines: deadlines(original), successorDeadlines: deadlines(candidate),
    original34AssertionsUnchanged: true, currentSourceProof: snapshot.currentInputs.proof, currentArtifact: snapshot.currentInputs.vsix,
    currentCodePinFromExistingReview: code, currentWorkerPin: worker,
    unresolvedFields: requiredUnresolved,
    missingBindingInputs: ['Actual F28 source commit and source byte proof', 'Actual F28 DONE transition and transition byte proof', 'Fresh strict diagnostic host receipt', 'Fresh one-driver build and separate provenance', 'Native09 current admission and host/artifact binding helpers', 'Current native09 binding, exact helper/provenance sizes and hashes', 'Root-reviewed result validator/outer runner/prior-owner observations', 'Reviewable new proposal and byte-verified evidence checkpoint', 'Fresh explicit ONE native09 approval superseding the saved defer'],
    current26DriverOrSourceFilesModified: 0, sourceChanges: 0, builds: 0, typechecks: 0, nativeLaunches: 0, signalsRequested: 0,
    native09: 'EXPLICIT_USER_DEFERRED_NOT_RUN', executableLauncherOrOfflineHelperMaterialized: false,
    limitation: 'The unconditional refusals and unresolved fields must remain until a separate fully reviewed bound successor is prepared after F28 DONE; no old approval or native outcome transfers.'
  };
  put(outputs[3], JSON.stringify(review, null, 2) + '\n');
  console.log(JSON.stringify({ status: review.status, original34: true, unchangedBootstrap: true, unchangedDeadlines: true, unchangedOfflineSpawnSuffix: true, unresolvedFields: requiredUnresolved.length, outputs, builds: 0, nativeLaunches: 0 }));
}
if (require.main === module) try { prepare(); } catch (error) { console.error(error); process.exitCode = 1; }
module.exports = { prepare };
