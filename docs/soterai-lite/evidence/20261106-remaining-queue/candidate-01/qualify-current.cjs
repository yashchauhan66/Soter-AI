'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..'), own = n => path.join(__dirname, n);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
function fact(f) { const b = fs.readFileSync(f); return { path: path.resolve(f), bytes: b.length, sha256: sha(b) }; }
function pin(r) { const f = path.resolve(repo, r.path), s = fs.lstatSync(f), b = fs.readFileSync(f); assert(s.isFile() && !s.isSymbolicLink() && s.nlink === 1); assert.equal(b.length, r.bytes, r.path); assert.equal(sha(b), r.sha256, r.path); }
function write(n, v) { fs.writeFileSync(own(n), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return fact(own(n)); }
function close(name) {
 const f = own(name + '-owned-close.json'), v = read(f);
 for (const [k, x] of Object.entries({ actualClose: true, exitCode: 0, signal: null, stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(v[k], x, name + ':' + k);
 assert.deepEqual(v.streams.map(s => s.name).sort(), ['stderr', 'stdout']);
 for (const s of v.streams) { pin({ path: own(name + '-' + s.name + '.bin'), bytes: s.bytes, sha256: s.sha256 }); assert.equal(s.bytes, s.observedBytes); }
 return fact(f);
}
function tap(name) {
 const raw = fs.readFileSync(own(name + '-stdout.bin'), 'utf8'), c = {};
 for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) { const m = [...raw.matchAll(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'gm'))]; assert.equal(m.length, 1); c[key] = Number(m[0][1]); }
 assert.equal(c.fail, 0); assert.equal(c.cancelled, 0); assert.equal(c.todo, 0); assert.equal(c.tests, c.pass + c.skipped); return c;
}
(async () => {
 const source = fact(own('full-inputs-02.json')), proof = read(source.path); proof.files.forEach(pin);
 const integrated = read(own('integrated-result-02.json')); assert.equal(integrated.sourceProofSha256, source.sha256); assert.equal(integrated.status, 'CURRENT_FULL_COMPILER_COMPONENTS_BUILD_PACKAGE_PASS_NATIVE_PENDING');
 const closes = integrated.completed.map(close), fullFact = fact(own('full-suite-acceptance-02.json')), full = read(fullFact.path);
 pin(proof.priorProof); pin(full.originalAcceptance);
 const prior = read(path.resolve(repo, proof.priorProof.path)), originalFull = read(full.originalAcceptance.path);
 assert.equal(full.executionStatus, 'EXECUTED_ON_PREVIOUS_PROOF_REUSED_AFTER_METADATA_ONLY_CHANGE');
 assert.equal(full.executionSourceProofSha256, proof.priorProof.sha256);
 assert.equal(originalFull.sourceProofSha256, proof.priorProof.sha256);
 assert.deepEqual(full.shards, originalFull.shards); assert.deepEqual(full.counts, originalFull.counts);
 assert.deepEqual(proof.files.map(r => r.path), prior.files.map(r => r.path));
 const differences = proof.files.filter((r, i) => r.sha256 !== prior.files[i].sha256);
 assert.deepEqual(differences.map(r => r.path), ['packages/vscode-extension/package.json']);
 const oldCanonicalFile = own('pre-metadata-canonical-package.json'), oldCanonical = read(oldCanonicalFile);
 pin({ ...prior.files.find(r => r.path === differences[0].path), path: oldCanonicalFile });
 const expected = structuredClone(oldCanonical), key = 'soterai.lite.historyHooks.preCommit';
 expected.contributes.configuration.properties[key].description = read(path.join(repo, 'packages/soterai-lite/package.json')).contributes.configuration.properties[key].description;
 assert.deepEqual(read(path.join(repo, differences[0].path)), expected);
 assert.equal(full.sourceProofSha256, source.sha256); assert.equal(full.fileCount, proof.files.filter(r => r.path.startsWith('packages/vscode-extension/src/__tests__/') && r.path.endsWith('.test.ts')).length);
 const totals = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
 for (const shard of full.shards) { const c = tap(shard.name); assert.deepEqual(c, shard.counts); for (const k of Object.keys(totals)) totals[k] += c[k]; }
 assert.deepEqual(totals, full.counts); assert.equal(totals.skipped, 4); const packageTests = tap('package-components-02'), metadataTests = tap('metadata-components-02');
 const { receipt: build, attempt } = require(path.join(repo, 'packages/soterai-lite/scripts/verify-build.cjs')).verifyBuild();
 const vsix = fact(path.join(repo, integrated.artifact.path)); assert.equal(vsix.sha256, integrated.artifact.sha256); assert.equal(vsix.bytes, integrated.artifact.bytes);
 const { auditFinalRelease } = require(path.join(repo, 'packages/soterai-lite/scripts/audit-release.cjs'));
 const audit = await auditFinalRelease({ repoRoot: repo, vsixPath: vsix.path, expectedSha256: vsix.sha256, buildReceiptPath: path.join(attempt, 'build-provenance.json'), packageReceiptPath: path.join(attempt, 'package-receipt.json') });
 assert.equal(audit.report.entries.length, 18); assert.equal(audit.report.runtimes.length, 4); assert.deepEqual(audit.report.unsupportedFeatures, []);
 const inspection = write('current-content-inspection-01.json', audit.report);
 const priorFile = path.join(repo, 'docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304/backend-byte-reuse-01.json');
 assert.equal(fact(priorFile).sha256, 'b3121ea5c36e722c42bdd3c3b439e4d0c2f9ab14e8a110555b6044212505929c');
 const priorBackend = read(priorFile); priorBackend.backendCompilerTestSourceRows.forEach(pin);
 for (const worker of priorBackend.workers) { worker.inputs.forEach(pin); const current = build.inventory.find(x => x.name === worker.name); assert(current); assert.equal(current.sha256, worker.sha256); assert.equal(current.bytes, worker.bytes); assert.deepEqual(current.inputs, worker.inputs); }
 const backend = write('backend-byte-qualification-01.json', { feature: 'F32', status: 'PASS_EXACT_UNCHANGED_BACKEND_WORKER_INPUT_GRAPH_PRIOR_EXECUTION_EXPLICITLY_REUSED', sourceProofSha256: source.sha256, prior: fact(priorFile), sourceRows: priorBackend.backendCompilerTestSourceRows.length, workers: priorBackend.workers.map(w => ({ name: w.name, bytes: w.bytes, sha256: w.sha256, inputCount: w.inputs.length })), qualification: 'Current source/test/compiler rows and three runtime input graphs byte-identical. This is not a new backend execution.' });
 const payload = { manifestSha256: audit.report.entries.find(x => x.path === 'extension/package.json').sha256, runtimes: audit.report.runtimes.map(x => ({ relative: 'dist/' + x.name, bytes: x.bytes, sha256: x.sha256 })).sort((a, b) => a.relative.localeCompare(b.relative)), payloadUncompressedBytes: audit.report.entries.filter(x => x.path.startsWith('extension/')).reduce((s, x) => s + x.bytes, 0), targetPlatform: 'win32-x64' };
 proof.files.forEach(pin);
 const qualification = write('current-package-qualification-01.json', { feature: 'F32', status: 'FINAL_SOURCE_FULL_COMPILER_VSIX_CONTENT_BACKEND_REVIEWED_NATIVE_PENDING', observedAt: new Date().toISOString(), sourceProofSha256: source.sha256, vsix, fullAcceptanceSha256: fullFact.sha256, fullSuiteExecution: full.executionStatus, originalFullAcceptance: full.originalAcceptance, descriptionOnlySourceDelta: proof.metadataOnlyChange, metadataTests, notificationAwaitRegressionSha256: null, currentVendorReceiptSha256: fact(path.resolve(__dirname, '../../20261103-f32-lifecycle-2e95d6a4/public-vendor-observation-04.json')).sha256, checks: { compiler: 'PASS_EXACT_CURRENT', content: 'PASS_EXACT_CURRENT', backend: 'PASS_EXACT_CURRENT' }, ownedCloseReceipts: closes, payload, inspection, backend, packageTests, full: totals, buildReceipt: fact(path.join(attempt, 'build-provenance.json')), releaseReady: false });
 write('f32-candidate-config.json', { sourceParent: proof.sourceParent, sourceProof: source, fullAcceptance: fullFact, finalQualification: qualification, currentVsix: vsix, trustDiagnostics: true });
 console.log(JSON.stringify({ status: 'PASS_CURRENT_PACKAGE_QUALIFIED_NATIVE_PENDING', qualification, vsix, full: totals, packageTests, buildAttempt: attempt }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
