'use strict';
// Parallel specification preparation only. Reads existing files, parses TypeScript
// without emitting, and writes one new report here. No build, test, child, native
// host, listener, Git operation, profile or approval materialization.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../../..');
const old = 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/';
const current = 'docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/';
const read = p => JSON.parse(fs.readFileSync(path.resolve(repo, p), 'utf8').replace(/^\uFEFF/, ''));
const text = p => fs.readFileSync(path.resolve(repo, p), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function fact(p) {
  const file = path.resolve(repo, p), raw = fs.readFileSync(file);
  return { path: path.relative(repo, file).split(path.sep).join('/'), bytes: raw.length, sha256: sha(raw) };
}
function exact(row) { assert.deepEqual(fact(row.path), row); return row; }
function calls(source) {
  const parsed = ts.createSourceFile('retained-fixture.ts', source, ts.ScriptTarget.Latest, true);
  const rows = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'add') {
      assert(ts.isStringLiteral(node.arguments[0]));
      rows.push({ scope: node.arguments[0].text, expression: node.getText(parsed) });
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed); return rows;
}
function main() {
  const proof = read(current + 'full-inputs-02.json'), oldProof = read(old + 'full-inputs-09.json');
  assert.equal(fact(current + 'full-inputs-02.json').sha256, '70d3b237332ada5f7317906a8e745ff7d8f7bc2213b8c27f810a25b919b30743');
  assert.equal(proof.fileCount, 1076); assert.equal(proof.files.length, 1076);
  assert.equal(proof.protectedF26a.length, 3);
  assert.deepEqual(proof.protectedF26a, oldProof.changedSource);
  const protectedSources = proof.protectedF26a.map(exact);
  for (const row of protectedSources) assert.deepEqual(proof.files.find(x => x.path === row.path), row);
  const freeze = read(old + 'native-host-freeze-02.json');
  exact({ path: freeze.file, bytes: freeze.bytes, sha256: freeze.sha256 });
  const original = text(freeze.file), diagnostic = text(old + 'f26a-install-diagnostics-08.host.ts');
  const transform = read(old + 'diagnostic-transform-08.json');
  let reversed = diagnostic;
  for (const row of [...transform.changes].reverse()) {
    assert.equal(reversed.split(row.after).length, 2);
    reversed = reversed.replace(row.after, row.before);
  }
  assert.equal(reversed, original);
  const originalCalls = calls(original), diagnosticCalls = calls(diagnostic);
  assert.equal(originalCalls.length, 34); assert.deepEqual(diagnosticCalls, originalCalls);
  assert.deepEqual(originalCalls.map(row => row.scope), [...freeze.primary, ...freeze.restart]);
  const content = read(current + 'content-inspection-02.json');
  const vsix = exact({ path: content.vsix.output.replaceAll('\\', '/'), bytes: content.vsix.bytes, sha256: content.vsix.sha256 });
  const runtimeFacts = content.entries.filter(row => /^extension\/dist\/[^/]+\.js$/.test(row.path)).map(row =>
    exact({ path: current + 'vsix-extracted-02/' + row.path, bytes: row.bytes, sha256: row.sha256 }));
  assert.equal(runtimeFacts.length, 4);
  const binding = read(current + 'native-binding-03.json'), host = read(binding.hostReview.path);
  const selectedDriver = exact({ path: old + 'prebuilt-native-hosts-09/lite-precommit-guard-host.js', bytes: 74473, sha256: '8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced' });
  const helper = text(old + 'precommit-offline-owner-09b.cjs.txt');
  const oldHelper = text(old + 'precommit-offline-owner-01.cjs');
  const suffix = source => source.slice(source.indexOf('  const stdoutFile ='));
  assert.equal(suffix(helper), suffix(oldHelper));
  const candidate = text(old + 'native09-candidate-02.ps1.txt');
  const loops = [...candidate.matchAll(/(?:TotalSeconds|ElapsedMilliseconds)\s*-lt\s*\d+/g)].map(row => row[0]);
  const absent = ['native09-user-approval-01.json', 'native09-consumption-01.json', 'run-precommit-native-09.ps1', 'precommit-offline-owner-09b.cjs', 'native09-chain-start-01.json'].map(name => ({ path: old + name, absent: !fs.existsSync(path.resolve(repo, old + name)) }));
  assert(absent.every(row => row.absent));
  const defer = read(old + 'native09-user-decision-01.json');
  assert.equal(defer.exactAnswer, 'Abhi native09 mat chalao');
  const currentDrivers = read(current + 'native-driver-provenance-05.json');
  assert.equal(currentDrivers.drivers.length, 26);
  assert(!currentDrivers.drivers.some(row => /precommit|pre-commit/i.test(path.basename(row.path))));
  const report = {
    schemaVersion: 1, status: 'READ_ONLY_F26A_NATIVE09_REFRESH_MAPPING_NOT_A_RUN_PACKET_OR_COVERAGE',
    observedAt: new Date().toISOString(), activeFeature: 'F28',
    permittedWork: 'Parallel specification and retained-byte inspection only; future F26a implementation remains inactive.',
    oldPacket: { proposal: fact(old + 'NATIVE09-OFFLINE-FIXTURE-PROPOSAL01.md'), candidate: fact(old + 'native09-candidate-02.ps1.txt'), helper: fact(old + 'precommit-offline-owner-09b.cjs.txt'), binding: fact(old + 'native-current-binding-09.json'), defer: fact(old + 'native09-user-decision-01.json'), native08Result: fact(old + 'native08-chain-result-02.json') },
    currentInputs: { proof: fact(current + 'full-inputs-02.json'), fileCount: proof.fileCount, content: fact(current + 'content-inspection-02.json'), vsix, frontendSha256: content.vsix.extensionSha256, runtimeFacts, fullCountsRecordedByContent: content.full, fullCountsIndependentlyReexecutedHere: false, hostReview: exact(binding.hostReview), codePinRecordedByCurrentReview: host.currentHost.executable, codeVersionRecordedByCurrentReview: host.currentHost.version, installedCodeRehashedHere: false, native26DriverProvenance: fact(current + 'native-driver-provenance-05.json'), precommitDriverIncludedInCurrent26: false },
    originalContract: { freeze: fact(old + 'native-host-freeze-02.json'), originalSource: fact(freeze.file), diagnosticSource: fact(old + 'f26a-install-diagnostics-08.host.ts'), diagnosticHelper: fact(old + 'install-diagnostics-07.ts'), transform: fact(old + 'diagnostic-transform-08.json'), originalPrimaryCount: freeze.primary.length, originalRestartCount: freeze.restart.length, originalAddExpressionsByteEqual: true, diagnosticReversalByteExact: true, scopes: originalCalls.map((row, index) => ({ phase: index < 30 ? 'primary' : 'restart', index: index < 30 ? index + 1 : index - 29, scope: row.scope })), retainedDriver: selectedDriver, retainedOfflineSpawnAndOracleSuffixByteExact: true, deadlineFragments: { launcherLoops: loops, outerMs: 1200000, nativeChildMs: 90000, offlineGitMs: 90000, streamCapExpression: '1048576 + 128 * 96 + 8192' } },
    custody: { protectedSources, unchangedAgainstF26aFull09AndCurrentF28Proof: true, filesWrittenOutsidePreparationDirectory: 0, gitOperations: 0, sourceChanges: 0, builds: 0, typechecks: 0, nativeLaunches: 0, signalsRequested: 0 },
    authority: { native09: 'EXPLICIT_USER_DEFERRED_NOT_RUN', freshSupersedingApprovalRequired: true, currentOldMaterializationAndExecutionAbsent: absent, requiredBeforeNewRequest: 'F28 DONE with scoped source and transition byte barriers; fresh reviewable current-artifact native09 packet plus bounded prelaunch checks.', automaticRetryAuthorized: false, pushPublishTagAuthorized: false },
    limits: ['This report is not a runnable approval packet.', 'No old native30 or interrupted restart outcome transfers to current artifact.', 'No human or independent evidence, release readiness or final rating is asserted.']
  };
  fs.writeFileSync(path.join(__dirname, 'readiness-snapshot-01.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, protectedSources: protectedSources.length, unchangedOriginalAddExpressions: originalCalls.length, currentArtifact: vsix.sha256, sourceOrNativeWork: 0 }));
}
try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
