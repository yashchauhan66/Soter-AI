'use strict';
// Read-only by default. Optional --receipt NAME creates one new evidence file here.
// No child processes, native host, process queries, network or product activation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.join(root, p));
const json = p => JSON.parse(read(p));
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const directory = relative(__dirname);
function verify(row, alternatePath) {
  const p = alternatePath || row.path;
  assert(typeof p === 'string' && !path.isAbsolute(p) && !p.includes('\\') && !p.split('/').some(s => s === '..' || s === ''), 'Unsafe evidence path');
  const absolute = path.join(root, p);
  for (let current = absolute; current !== root; current = path.dirname(current)) assert(!fs.lstatSync(current).isSymbolicLink(), 'Linked input: ' + p);
  const b = read(p);
  assert.equal(b.length, row.bytes, 'Size drift: ' + p);
  assert.equal(sha(b), row.sha256, 'Hash drift: ' + p);
  return b;
}
async function main() {
  assert(process.argv.length === 2 || (process.argv.length === 4 && process.argv[2] === '--receipt' && /^[a-z0-9-]+\.json$/.test(process.argv[3])), 'Usage: node verify-handoff.cjs [--receipt new-name.json]');
  const handoff = json(directory + '/HANDOFF-current-01.json');
  assert.equal(handoff.status, 'PREPARED_HANDOFF_PREREQUISITES_INCOMPLETE');
  assert.equal(handoff.releaseReady, false); assert.equal(handoff.featureComplete, false); assert.equal(handoff.finalRating, null);
  assert.equal(handoff.humanResults, 'NOT_PROVIDED');
  verify(handoff.artifact); verify(handoff.catalog); verify(handoff.sourceProof); verify(handoff.configuration); verify(handoff.currentHostObservation);
  const proof = JSON.parse(verify(handoff.sourceProof));
  assert.equal(proof.files.length, 1111);
  assert.equal(new Set(proof.files.map(f => f.path.toLowerCase())).size, 1111);
  for (const row of proof.files) verify(row);
  for (const row of [...handoff.receipts, ...handoff.documents]) verify(row);
  for (const row of handoff.preservedBefore) verify(row, row.preservedAt);
  const catalog = json('docs/soterai-lite/catalog-results.json');
  assert.equal(catalog.catalog.sha256, handoff.catalog.sha256); assert.equal(catalog.artifact.sha256, handoff.artifact.sha256);
  assert.equal(catalog.tools.length, 6); assert.equal(catalog.checks.length, 44); assert.equal(catalog.pairCount, 264);
  assert.equal(new Set(catalog.tools.map(t => t.id)).size, 6); assert.equal(new Set(catalog.checks.map(c => c.id)).size, 44);
  const pairStatuses = {};
  for (const check of catalog.checks) {
    assert.equal(check.tools.length, 6);
    assert.deepEqual(check.tools.map(t => t.toolId).sort(), catalog.tools.map(t => t.id).sort());
    for (const tool of check.tools) { assert.equal(tool.status, 'UNVERIFIED'); pairStatuses[tool.status] = (pairStatuses[tool.status] || 0) + 1; }
  }
  assert.equal(catalog.score, null); assert.equal(catalog.finalRating, null);
  assert.equal(catalog.scopeExceptions[0].status, 'OWNER_REVIEWED_DEFAULT_OFF_CANDIDATE_NATIVE_ACCEPTANCE_PENDING');
  const kit = handoff.neutralKit;
  const list = JSON.parse(verify(kit.manifest)); verify(kit.addendum);
  assert.equal(list.files.length, 393);
  for (const row of list.files) verify({ ...row, path: kit.root + '/' + row.path });
  const walk = p => fs.readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(p, e.name)) : [path.relative(path.join(root, kit.root), path.join(p, e.name)).replaceAll('\\', '/')]);
  assert.deepEqual(walk(path.join(root, kit.root)).sort(), [...list.files.map(f => f.path), 'file-list.json'].sort());
  const identity = json(kit.root + '/object-identity.json');
  assert.equal(identity.artifact.sha256, handoff.artifact.sha256); assert.equal(identity.catalog.sha256, handoff.catalog.sha256);
  assert.deepEqual(identity.runtimeIdentity, handoff.runtimeIdentity);
  const exclusions = json(kit.root + '/exclusion-search.json');
  let scanned = 0;
  for (const row of list.files.filter(f => !f.path.endsWith('.vsix') && f.path !== 'exclusion-search.json')) {
    const text = read(kit.root + '/' + row.path).toString('utf8');
    for (const forbidden of exclusions.prohibitedReferences) assert(!text.includes(forbidden), 'Builder reference in neutral packet: ' + row.path);
    scanned++;
  }
  assert.equal(scanned, 391);
  const { auditFinalRelease } = require(path.join(root, 'packages/soterai-lite/scripts/audit-release.cjs'));
  const qualifier = JSON.parse(verify(handoff.qualification));
  assert.equal(qualifier.sourceProofSha256, handoff.sourceProof.sha256);
  const full = JSON.parse(verify(handoff.fullAcceptance));
  assert.equal(qualifier.fullAcceptanceSha256, handoff.fullAcceptance.sha256);
  assert.deepEqual(full.counts, { tests: 4892, pass: 4888, fail: 0, cancelled: 0, skipped: 4, todo: 0 });
  assert.equal(qualifier.fullSuiteExecution, 'EXECUTED_ON_PREVIOUS_PROOF_REUSED_AFTER_METADATA_ONLY_CHANGE');
  assert.equal(qualifier.descriptionOnlySourceDelta.runtimeSourceChanged, false);
  const build = path.dirname(qualifier.buildReceipt.path);
  const audited = await auditFinalRelease({ repoRoot: root, vsixPath: path.join(root, handoff.artifact.path), expectedSha256: handoff.artifact.sha256, buildReceiptPath: path.join(build, 'build-provenance.json'), packageReceiptPath: path.join(build, 'package-receipt.json') });
  assert.equal(audited.report.status, 'PASS_FINAL_OFFLINE_PACKAGE_NOT_RELEASE_READY');
  assert.equal(audited.report.entries.length, 18); assert.equal(audited.report.runtimes.length, 4);
  const priorInspection = JSON.parse(verify({ ...qualifier.inspection, path: relative(qualifier.inspection.path) }));
  assert.deepEqual(audited.report.entries, priorInspection.entries); assert.equal(audited.report.embeddedSbomSha256, priorInspection.embeddedSbomSha256);
  const advisory = json('docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304/advisory-detail-result-review-01.json');
  assert.equal(advisory.findings.activeAffectedAssociations, 42);
  assert.deepEqual(advisory.findings.severityLabelsAsSupplied, { MODERATE: 19, HIGH: 17, LOW: 6 });
  const bench = JSON.parse(verify(handoff.benchmark));
  assert.equal(bench.exactArtifact.sha256, handoff.artifact.sha256); assert.equal(bench.results.length, 4); assert.equal(bench.actualModelPrompts, 0);
  assert.equal(bench.expressIntegration.status, 'ACTUAL_EXPRESS_ROUTER_NODE_HTTP_MEMORY_TRANSPORT');
  assert.equal(bench.streamMeasurements.passed, 6);
  const evaluation = JSON.parse(verify(handoff.componentEvaluation));
  assert.equal(evaluation.artifact.sha256, handoff.artifact.sha256);
  for (const record of advisory.records) verify(record.rawResponse);
  const historicalIdentity = json('docs/soterai-lite/independent-review-kit-20261104-18a12a73/object-identity.json');
  for (const result of bench.results) assert.equal(result.status, 'PASS_SCRIPTED_SCOPED');
  const retainedNative = [];
  for (const receiptPath of [
    'docs/soterai-lite/evidence/20261104-final-gate-readiness/f05-current-acceptance-04.json',
    'docs/soterai-lite/evidence/20261104-final-gate-readiness/f28-current-01/native-acceptance-current-02.json'
  ]) {
    const receipt = json(receiptPath);
    assert.equal(receipt.vsix.sha256, handoff.historicalNativeArtifact.sha256);
    verify(receipt.vsix); verify(receipt.sourceProof);
    let checks = 0;
    const measurements = [];
    for (const phase of receipt.phases) {
      const raw = JSON.parse(verify(phase.result)); verify(phase.close);
      assert.equal(raw.hostVersion, receipt.codeVersion);
      assert.equal(raw.extensionBundleSha256, historicalIdentity.runtimeIdentity.find(r => r.name === 'extension.js').sha256);
      assert.equal(raw.passed, phase.checks); assert.equal(raw.failed, 0); assert.equal(raw.notRun, 0);
      assert.equal(raw.observations.length, phase.checks);
      for (const observation of raw.observations) assert.equal(observation.status, 'PASS');
      checks += phase.checks;
      measurements.push(...(raw.measurements || []));
    }
    if (receipt.peerClose) verify(receipt.peerClose);
    retainedNative.push({ receipt: receiptPath, status: receipt.status, artifactSha256: receipt.vsix.sha256, codeVersion: receipt.codeVersion, checks, measurements, interpretation: 'Rehashed earlier-artifact historical raw results; no current-artifact or host transfer.' });
  }
  assert.deepEqual(retainedNative.map(r => r.checks), [10, 30]);
  const human = json(directory + '/HUMAN-RESULT-TEMPLATES.json');
  assert.equal(human.status, 'UNFILLED_TEMPLATE_NOT_ACCEPTANCE'); assert.equal(human.usability.length, 5); assert.equal(human.smoke.length, 6); assert.equal(human.benchmarks.length, 2);
  assert.equal(human.independentReview.reportPath, null); assert.equal(human.screenReader.reportPath, null); assert.equal(human.publication.executed, false);
  for (const p of handoff.documents.filter(f => /(?:USER-GUIDE|coverage-map|release-checklist|FINAL-REPORT|SCORECARD)\.md$/.test(f.path))) {
    const text = read(p.path).toString('utf8');
    assert(text.includes('HUMAN-ACTIONS')); assert(!/No further attempt is permitted|no further F26a native runs|No F26a DONE or further native attempts/.test(text));
  }
  const result = {
    status: 'PASS_OFFLINE_HANDOFF_INTEGRITY_NOT_PRODUCT_OR_HUMAN_ACCEPTANCE', observedAt: new Date().toISOString(),
    handoffSha256: sha(read(directory + '/HANDOFF-current-01.json')), verifierSha256: sha(fs.readFileSync(__filename)),
    artifact: handoff.artifact, frozenSources: proof.files.length, frozenSourceDrift: 0,
    package: { entries: 18, runtimes: 4, embeddedSbomSha256: audited.report.embeddedSbomSha256, status: audited.report.status },
    neutralKit: { manifestEntries: 393, totalFiles: 394, exclusionSearchFiles: scanned, forbiddenHits: 0, verdict: 'NOT_PROVIDED' },
    catalog: { checks: 44, tools: 6, pairs: 264, statuses: pairStatuses, rating: null },
    retainedAudit: { affectedBuildAssociations: 42, high: 17, moderate: 19, low: 6, remediation: 'OPEN', riskAcceptance: 'NOT_GRANTED', freshNetworkAudit: false },
    currentBenchmarks: { scriptedCases: 4, realModelCalls: 0, actualExpressIntegration: 'PASS_ACTUAL_MEMORY_TRANSPORT', streamMeasurements: 6 },
    fullCounts: full.counts, fullSuiteExecution: qualifier.fullSuiteExecution,
    retainedNative,
    documentsVerified: handoff.documents.length, retainedEvidenceFilesVerified: handoff.receipts.length,
    childProcesses: 0, nativeLaunches: 0, networkRequests: 0, releaseReady: false, featureComplete: false,
    humanResults: 'NOT_PROVIDED', finalRating: null, gates: handoff.gates
  };
  if (process.argv[2] === '--receipt') fs.writeFileSync(path.join(__dirname, process.argv[3]), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
