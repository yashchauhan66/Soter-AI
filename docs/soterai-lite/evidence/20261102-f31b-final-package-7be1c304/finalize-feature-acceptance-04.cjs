'use strict';
// Read-only verification, except explicitly requested claims/proof/receipt output.
// No build/test/native/network execution and no dependency remediation is inferred.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const C = require('./current-native-admission-06.cjs');
const { repo, own, read, fact, sha } = C;
const claimPath = 'docs/soterai-lite/README-CLAIMS.md';
const candidatePath = 'docs/soterai-lite/evidence/20261102-release-gate-readiness/F31B-README-CLAIMS-CANDIDATE-02.txt';
const candidateSha256 = '7e551aedd3a87358634ca3ffe1ee1a6591bb22a8344c47e95b046cc7180a6adf';
const parent = '730b01d95ee89b62c58ef0a5ace3991b549107e3';
const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const evidence = new Map();
function take(file) { const row = fact(file); evidence.set(row.path, row); return row; }
function pinned(name, hash) {
  const file = own(name); assert.equal(sha(fs.readFileSync(file)), hash, name); take(file); return read(file);
}
function canonical(name) {
  const raw = own(name + '.txt'), receipt = read(raw + '.result.json');
  assert.equal(receipt.exitCode, 0, name); assert.equal(sha(fs.readFileSync(raw)), receipt.sha256.toLowerCase());
  take(raw); take(raw + '.result.json');
}
function localPin(row) { const file = path.resolve(repo, row.path); assert(file.startsWith(repo + path.sep)); C.pin(row); }
function currentHead() {
  assert.equal(sha(fs.readFileSync(git)), 'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });
  return cp.execFileSync(git, ['-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'],
    { cwd: repo, env, shell: false, windowsHide: true }).toString().trim();
}
function sourceCheckpoint() {
  const proof = pinned('scoped-f31b-source-checkpoint-03-byte-proof.json', 'a1d4a12f3706962b1365488a6f41e54668da911960fd5f62eee07694ca678d2b');
  assert.equal(proof.status, 'PASS_EXACT_LOCAL_F31B_SOURCE18_CHECKPOINT_BYTES_FEATURE_INCOMPLETE');
  assert.equal(proof.commit, parent); assert.equal(currentHead(), parent);
  for (const [key, value] of Object.entries({ fileCount: 832, sourceCount: 18, mismatches: 0,
    unexpectedPaths: 0, indexEmpty: true, featureComplete: false, releaseReady: false })) assert.equal(proof[key], value);
  canonical('scoped-f31b-source-checkpoint-03-commit');
  return proof;
}
function originalSources() {
  const proof = pinned('full-inputs-04.json', '221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99');
  assert.equal(proof.files.length, 1098); assert.equal(proof.fileCount, 1098); return proof;
}
function claimsRefresh() {
  sourceCheckpoint(); const old = originalSources(); old.files.filter(row => row.path !== claimPath).forEach(localPin);
  const currentClaims = fact(path.join(repo, claimPath));
  assert.equal(currentClaims.sha256, candidateSha256, "Only the already-reviewed completed map is accepted after ENOSPC.");
  const candidate = fs.readFileSync(path.join(repo, candidatePath));
  assert.equal(sha(candidate), candidateSha256);
  assert(candidate.includes(Buffer.from('42 active affected build-dependency associations')));
  assert(candidate.includes(Buffer.from('Remediation remains OPEN')));
  const build = read(path.join(repo, 'packages/soterai-lite/builds/2026-11-02T16-43-45-355Z-3d422280/build-provenance.json'));
  assert(!build.inventory.flatMap(row => row.inputs).some(row => row.path === claimPath));
  assert(!fs.existsSync(own('full-inputs-06.json')));
  assert(fs.readFileSync(path.join(repo, claimPath)).equals(candidate)); // Already completed before proof-write ENOSPC.
  const files = old.files.map(row => fact(path.resolve(repo, row.path)));
  const delta = files.filter((row, index) => row.sha256 !== old.files[index].sha256 || row.bytes !== old.files[index].bytes);
  assert.deepEqual(delta.map(row => row.path), [claimPath]);
  const proof = { status: 'CURRENT_F31B_EXTERNAL_CLAIMS_REFRESH_NO_PRODUCT_BUILD_OR_TEST_DELTA',
    feature: 'F31b', observedAt: new Date().toISOString(), parent,
    fileCount: files.length, files, priorSourceProof: fact(own('full-inputs-04.json')), deltaFrom04: delta,
    reviewedClaimsCandidate: fact(path.join(repo, candidatePath)),
    qualification: 'Only an external evidence-map document changed. All TypeScript/config/tests, build scripts, packaged assets, runtime provenance and native fixtures remain exact. Existing actual full/compiler/native receipts are reused explicitly, not represented as new executions.' };
  fs.writeFileSync(own('full-inputs-06.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: proof.status, files: files.length, delta: delta.map(row => row.path),
    proofSha256: sha(fs.readFileSync(own('full-inputs-06.json'))) }));
}
function verify() {
  evidence.clear(); const checkpoint = sourceCheckpoint(), old = originalSources(), current = read(own('full-inputs-06.json'));
  assert.equal(current.status, 'CURRENT_F31B_EXTERNAL_CLAIMS_REFRESH_NO_PRODUCT_BUILD_OR_TEST_DELTA');
  assert.equal(current.fileCount, 1098); assert.equal(current.files.length, 1098); assert.equal(current.parent, parent);
  assert.equal(current.priorSourceProof.sha256, take(own('full-inputs-04.json')).sha256);
  const changed = [];
  for (let index = 0; index < old.files.length; index++) {
    const row = current.files[index]; assert.equal(row.path, old.files[index].path); localPin(row);
    if (row.bytes !== old.files[index].bytes || row.sha256 !== old.files[index].sha256) changed.push(row.path);
  }
  assert.deepEqual(changed, [claimPath]); assert.deepEqual(current.deltaFrom04, [fact(path.join(repo, claimPath))]);
  localPin(current.reviewedClaimsCandidate); assert.equal(current.reviewedClaimsCandidate.path, candidatePath);
  assert.equal(current.reviewedClaimsCandidate.sha256, candidateSha256);
  assert(fs.readFileSync(path.join(repo, claimPath)).equals(fs.readFileSync(path.join(repo, candidatePath))));
  const full = pinned('full-suite-acceptance-04.json', '24726fdaab8099259ea2005d2d88bafce50f8c7bc581f9120cb9ff6c998b56a3');
  assert.deepEqual(full.counts, { tests: 4783, pass: 4779, fail: 0, cancelled: 0, skipped: 4, todo: 0 });
  const backend = pinned('backend-byte-reuse-01.json', 'b3121ea5c36e722c42bdd3c3b439e4d0c2f9ab14e8a110555b6044212505929c');
  backend.backendCompilerTestSourceRows.forEach(localPin); backend.workers.forEach(row => row.inputs.forEach(localPin));
  const content = pinned('content-inspection-02.json', 'bf93f31670e979414c464be5caea8ad48bc58cc200c4b477af60b52d69cd4b0d');
  assert.equal(content.entryCount, 18); assert.equal(content.runtimeCount, 4);
  localPin({ path: content.vsix.output, bytes: content.vsix.bytes, sha256: content.vsix.sha256 });
  assert.equal(content.vsix.sha256, '6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c');
  assert.equal(content.vsix.target, 'win32-x64'); assert.equal(content.vsix.preRelease, true); assert.equal(content.vsix.releaseReady, false);
  const build = read(path.join(repo, content.buildReceipt));
  assert.equal(sha(fs.readFileSync(path.join(repo, content.buildReceipt))), content.vsix.buildReceiptSha256);
  for (const row of build.inventory) row.inputs.forEach(localPin);
  assert(!build.inventory.flatMap(row => row.inputs).some(row => row.path === claimPath));
  content.vsix.assets.forEach(row => localPin({ ...row, path: row.source }));
  content.entries.forEach(row => localPin({ ...row, path: path.resolve(repo, content.extractedRoot, '..', row.path) }));
  canonical('content-03'); require('./verify-closed-controls-01.cjs')('package-components-06', 46, take); require('./verify-closed-controls-01.cjs')('manifest-components-03', 559, take);
  const native = pinned('affected-acceptance-01.json', 'b366fafa3c409bdc55b53cb83d6c5ca9b87a0fe1972cd9c392ba807a6b8f804a');
  assert.equal(native.status, 'PASS_CURRENT_F31B_AFFECTED4_175_8_FUNCTIONAL10_SECURITY17_BASELINE');
  assert.equal(native.totalAssertions, 202); assert.equal(native.totalPhases, 10);
  assert.deepEqual(native.residuals, { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 }); native.evidence.forEach(localPin);
  canonical('affected-acceptance-04'); canonical('post-owner-observation-02');
  const audit = pinned('advisory-detail-result-review-01.json', '2d0a41c4986c149ec10cdc194de93d266f005af20ce101c40c43255a219ec6d2');
  assert.equal(audit.status, 'COMPLETE_WITH_KNOWN_BUILD_FINDINGS'); assert.equal(audit.verification.records, 42);
  assert.equal(audit.authorization.reference, 'call_5160afa54e6842a3900607a280932f53');
  assert.equal(audit.verification.allHttp200, true); assert.equal(audit.verification.allIndividualRequestResponseCloseEndComplete, true);
  assert.equal(audit.findings.uniqueAdvisories, 42); assert.equal(audit.findings.activeAffectedAssociations, 42);
  assert.deepEqual(audit.findings.severityLabelsAsSupplied, { MODERATE: 19, HIGH: 17, LOW: 6 });
  assert.equal(audit.contractDisposition.requiredAuditAndReview, 'COMPLETE_WITH_KNOWN_BUILD_FINDINGS');
  assert.equal(audit.contractDisposition.remediation, 'OPEN_NOT_AUTHORIZED_NOT_PERFORMED');
  assert.equal(audit.contractDisposition.ownerRiskAcceptance, 'NOT_GRANTED_OR_INFERRED'); assert.equal(audit.releaseReady, false);
  for (const row of audit.inputEvidence) {
    if (row.path === claimPath) { assert.deepEqual(row, old.files.find(file => file.path === claimPath)); }
    else if (row.path === 'docs/soterai-lite/IMPLEMENTATION-PLAN.md') require('./verify-historical-plan-prefix-01.cjs')(row); else localPin(row);
  }
  canonical('advisory-run-01'); canonical('advisory-detail-run-01');
  const drift = pinned('vendor-drift-observation-01.json', '21dc2a26c33f825a807cbb492477785ee394511be28957b111c257032ca278dd');
  assert.equal(drift.changed.length, 1); assert.equal(drift.twoStableObservations, true);
  const cases = pinned('F31b-case-map-01.json', 'd0298621e2835a257790d0679a34e2fea62d491620bdc78c86069a651e7a9672');
  take(own('full-inputs-06.json')); take(path.join(repo, claimPath)); take(path.join(repo, candidatePath));
  return { status: 'PASS_SCOPED_F31B_PACKAGE_AND_AUDIT_WORK_TRANSITION_PENDING_WITH_KNOWN_BUILD_FINDINGS',
    observedAt: new Date().toISOString(), feature: 'F31b', sourceCheckpoint: take(own('scoped-f31b-source-checkpoint-03-byte-proof.json')),
    sourceCommit: checkpoint.commit, sourceCount: 18, currentSourceProof: take(own('full-inputs-06.json')),
    documentOnlyDelta: changed, productBuildTestGraphUnchanged: true, full: full.counts,
    backend: 'EXACT_INPUT_GRAPH_REUSE_NOT_NEW_EXECUTION', vsix: content.vsix,
    nativeChecks: 175, nativePhases: 8, functionalChecks: 10, securityBaselineCases: 17,
    securityResiduals: native.residuals, audit: { status: audit.status, findings: 42, high: 17, moderate: 19, low: 6,
      remediation: audit.contractDisposition.remediation, riskAcceptance: audit.contractDisposition.ownerRiskAcceptance,
      unauditedOtherLockVersions: 745, cleanAudit: false },
    namedUnexecutedCaseBoundaries: 'F31b-case-map-01.json remains the explicit B01-B18 coverage map, including unexecuted permutations. Its pre-detail pending-audit label is superseded only by the completed review above. No exhaustive permutation claim.',
    vendorSnapshot: 'Accepted native results bind their recorded tested pins; post-test Edge drift does not become current-Edge acceptance.',
    f26a: 'USER_SKIPPED_INCOMPLETE_UNSUPPORTED_NO_MORE_NATIVE_RUNS', parentF26: 'INCOMPLETE',
    historicalOuter84707: 'CLOSE_EOF_UNCONFIRMED', independence: 'LOW',
    remaining: 'F32 installed-only lifecycle; V01-V05; open build dependency remediation; human/different-vendor evidence and owner publication decision.',
    featureTransitionRequired: true, nextProductionRequiresTransitionByteProof: true, releaseReady: false,
    evidence: [...evidence.values()] };
}
module.exports = { verify };
if (require.main === module) {
  try {
    const mode = process.argv[2]; assert(['--refresh-claims', '--verify'].includes(mode));
    if (mode === '--refresh-claims') claimsRefresh();
    else { const report = verify(); fs.writeFileSync(own('feature-acceptance-01.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      console.log(JSON.stringify({ status: report.status, sourceCount: 18, native: 175, functional: 10, security: 17,
        audit: report.audit, releaseReady: false, sha256: sha(fs.readFileSync(own('feature-acceptance-01.json'))) })); }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
