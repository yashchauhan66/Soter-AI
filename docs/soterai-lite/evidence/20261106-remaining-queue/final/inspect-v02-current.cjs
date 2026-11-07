'use strict';
// Read current accepted component receipts; never promote them to tool routes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fact = p => { const b = fs.readFileSync(p); return { path: path.resolve(p), bytes: b.length, sha256: sha(b) }; };
function pin(row) { const actual = fact(path.resolve(root, row.path)); assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256); return actual; }
assert.equal(process.argv.length, 5); assert.equal(process.argv[2], '--binding');
const bindingFile = path.resolve(process.argv[3]); assert.equal(fact(bindingFile).sha256, process.argv[4]);
const binding = json(bindingFile), qualificationFact = pin(binding.qualification), qualification = json(qualificationFact.path);
const proofFact = pin(binding.sourceProof), proof = json(proofFact.path);
assert.equal(qualification.sourceProofSha256, proofFact.sha256); pin(qualification.vsix);
const fullFact = pin(binding.fullAcceptance), fullFile = fullFact.path;
assert.equal(fullFact.sha256, qualification.fullAcceptanceSha256);
const full = json(fullFile); assert.equal(full.sourceProofSha256, proofFact.sha256); assert.equal(full.counts.fail, 0); assert.equal(full.counts.cancelled, 0);
const sourceTests = proof.files.filter(f => f.path.startsWith('packages/vscode-extension/src/__tests__/') && /\.(?:test|host)\.ts$/.test(f.path)).map(f => ({ ...pin(f), text: fs.readFileSync(path.resolve(root, f.path), 'utf8') }));
const passed = [], measuredStress = [], rawFiles = [];
for (const shard of full.shards) {
  const rawFile = path.join(path.dirname(fullFile), shard.name + '-stdout.bin'), rawFact = fact(rawFile);
  const close = json(path.join(path.dirname(fullFile), shard.name + '-owned-close.json'));
  assert.equal(close.actualClose, true); assert.equal(close.exitCode, 0); assert.equal(close.stdoutEOF, true); assert.equal(close.stderrEOF, true);
  const stream = close.streams.find(s => s.name === 'stdout'); assert.equal(rawFact.bytes, stream.bytes); assert.equal(rawFact.sha256, stream.sha256);
  const raw = fs.readFileSync(rawFile, 'utf8'); rawFiles.push(rawFact);
  for (const match of raw.matchAll(/^[ \t]*ok \d+ - (.+)\r?$/gm)) {
    if (!/\s#\s*(?:SKIP|TODO)\b/i.test(match[1])) passed.push({ name: match[1], raw: rawFact });
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes('COMPONENT_SELECTED128_OF_SYNTHETIC4096_NOT_NATIVE_DISCOVERY')) continue;
    const value = JSON.parse(line.replace(/^#\s*/, '')); assert.equal(value.selectedReads, 128); assert.equal(value.files, 4096);
    assert(value.elapsedMilliseconds < 60000 && value.secondRootPublic && value.crossRootWithheld);
    measuredStress.push({ ...value, raw: rawFact });
  }
}
const catalogPath = path.join(root, 'docs/soterai-lite/LITE-CATALOG.json'), catalog = json(catalogPath);
assert.equal(catalog.checks.length, 44); assert.equal(catalog.tools.length, 6);
const exactId = (text, id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])').test(text);
const rows = catalog.checks.map(check => {
  const ids = [...new Set([check.automatedTestId, ...(check.linkedTestIds || [])])];
  const matched = ids.map(id => ({ id, passedSubtests: passed.filter(t => exactId(t.name, id)), sourceCandidates: sourceTests.filter(f => exactId(f.text, id)).map(({ text, ...f }) => f) }));
  return { id: check.id, automatedTestId: check.automatedTestId, matched, missingTitleIds: matched.filter(m => m.passedSubtests.length === 0).map(m => m.id),
    mutation: { status: 'UNCLASSIFIED_NO_PREVENTION_SENSITIVE_PROMOTION', withdrawalCandidates: matched.flatMap(m => m.passedSubtests).filter(t => /withdraw|flag.off|disabled|disable|mutat/i.test(t.name)), explanation: 'Test names locate evidence only. Availability withdrawal is not prevention-sensitive confidentiality mutation.' },
    toolPairs: catalog.tools.map(tool => ({ toolId: tool.id, status: 'UNVERIFIED', actualToolRoute: null, applicability: 'UNVERIFIED', positive: null, negative: null, leakOracle: null })),
    conclusion: 'COMPONENT_EVIDENCE_LINKAGE_ONLY_NOT_CATALOG_ROW_ACCEPTANCE' };
});
const auditPath = path.join(root, 'docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304/advisory-detail-result-review-01.json'), audit = json(auditPath);
assert.equal(audit.findings.activeAffectedAssociations, 42);
for (const record of audit.records) pin(record.rawResponse);
const inspection = json(qualification.inspection.path); pin(qualification.inspection);
const bundled = inspection.licenses.map(item => ({ name: item.name, version: item.version, metadata: pin(item.metadata) }));
const affectedNames = new Set(audit.findings.packages.map(p => p.name));
assert.equal(bundled.filter(p => affectedNames.has(p.name)).length, 0);
const lock = json(path.join(root, 'package-lock.json'));
const builderPackages = audit.findings.packages.map(pkg => {
  const locations = Object.entries(lock.packages).filter(([key, value]) => (key === 'node_modules/' + pkg.name || key.endsWith('/node_modules/' + pkg.name)) && value.version === pkg.installedVersion).map(([key]) => {
    const file = path.join(root, key, 'package.json'); if (!fs.existsSync(file)) return { path: key, status: 'NOT_INSTALLED' };
    const metadata = json(file); assert.equal(metadata.version, pkg.installedVersion); return { ...fact(file), version: metadata.version };
  });
  return { name: pkg.name, retainedAffectedVersion: pkg.installedVersion, findingCount: pkg.affectedCount, currentLocations: locations, priorStaticUse: pkg.staticUse, retainedFixedThreshold: pkg.highestObservedMatchingFixedEndpoint, compatibility: 'NOT_VERIFIED_NO_DEPENDENCY_CHANGE' };
});
const result = {
  status: 'PASS_CURRENT_COMPONENT_LINKAGE_AND_RETAINED_AUDIT_INTEGRITY_NOT_FINAL_GATE_ACCEPTANCE', observedAt: new Date().toISOString(),
  qualification: qualificationFact, sourceProof: proofFact, artifact: qualification.vsix, catalog: fact(catalogPath), full: fullFact, fullCounts: full.counts,
  fullSuiteExecution: qualification.fullSuiteExecution, originalFullAcceptance: qualification.originalFullAcceptance || null, descriptionOnlySourceDelta: qualification.descriptionOnlySourceDelta || null,
  rows, catalogCounts: { rows: 44, tools: 6, pairs: 264, allPairStatus: 'UNVERIFIED', rowsWithPassedComponentTitle: rows.filter(r => r.matched.some(m => m.passedSubtests.length)).length, rowsWithMissingTitleIds: rows.filter(r => r.missingTitleIds.length).length },
  measuredStress, rawFiles,
  budgets: { componentStartup: 'ReadReliability startup-budget unit controls; actual full installed startup remains F32', nativeMultiWindow: 'Requires current native receipt', stream: 'Inclusive byte/chunk and split corpus covered in current full source suite; no all-tool transport latency claim', performanceRating: null },
  dependencyReview: { retainedReview: fact(auditPath), rawResponsesRehashed: audit.records.length, bundled, affectedBuilderPackages: builderPackages, retainedAssociations: 42, bundledAffectedAssociationsInRetainedLookup: 0, freshNetworkQueries: 0, remediation: 'OPEN', ownerRiskAcceptance: 'NOT_GRANTED', interpretation: 'The 42 retained findings are builder dependencies, not 42 shipped-runtime findings. No vulnerability-free guarantee or dynamic unreachability proof.' },
  remaining: ['Actual current tool routes and per-pair applicability/control/oracle linkage', 'Prevention-sensitive mutation evidence per applicable catalog item', 'Current native startup/scan/stream/multi-window acceptance', 'Two real-agent project trials and required human/independent evidence'],
  score: null, finalRating: null, releaseReady: false, nativeRuns: 0, networkRequests: 0
};
const out = path.join(__dirname, 'v02-evaluation-' + new Date().toISOString().replace(/[-:.]/g, '')); fs.mkdirSync(out);
const output = path.join(out, 'RESULT.json'); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, result: fact(output), catalog: result.catalogCounts, stressMeasurements: measuredStress.length, rawAuditRecords: audit.records.length, bundledLibraries: bundled.length }));
