'use strict';
// Evidence-checkpoint admission ONLY. This never authorizes a future native run.
// Recorded accepted vendor pins stay immutable; observed post-test Edge drift is
// retained explicitly rather than being called tested or silently refreshed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replaceAll('\\', '/'), bytes: raw.length, sha256: sha(raw) }; };
const guard = own('current-native-admission-06.cjs');
assert.equal(sha(fs.readFileSync(guard)), 'dd000bc5a9098193a8b3b493d44c9ea8d9446ccd0ce793888d8ec77966f2fb4a');
const C = require(guard); // Only inert local-row/source helpers are called, never C.current()/binding().
function localPin(row) {
    const file = path.resolve(repo, row.path); assert(file.startsWith(repo + path.sep), 'Checkpoint input must be local to this repository.');
    return C.pin(row);
}
function canonical(name) {
    const result = read(own(name + '.txt.result.json')), raw = fs.readFileSync(own(name + '.txt'));
    assert.equal(result.exitCode, 0, name); assert.equal(sha(raw), result.sha256.toLowerCase(), name);
}
function closed(name) {
    const value = read(own(name + '-owned-close.json'));
    for (const [key, expected] of Object.entries({ actualClose: true, exitCode: 0, signal: null, stdoutEOF: true,
        stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(value[key], expected, name + ':' + key);
    for (const row of value.streams) {
        const raw = fs.readFileSync(own(name + '-' + row.name + '.bin'));
        assert.equal(raw.length, row.bytes); assert.equal(raw.length, row.observedBytes); assert.equal(sha(raw), row.sha256);
    }
    return value;
}
function recordedBinding() {
    const bindingPath = own('native-binding-01.json');
    assert.equal(sha(fs.readFileSync(bindingPath)), 'c653a5714a58a6c633dc0bee58984e8e08da2b59737bd58fa5c39a3a8668bfbe');
    const binding = read(bindingPath), proof = C.sources(); // Checks all1098 current source/input bytes and custody.
    const serial = read(own('integrated-sharded-result-04.json'));
    assert.equal(serial.status, 'F31B_SHARDED_FULL_READINESS_PACKAGE_CLOSED_CONTENT_NATIVE_PENDING');
    assert.equal(serial.proofSha256, fact(own('full-inputs-04.json')).sha256); assert.equal(proof.fileCount, 1098);
    for (const name of ['compiler-02', 'readiness-03', 'package-04', 'manifest-components-03', 'package-components-06']) closed(name);
    canonical('content-03');
    const full = read(own('full-suite-acceptance-04.json'));
    assert.equal(full.status, 'PASS_CURRENT_FULL_SUITE_ALL_FROZEN_TEST_FILES_SHARDED'); assert.equal(full.sourceProof.sha256, serial.proofSha256);
    assert.equal(full.shards.length, 8);
    assert.deepEqual(full.shards.map(row => row.name), ['unit-shard-01-02', 'unit-shard-02-02', 'unit-shard-03-02', 'unit-shard-04-02', 'unit-shard-05-02', 'unit-shard-06-04', 'unit-shard-07-04', 'unit-shard-08-04']);
    full.shards.forEach(row => closed(row.name));
    assert.equal(full.counts.fail, 0); assert.equal(full.counts.cancelled, 0); assert.equal(full.counts.skipped, 4); assert(full.counts.tests >= 4783);
    const content = read(own('content-inspection-02.json'));
    assert.equal(content.status, 'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE');
    assert.equal(content.sourceCount, 1098); assert.equal(content.entryCount, 18); assert.equal(content.runtimeCount, 4);
    for (const [key, value] of Object.entries(content.full)) assert.equal(full.counts[key], value, key);
    localPin({ path: content.vsix.output, bytes: content.vsix.bytes, sha256: content.vsix.sha256 });
    assert.equal(content.vsix.output.replaceAll('\\', '/'), 'packages/soterai-lite/soterai-lite-0.7.0-f31b-20261102-attempt03.vsix');
    const extracted = path.join(repo, content.extractedRoot); assert.equal(extracted, own('vsix-extracted-02/extension'));
    for (const row of content.entries) localPin({ ...row, path: path.resolve(extracted, '..', row.path) });
    const manifest = read(path.join(extracted, 'package.json'));
    assert.equal(manifest.capabilities.virtualWorkspaces.supported, false); assert.deepEqual(manifest.soteraiLiteRelease.unsupportedFeatures, ['preCommit']);
    const basePath = path.resolve(__dirname, '../20261101-f28-reliability-9a4c2e71/native-binding-03.json');
    assert.equal(sha(fs.readFileSync(basePath)), '6ad782a541704d8da93321093d479f5947684371802818b711802ded0587a8b3');
    const old = read(basePath); localPin(old.hostReview);
    const host = read(path.resolve(repo, old.hostReview.path)); assert.equal(host.currentHost.version, '1.144.0');
    // The tested public external files are a historical immutable record here.
    // Do not read/re-admit their current replacement bytes as though accepted tests had used them.
    assert.deepEqual(binding.hostReview, old.hostReview); assert.deepEqual(binding.vendorFacts, old.vendorFacts);
    assert.equal(binding.vendorFacts.length, 27);
    for (const row of binding.vendorFacts) {
        assert(path.isAbsolute(row.path)); assert(Number.isSafeInteger(row.bytes) && row.bytes > 0); assert.match(row.sha256, /^[a-f0-9]{64}$/);
        // Retain live local fixture-library custody too; these five rows are
        // outside the1098 product/compiler graph, not external vendor launches.
        if (path.resolve(row.path).toLowerCase().startsWith(repo.toLowerCase() + path.sep)) localPin(row);
    }
    const reuse = read(own('affected-driver-provenance-03.json'));
    assert.equal(reuse.status, 'CURRENT_F31B_AFFECTED_DRIVERS4_PREPARED_ASSERTIONS_NOT_RESULTS');
    assert.equal(reuse.sourceProof.sha256, serial.proofSha256); assert.equal(reuse.drivers.length, 4);
    assert(!reuse.drivers.some(row => /precommit|pre-commit/i.test(path.basename(row.path))));
    for (const row of [...reuse.drivers, ...reuse.sourceInputs, ...reuse.auxiliaryInputs]) localPin(row);
    const scope = read(own('affected-scope-05.json'));
    assert.deepEqual(scope.families.map(row => row.id), ['ps51', 'editor', 'mcp', 'retained']);
    assert.equal(scope.assertions, 175); assert.equal(scope.phases, 8); assert.equal(scope.functional, 10); assert.equal(scope.security, 17);
    const runtimes = content.entries.filter(row => /^extension\/dist\//.test(row.path)).map(row => ({ ...row,
        path: path.relative(repo, path.resolve(extracted, '..', row.path)).replaceAll('\\', '/') }));
    assert.equal(runtimes.length, 4);
    const physical = path.resolve(__dirname, '../20261029-f26b-prepush-70e1c9a4/native-physical-admission-14.cjs');
    assert.equal(sha(fs.readFileSync(physical)), '6d8aba0bdc97360823f92af00ec5f27d5f05c27389214724e37d53a0e6b5a11d');
    const expected = { schemaVersion: 1, status: 'F31B_AFFECTED_CURRENT_PACKET_BOUND_NOT_RUN',
        sourceProof: fact(own('full-inputs-04.json')), fullAcceptance: fact(own('full-suite-acceptance-04.json')),
        content: fact(own('content-inspection-02.json')), vsix: { path: content.vsix.output, bytes: content.vsix.bytes, sha256: content.vsix.sha256 },
        frontendSha256: content.vsix.extensionSha256, extractedRoot: content.extractedRoot, runtimes,
        driverProvenance: fact(own('affected-driver-provenance-03.json')), hostReview: old.hostReview, vendorFacts: old.vendorFacts,
        scope: fact(own('affected-scope-05.json')), physicalAdmission: fact(physical), guard: fact(guard),
        f26a: 'USER_SKIPPED_INCOMPLETE_NO_MORE_HOST_NATIVE_RUNS', precommitExcluded: true,
        releaseReady: false, configuredPush: 'NO_REMAINING_AUTHORITY_NOT_RUN' };
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(binding[key], value, key);
    assert.equal(binding.fixtureInputs.length, 15); binding.fixtureInputs.forEach(localPin);
    for (const family of binding.families) { localPin(family.driver); localPin(family.helper); }
    for (const row of binding.assertionReversal) { localPin(row.source); localPin(row.target); assert.equal(row.assertionReversalByteExact, true); }
    const driftFile = own('vendor-drift-observation-01.json');
    assert.equal(sha(fs.readFileSync(driftFile)), '21dc2a26c33f825a807cbb492477785ee394511be28957b111c257032ca278dd');
    canonical('vendor-drift-observation-01');
    const drift = read(driftFile);
    assert.equal(drift.status, 'VENDOR_DRIFT_AFTER_ACCEPTED_TESTS_NO_NEW_NATIVE_CLAIM'); assert.equal(drift.expectedBinding, 'native-binding-01.json');
    assert.equal(drift.rows, 27); assert.equal(drift.twoStableObservations, true); assert.equal(drift.unchanged, 26); assert.equal(drift.changed.length, 1);
    for (const key of ['launches', 'downloads', 'signalsRequested']) assert.equal(drift[key], 0);
    const changed = drift.changed[0], edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    assert.deepEqual(changed.tested, { path: edge, bytes: 5072200, sha256: '18380f009aeddb87f011a01b991bc4e52925f77694f69760a5a9a57937f04cde' });
    assert.deepEqual(changed.observed, { path: edge, bytes: 5073224, sha256: 'b012c559db235678a030013af0a3627a453cc8b695b5bd609c3198d27f6dc1ef' });
    const tested = binding.vendorFacts.filter(row => row.path === edge); assert.equal(tested.length, 1);
    assert.equal(tested[0].bytes, changed.tested.bytes); assert.equal(tested[0].sha256, changed.tested.sha256);
    const acceptance = read(own('affected-acceptance-01.json'));
    assert.equal(acceptance.status, 'PASS_CURRENT_F31B_AFFECTED4_175_8_FUNCTIONAL10_SECURITY17_BASELINE');
    assert.equal(acceptance.vsix.sha256, binding.vsix.sha256); assert.equal(acceptance.sourceProof.sha256, binding.sourceProof.sha256);
    assert(Date.parse(drift.observedAt) > Date.parse(acceptance.observedAt), 'Observed vendor drift must remain explicitly post-acceptance.');
    // Return original tested binding untouched. Drift is a separate checkpoint limitation, not new vendor admission.
    return binding;
}
module.exports = { recordedBinding, localPin };
