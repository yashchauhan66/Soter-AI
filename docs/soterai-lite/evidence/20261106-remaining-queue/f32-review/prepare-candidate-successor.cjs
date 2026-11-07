'use strict';
// Inert on import. The CLI prepares new evidence files only: no child process,
// Code launch, installation, download, product import, or process signal.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const originalRoot = path.resolve(__dirname, '../../20261103-f32-lifecycle-2e95d6a4');
const repo = path.resolve(originalRoot, '../../../..');
const own = name => path.join(originalRoot, name);
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const text = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.resolve(file), bytes: raw.length, sha256: sha(raw) }; };
const pin = row => {
  assert(row && path.isAbsolute(row.path)); const actual = fact(row.path);
  assert.equal(actual.path,row.path); assert.equal(actual.bytes,row.bytes); assert.equal(actual.sha256,row.sha256);
  return row;
};
const pinned = row => { pin(row); return read(row.path); };
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const R21 = 'F32-R21 a pending nonmodal completion notice cannot block the fixed removal report';
const r21Passes = raw => raw.toString('utf8').split(/\r?\n/).filter(line => new RegExp('^ok \\d+ - ' + R21 + '$').test(line));
function replaceOne(source, before, after) {
  const at = source.indexOf(before);
  assert(at >= 0 && at === source.lastIndexOf(before), 'Expected one exact source replacement: ' + before.slice(0, 100));
  return source.replace(before, after);
}
function verifyClose(row, expectedCode = 0) {
  const value = pinned(row);
  for (const [key, expected] of Object.entries({ actualClose: true, exitCode: expectedCode, signal: null,
    stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(value[key], expected, key);
  assert.deepEqual(value.streams.map(stream => stream.name).sort(), ['stderr', 'stdout']);
  for (const stream of value.streams) {
    assert.equal(stream.bytes, stream.observedBytes);
    pin({ path: row.path.replace(/owned-close\.json$/, stream.name + '.bin'), bytes: stream.bytes, sha256: stream.sha256 });
  }
  return value;
}
const historicalHelper = `
function verifyHistoricalInputs(earlier) {
  // Historical descriptors/archives remain exact. Their old source file bytes
  // are archival evidence, not a requirement that future fixes revert to them.
  const proof = pinnedJson(earlier.sourceProof);
  assert.equal(proof.status, 'FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE');
  assert(/^[a-f0-9]{40}$/.test(proof.sourceParent));
  pin(earlier.currentVsix);
}
function verifyPreviousExtra07(a) {
  const p = a.previousExtra07; assert(p);
  assert.equal(p.admission.path, path.join(__dirname, 'installed-extra07-admission.json'));
  assert.equal(p.consumed.path, path.join(__dirname, 'installed-extra07-consumed.json'));
  for (const row of Object.values(p)) pin(row);
  const earlier = pinnedJson(p.admission), consumed = pinnedJson(p.consumed), failure = pinnedJson(p.failure);
  assert.equal(earlier.status, 'ROOT_REVIEWED_F32_INSTALLED_EXTRA07_FINAL_INPUTS');
  assert.equal(consumed.status, 'CONSUMED_ONE_EXPLICIT_EXTRA07_NO_RETRY');
  assert.deepEqual(consumed.admission, p.admission); assert.equal(consumed.runRoot, earlier.runRoot);
  assert.deepEqual(consumed.fixtureRunner, earlier.fixtures.runner); pin(consumed.fixtureRunner);
  assert.equal(consumed.signalsRequested, 0); assert.notEqual(a.runRoot.toLowerCase(), earlier.runRoot.toLowerCase());
  verifyHistoricalInputs(earlier);
  const gate = path.join(earlier.runRoot, 'profile-primary', 'F32Gate', 'primary');
  assert.equal(p.failure.path, path.join(earlier.runRoot, 'receipts', 'installed-extra07-failure.json'));
  assert.equal(failure.status, 'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE');
  assert.equal(failure.signalsRequested, 0);
  assert.deepEqual(failure.completed.map(row => row.name), ['primary-before-cli-absence', 'primary-inventory-before', 'primary-install-current', 'primary-inventory-installed', 'primary-prelaunch-absence', 'primary-listener-custody', 'primary-code']);
  for (const row of failure.completed) verifyClose(row.close);
  assert.equal(p.codeClose.path, path.join(gate, 'primary-code-owned-close.json')); verifyClose(p.codeClose);
  assert.equal(p.rendererClose.path, path.join(gate, 'primary-renderer-owned-close.json'));
  const renderer = pinnedJson(p.rendererClose);
  for (const [key, expected] of Object.entries({ actualClose: true, exitCode: 1, signal: null, stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(renderer[key], expected, key);
  assert.deepEqual(renderer.streams.map(row => row.name).sort(), ['stderr', 'stdout']);
  for (const stream of renderer.streams) {
    assert.equal(stream.observedBytes, stream.bytes);
    pin({ path: p.rendererClose.path.replace(/owned-close\\.json$/, stream.name + '.bin'), bytes: stream.bytes, sha256: stream.sha256 });
  }
  assert.equal(p.observerFailure.path, path.join(gate, 'primary-observer-failure.json'));
  const failed = pinnedJson(p.observerFailure);
  assert.equal(failed.status, 'FAIL_NO_RETRY'); assert.equal(failed.stage, 'NATIVE_TRUST_HANDSHAKE');
  assert.equal(failed.trust.isTrusted, true); assert.equal(failed.signalsRequested, 0);
  assert.equal(p.trustBefore.path, path.join(gate, 'primary-trust-before.json'));
  assert.equal(pinnedJson(p.trustBefore).isTrusted, false);
  assert.equal(p.rendererTrustBefore.path, path.join(gate, 'primary-renderer-trust-before.json'));
  const initial = pinnedJson(p.rendererTrustBefore);
  assert.equal(initial.visibleNativeDialogCount, 0); assert.equal(initial.trustWordsPresent, false);
}
`;
function trustObserver(source) {
  const before = '    const actual = await until(()=>fs.existsSync(target)&&read(target),90000,\'Real native trust keyboard receipt missing\');';
  const replacement = `    const intentPath = path.join(b.gate, b.phase + '-trust-keyboard-intent.json');
    const trustStart = Date.now(); let recordedGrant = false;
    const actual = await until(() => {
      const hasReceipt = fs.existsSync(target), hasIntent = fs.existsSync(intentPath);
      if (vscode.workspace.isTrusted && !recordedGrant) {
        recordedGrant = true;
        write(path.join(b.gate, b.phase + '-trust-grant-observation.json'), {
          observedAt: new Date().toISOString(), elapsedMs: Date.now() - trustStart,
          phase: b.phase, isTrusted: true, keyboardIntentPresent: hasIntent, keyboardReceiptPresent: hasReceipt,
          signalsRequested: 0,
        });
      }
      if (vscode.workspace.isTrusted && !hasReceipt && !hasIntent) throw Error('Fresh workspace trusted before witnessed keyboard intent');
      if (hasIntent) {
        const intent = read(intentPath);
        assert.equal(intent.status, 'OBSERVED_TRUST_BUTTON_FOCUS_BEFORE_KEYBOARD');
        assert.equal(intent.phase, b.phase); assert.equal(intent.choice, b.trustChoice);
        assert.equal(intent.workspaceName, path.basename(b.workspace)); assert.equal(intent.signalsRequested, 0);
      }
      // An intent records no acceptance. Only the existing post-keyboard receipt
      // below, with the actual public trust state, can complete this handshake.
      return hasReceipt && read(target);
    }, 90000, 'Real native trust keyboard receipt missing');`;
  source = replaceOne(source, before, replacement);
  return replaceOne(source,
    "write(path.join(b.gate,b.phase+'-trust-before.json'),collectTrustSnapshot(vscode));",
    "write(path.join(b.gate,b.phase+'-trust-before.json'),{observedAt:new Date().toISOString(),...collectTrustSnapshot(vscode)});");
}
function trustRenderer(source) {
  source = replaceOne(source, 'async function keyboardButton(text) {', 'async function keyboardButton(text, beforeEnter) {');
  source = replaceOne(source, "if (focused) { await page.keyboard.press('Enter'); return; }", "if (focused) { if (beforeEnter) beforeEnter(); await page.keyboard.press('Enter'); return; }");
  source = replaceOne(source, '      await keyboardButton(b.trustChoice);', `      await keyboardButton(b.trustChoice, () => write(path.join(b.gate, b.phase + '-trust-keyboard-intent.json'), {
        status: 'OBSERVED_TRUST_BUTTON_FOCUS_BEFORE_KEYBOARD', observedAt: new Date().toISOString(),
        phase: b.phase, choice: b.trustChoice, workspaceName: path.basename(b.workspace), signalsRequested: 0,
      }));`);
  return replaceOne(source,
    "write(path.join(b.gate,b.phase+'-renderer-trust-before.json'),safeTrustMetadata);",
    "write(path.join(b.gate,b.phase+'-renderer-trust-before.json'),{observedAt:new Date().toISOString(),...safeTrustMetadata});");
}
function buildSources({ trustDiagnostics = true } = {}) {
  assert.equal(typeof trustDiagnostics, 'boolean');
  let runner = text(own('run-installed-lifecycle-proposed-07.cjs'));
  for (const [before, after] of [
    ['extra07', 'extra08'], ['EXTRA07', 'EXTRA08'], ['PROPOSAL08', 'PROPOSAL09'],
    ['CURRENT-HOST-VERIFICATION-PROPOSAL08.md', 'CURRENT-CANDIDATE-VERIFICATION-PROPOSAL09.md'],
    ['CURRENT-HOST-VERIFICATION-PROPOSAL09.md', 'CURRENT-CANDIDATE-VERIFICATION-PROPOSAL09.md'],
    ['installed-observer-proposed-05.cjs', 'installed-observer-proposed-07.cjs'],
    ['installed-upgrade-old-observer-proposed-04.cjs', 'installed-upgrade-old-observer-proposed-06.cjs'],
    ['installed-renderer-proposed-05.cjs', 'installed-renderer-proposed-07.cjs'],
    ['native-owned-gui-phase-proposed-07.cjs', 'native-owned-gui-phase-proposed-08.cjs'],
    ['USER_REQUESTED_F32_COMPLETION_LOCAL_VERIFICATION', 'USER_APPROVED_REMAINING_WORK_AND_ISOLATED_LOCAL_TESTS'],
    ['F26a remains user-skipped INCOMPLETE and unsupported', 'F26a completion is separately evidenced and not inferred from these lifecycle phases'],
  ]) runner = runner.replaceAll(before, after);
  runner = replaceOne(runner, 'function verifySource(proof) {', 'function verifySource(proof, expectedSourceParent) {');
  runner = replaceOne(runner, "assert.equal(proof.sourceParent, '4f5154c4c646f057f8bf6518572586cf5a9dad8d');", "assert(/^[a-f0-9]{40}$/.test(expectedSourceParent)); assert.equal(proof.sourceParent, expectedSourceParent);");
  runner = replaceOne(runner, 'const proof = pinnedJson(a.sourceProof); verifySource(proof);', 'const proof = pinnedJson(a.sourceProof); verifySource(proof, a.sourceParent);');
  runner = replaceOne(runner, 'verifySource(admitted.proof); pin(admitted.admissionFact); pin(marker);', 'verifySource(admitted.proof, a.sourceParent); pin(admitted.admissionFact); pin(marker);');
  runner = replaceOne(runner, 'assert.equal(earlier.sourceProof.sha256, a.sourceProof.sha256); assert.deepEqual(earlier.currentVsix, a.currentVsix);', 'verifyHistoricalInputs(earlier);');
  assert.equal(runner.split('assert.equal(earlier.sourceProof.sha256,a.sourceProof.sha256);assert.deepEqual(earlier.currentVsix,a.currentVsix);').length - 1, 2);
  runner = runner.replaceAll('assert.equal(earlier.sourceProof.sha256,a.sourceProof.sha256);assert.deepEqual(earlier.currentVsix,a.currentVsix);', 'verifyHistoricalInputs(earlier);');
  runner = replaceOne(runner, 'function reviewedAdmission(admissionFile, expectedSha) {', historicalHelper + '\nfunction reviewedAdmission(admissionFile, expectedSha) {');
  assert.equal(runner.split('verifyPreviousExtra05(a); verifyPreviousExtra06(a);').length - 1, 2);
  runner = runner.replaceAll('verifyPreviousExtra05(a); verifyPreviousExtra06(a);', 'verifyPreviousExtra05(a); verifyPreviousExtra06(a); verifyPreviousExtra07(a);');
  runner = replaceOne(runner, "assert.equal(qualified.feature,'F32');assert.equal(qualified.status,'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST');", `assert.equal(qualified.feature,'F32');assert.equal(qualified.status,'DERIVED_EXACT_CANDIDATE_INSTALL_SIZE_CURRENT_VENDOR_CONTRACT');
  const contract=pinnedJson(qualified.retainedVendorContract);
  assert.equal(contract.status,'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST');
  assert.equal(contract.vendorReceiptSha256,a.vendorReceipt.sha256);assert.equal(contract.oldVsixSha256,a.oldVsix.sha256);
  for(const key of ['current','old'])for(const name of ['installClose','listClose'])verifyClose(contract[key][name]);
  assert.equal(qualified.nativeCandidateInstallAlreadyObserved,false);`);
  runner = replaceOne(runner, 'assert.equal(regression.failed, 0); assert(regression.passed >= 1);', `assert.equal(regression.failed, 0); assert.equal(regression.passed, 1);
  assert.deepEqual(regression.fullAcceptance,a.fullAcceptance);verifyClose(regression.shardClose);pin(regression.shardStdout);
  const r21Lines=readFile(regression.shardStdout.path,8*1024*1024).toString('utf8').split(/\\r?\\n/);
  assert.equal(r21Lines.filter(line=>/^ok \\d+ - F32-R21 a pending nonmodal completion notice cannot block the fixed removal report$/.test(line)).length,1);`);
  runner = replaceOne(runner, 'module.exports = { run, reviewedAdmission,', 'module.exports = { verifySource, verifyHistoricalInputs, verifyPreviousExtra07, run, reviewedAdmission,');
  let observer = text(path.join(__dirname, 'installed-observer-proposed-06.cjs'));
  let oldObserver = text(path.join(__dirname, 'installed-upgrade-old-observer-proposed-05.cjs'));
  let renderer = text(path.join(__dirname, 'installed-renderer-proposed-06.cjs'));
  if (trustDiagnostics) { observer = trustObserver(observer); oldObserver = trustObserver(oldObserver); renderer = trustRenderer(renderer); }
  const gui = text(own('native-owned-gui-phase-proposed-07.cjs')).replaceAll('EXTRA07', 'EXTRA08').replaceAll('PROPOSAL08', 'PROPOSAL09');
  const take = source => source.slice(source.indexOf('    const primary = binding'), source.indexOf('    stable();\n    // No new human/admin gate.'));
  assert.equal(take(runner), take(text(own('run-installed-lifecycle-proposed-07.cjs'))));
  return {
    'run-installed-lifecycle-proposed-08.cjs': runner,
    'native-owned-gui-phase-proposed-08.cjs': gui,
    'installed-observer-proposed-07.cjs': observer,
    'installed-upgrade-old-observer-proposed-06.cjs': oldObserver,
    'installed-renderer-proposed-07.cjs': renderer,
  };
}
function qualifyInputs(config) {
  assert(config && /^[a-f0-9]{40}$/.test(config.sourceParent));
  for (const key of ['sourceProof', 'fullAcceptance', 'finalQualification', 'currentVsix']) pin(config[key]);
  const proof = pinned(config.sourceProof), full = pinned(config.fullAcceptance), qualification = pinned(config.finalQualification);
  assert.equal(proof.status, 'FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE');
  assert.equal(proof.sourceParent, config.sourceParent); assert.equal(proof.fileCount, proof.files.length);
  assert.equal(full.status, 'PASS_F32_CURRENT_ALL_FROZEN_TEST_FILES'); assert.equal(full.sourceProofSha256, config.sourceProof.sha256);
  assert.equal(qualification.feature, 'F32'); assert.equal(qualification.status, 'FINAL_SOURCE_FULL_COMPILER_VSIX_CONTENT_BACKEND_REVIEWED_NATIVE_PENDING');
  assert.equal(qualification.sourceProofSha256, config.sourceProof.sha256); assert.deepEqual(qualification.vsix, config.currentVsix);
  assert.equal(qualification.fullAcceptanceSha256, config.fullAcceptance.sha256);
  for (const key of ['compiler', 'content', 'backend']) assert.equal(qualification.checks[key], 'PASS_EXACT_CURRENT');
  for (const row of qualification.ownedCloseReceipts) verifyClose(row);
  for (const row of proof.files) {
    const file = path.resolve(repo, row.path); assert(file.startsWith(repo + path.sep));
    pin({ ...row, path: file });
  }
  const expectedTests = proof.files.filter(row => row.path.startsWith('packages/vscode-extension/src/__tests__/') && row.path.endsWith('.test.ts')).map(row => row.path).sort();
  assert.deepEqual(full.shards.flatMap(shard => shard.files).sort(), expectedTests); assert.equal(full.fileCount, expectedTests.length);
  const total = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (const shard of full.shards) {
    assert(/^[a-zA-Z0-9-]+$/.test(shard.name));
    const closed = fact(path.join(path.dirname(config.fullAcceptance.path), shard.name + '-owned-close.json'));
    verifyClose(closed);
    const stdout = fs.readFileSync(closed.path.replace(/owned-close\.json$/, 'stdout.bin'), 'utf8');
    for (const key of Object.keys(total)) {
      const matches = [...stdout.matchAll(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'gm'))];
      assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), shard.counts[key]); total[key] += shard.counts[key];
    }
  }
  assert.deepEqual(total, full.counts); assert.equal(total.fail, 0); assert.equal(total.cancelled, 0); assert.equal(total.todo, 0);
  assert.equal(total.tests, total.pass + total.skipped);
  const regressionShards = full.shards.filter(shard => shard.files.includes('packages/vscode-extension/src/__tests__/lifecycleRecoveryCommands.test.ts'));
  assert.equal(regressionShards.length, 1);
  const shardClose = fact(path.join(path.dirname(config.fullAcceptance.path), regressionShards[0].name + '-owned-close.json'));
  const shardStdout = fact(shardClose.path.replace(/owned-close\.json$/, 'stdout.bin'));
  assert.equal(r21Passes(fs.readFileSync(shardStdout.path)).length, 1);
  return { proof, full, qualification, shardClose, shardStdout, expectedTests };
}
function prepare(config) {
  const inputs = qualifyInputs(config);
  const legacy = require(own('run-installed-lifecycle-proposed-07.cjs'));
  const current = legacy.inspectVsix(config.currentVsix, '0.7.0', 4);
  const priorAdmission = read(own('installed-extra07-admission.json'));
  const old = legacy.inspectVsix(priorAdmission.oldVsix, '0.6.3', 3);
  const vendor = pinned(priorAdmission.vendorReceipt);
  assert.equal(inputs.qualification.currentVendorReceiptSha256, priorAdmission.vendorReceipt.sha256);
  assert.equal(vendor.currentHost.version, '1.145.1');
  assert.equal(vendor.currentHost.commit, '6bab64e2d12b04d04c0d99c27ff166023efd1dda');
  for (const row of vendor.vendorFacts) pin(row);
  assert.equal(inputs.qualification.payload.manifestSha256, current.manifestSha256);
  assert.deepEqual([...inputs.qualification.payload.runtimes].sort((a,b)=>a.relative.localeCompare(b.relative)), current.runtimes);
  assert.equal(inputs.qualification.payload.payloadUncompressedBytes, current.payloadUncompressedBytes);
  assert.equal(inputs.qualification.payload.targetPlatform, 'win32-x64');
  const generated = new Map(Object.entries(buildSources(config)).map(([name, content]) => [name, Buffer.from(content)]));
  const stage = (name, value) => { assert(!generated.has(name)); generated.set(name, jsonBytes(value)); return { path: own(name), bytes: generated.get(name).length, sha256: sha(generated.get(name)) }; };
  const sourceFact = name => { const raw = generated.get(name); assert(raw); return { path: own(name), bytes: raw.length, sha256: sha(raw) }; };
  const a = structuredClone(priorAdmission);
  a.status = 'ROOT_REVIEWED_F32_INSTALLED_EXTRA08_FINAL_INPUTS'; a.extraAttempt = 'PROPOSAL09';
  a.sourceParent = config.sourceParent; a.sourceProof = config.sourceProof; a.fullAcceptance = config.fullAcceptance; a.currentVsix = config.currentVsix;
  a.expectedInputCount = inputs.proof.fileCount; a.expectedScopedSourceCount = inputs.proof.scopedSource.length; a.expectedTestFileCount = inputs.full.fileCount;
  a.runRoot = config.runRoot ?? ('D:\\SoterAI-Lite-test-profiles\\f32-installed-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + '-' + crypto.randomBytes(4).toString('hex'));
  assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(a.runRoot)); assert(!fs.existsSync(a.runRoot));
  a.debugPorts = config.debugPorts ?? [54731,54732,54733,54734,54735,54736,54737,54738]; a.configuredBrokerPort = config.configuredBrokerPort ?? 54739;
  assert.equal(a.debugPorts.length,8); assert.equal(new Set(a.debugPorts).size,8);
  for(const port of [...a.debugPorts,a.configuredBrokerPort])assert(Number.isInteger(port)&&port>=1024&&port<=65535);
  assert(!a.debugPorts.includes(a.configuredBrokerPort)&&a.configuredBrokerPort!==47321);
  a.syntheticCanary = 'SOTERAI_F32_SYNTHETIC_CURRENT_CANDIDATE_20261106';
  for (const [key,name] of Object.entries({ runner:'run-installed-lifecycle-proposed-08.cjs',guiHelper:'native-owned-gui-phase-proposed-08.cjs',
    observer:'installed-observer-proposed-07.cjs',oldObserver:'installed-upgrade-old-observer-proposed-06.cjs',renderer:'installed-renderer-proposed-07.cjs' })) a.fixtures[key]=sourceFact(name);
  const oldGate = path.join(priorAdmission.runRoot,'profile-primary','F32Gate','primary');
  a.previousExtra07 = Object.fromEntries(Object.entries({ admission:own('installed-extra07-admission.json'),consumed:own('installed-extra07-consumed.json'),
    failure:path.join(priorAdmission.runRoot,'receipts','installed-extra07-failure.json'), codeClose:path.join(oldGate,'primary-code-owned-close.json'),
    rendererClose:path.join(oldGate,'primary-renderer-owned-close.json'), observerFailure:path.join(oldGate,'primary-observer-failure.json'),
    trustBefore:path.join(oldGate,'primary-trust-before.json'), rendererTrustBefore:path.join(oldGate,'primary-renderer-trust-before.json') }).map(([key,file])=>[key,fact(file)]));
  verifyClose(a.previousExtra07.codeClose); verifyClose(a.previousExtra07.rendererClose,1);
  const regression = { feature:'F32',status:'PASS_CURRENT_NATIVE_NOTIFICATION_RETURN_CONTRACT',sourceProofSha256:a.sourceProof.sha256,
    passed:1,failed:0,scope:'Exact R21 PASS in the new fully accepted test shard; native UI remains pending',
    fullAcceptance:a.fullAcceptance,shardClose:inputs.shardClose,shardStdout:inputs.shardStdout };
  a.notificationAwaitRegression=stage('notification-return-qualification-02.json',regression);
  const previousInstaller = pinned(priorAdmission.installerSizeQualification);
  assert.equal(previousInstaller.status,'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST');
  assert.equal(previousInstaller.vendorReceiptSha256,a.vendorReceipt.sha256);
  for(const key of ['current','old'])for(const name of ['installClose','listClose'])verifyClose(previousInstaller[key][name]);
  a.installerSizeQualification=stage('candidate-installer-size-contract-01.json',{feature:'F32',status:'DERIVED_EXACT_CANDIDATE_INSTALL_SIZE_CURRENT_VENDOR_CONTRACT',
    retainedVendorContract:priorAdmission.installerSizeQualification,vendorReceiptSha256:a.vendorReceipt.sha256,currentVsixSha256:a.currentVsix.sha256,oldVsixSha256:a.oldVsix.sha256,
    nativeCandidateInstallAlreadyObserved:false,current:{archiveXml:current.archiveXml,payloadUncompressedBytes:current.payloadUncompressedBytes,vendorInstalledSize:current.vendorInstalledSize},
    old:{archiveXml:old.archiveXml,payloadUncompressedBytes:old.payloadUncompressedBytes,vendorInstalledSize:old.vendorInstalledSize},
    scope:'Expected serialization from unchanged current vendor contract; actual candidate CLI install and exact installed manifest are verified by the lifecycle run'});
  a.finalQualification=stage('current-candidate-qualification-01.json',{...inputs.qualification,
    notificationAwaitRegressionSha256:a.notificationAwaitRegression.sha256,qualificationInput:config.finalQualification,
    currentCandidateRegression:a.notificationAwaitRegression});
  const proposalName='CURRENT-CANDIDATE-VERIFICATION-PROPOSAL09.md';
  generated.set(proposalName,Buffer.from('# Current candidate F32 verification\n\nUses the existing user request to complete the remaining work and the explicit approval for isolated local tests. The current candidate and test evidence are freshly pinned; old failures stay unchanged. The observer-renderer completion acknowledgment and optional timestamped trust diagnostics add no acceptance observation. All original 44 assertions, 59 observations, and eight phases remain required. The generator never launches native processes; the later runner remains subject to the execution environment boundary.\n'));
  a.extraApproval=stage('installed-extra08-user-approval.json',{feature:'F32',status:'USER_APPROVED_REMAINING_WORK_AND_ISOLATED_LOCAL_TESTS',extraAttempt:'PROPOSAL09',approved:true,maxAttempts:1,
    syntheticOnly:true,signalsRequested:0,runRoot:a.runRoot,
    userAnswer:'continue complete remaninig work very fast | Haan, local tests aur isolated VS Code checks approve hain',
    authorityScope:'Existing repeated user task plus explicit approval for local tests and isolated VS Code checks. This records standing authorization; it is not a new approval gate.',
    proposal:sourceFact(proposalName),runner:a.fixtures.runner,sourceProof:a.sourceProof,currentVsix:a.currentVsix});
  const admission=stage('installed-extra08-admission.json',a);
  for(const name of generated.keys())assert(!fs.existsSync(own(name)),'Refusing to overwrite evidence '+name);
  for(const [name,raw]of generated)fs.writeFileSync(own(name),raw,{flag:'wx'});
  const successor=require(a.fixtures.runner.path);
  successor.reviewedAdmission(admission.path,admission.sha256);successor.verifyExtraApproval(a);
  const result={status:'PASS_CURRENT_CANDIDATE_STATIC_ADMISSION_NO_NATIVE_LAUNCH',admission,runRoot:a.runRoot,currentVsix:a.currentVsix,
    generated:[...generated.keys()].map(name=>fact(own(name))),nativeLaunches:0,signalsRequested:0};
  fs.writeFileSync(path.join(__dirname,'candidate-preparation-result.json'),jsonBytes(result),{flag:'wx'});
  return result;
}
if(require.main===module){
  if(process.argv.length!==3){process.stderr.write('Usage: node prepare-candidate-successor.cjs <config.json>\n');process.exitCode=1;}
  else { const result=prepare(read(path.resolve(process.argv[2])));process.stdout.write(JSON.stringify(result,null,2)+'\n'); }
}
module.exports={buildSources,qualifyInputs,prepare,fact,pin,verifyClose,r21Passes,replaceOne,trustObserver,trustRenderer};
