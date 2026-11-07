'use strict';
// Evidence/document preparation only. No product imports, subprocesses or network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..');
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const dir = rel(__dirname);
const doc = 'docs/soterai-lite/';
const proofPath = doc + 'evidence/20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = p => { const b = fs.readFileSync(path.join(root, p)); return { path: p, bytes: b.length, sha256: sha(b) }; };
const proof = json(proofPath);
const frozen = new Set([...proof.files, ...proof.scopedSource, ...proof.delta].map(r => r.path));
for (const f of proof.files) assert.deepEqual(fact(f.path), f, 'Frozen input changed: ' + f.path);
const mutable = new Set(['USER-GUIDE.md', 'coverage-map.md', 'release-checklist.md', 'FINAL-REPORT.md', 'SCORECARD.md', 'catalog-results.json', 'RELEASE-EVIDENCE.json']);
function write(p, value) {
  assert(!frozen.has(p), 'Refuse frozen write: ' + p);
  assert(p.startsWith(dir + '/') || (p.startsWith(doc) && mutable.has(p.slice(doc.length))), 'Outside document scope: ' + p);
  fs.writeFileSync(path.join(root, p), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}
const previous = [];
for (const name of mutable) {
  const p = doc + name, destination = dir + '/before-' + name;
  assert(!fs.existsSync(path.join(root, destination)), 'Preparation is one-shot; prior evidence exists');
  previous.push(fact(p));
  write(destination, read(p));
}
const f05 = doc + 'evidence/20261104-final-gate-readiness/f05-current-acceptance-04.json';
const f28 = doc + 'evidence/20261104-final-gate-readiness/f28-current-01/native-acceptance-current-02.json';
const commonUpdate = text => text
  .replace('Prepared 4 November 2026.', 'Updated 6 November 2026.')
  .replace('Windows 10.0.26300, Code1.144.1; exact configuration and runtime facts remain in the linked receipts.', 'Available host: Windows 10.0.26300, Code 1.145.1. Retained native receipts name their own 1.144.1 or 1.145.0 host; their results are not transferred to the new host.')
  .concat('\nCurrent status and the ordered human checklist: [HUMAN-ACTIONS](HUMAN-ACTIONS.md) and [dated claims supplement](evidence/20261106-remaining-queue/final/CURRENT-CLAIMS.md). Original frozen inputs and historical receipts remain unchanged.\n');
for (const name of ['USER-GUIDE.md', 'coverage-map.md', 'release-checklist.md', 'FINAL-REPORT.md', 'SCORECARD.md']) {
  let text = commonUpdate(read(doc + name));
  text = text
    .replace('after the owner\'s final F26a skip', 'in the current candidate while owner-resumed F26a verification is pending')
    .replace('F26a owner-skipped INCOMPLETE/unsupported.', 'F26a resumed by the owner; INCOMPLETE/unsupported pending accepted evidence.')
    .replace('F26a remains owner-skipped/unsupported, with original unmet requirement retained. No further attempt is permitted.', 'F26a is resumed by the owner and remains INCOMPLETE/unsupported until its original required behavior is verified. Historical skip restrictions do not override the current instruction.')
    .replace('Current full component regressions; F05CustomDocument10 packet prepared', 'Full component regressions plus accepted [CustomDocument10](evidence/20261104-final-gate-readiness/f05-current-acceptance-04.json) on Code 1.145.0')
    .replace('Actual final editor10, UI/onboarding, clipboard-specific evidence and human accessibility pending.', 'Editor10 is developer-bootstrap evidence on Code 1.145.0; installed onboarding, current-host qualification, clipboard-specific evidence and human accessibility remain separate.')
    .replace('Final pinned vendor99+hook4 route corpus pending;', 'Final pinned vendor-route corpus pending;')
    .replace('INCOMPLETE; fresh packets being prepared. Older native results do not transfer to the new archive/host.', 'CustomDocument10 and reliability30 have accepted exact-artifact developer-bootstrap receipts on Code 1.145.0. Current-host qualification and final actual vendor routes remain incomplete.')
    .replace('INCOMPLETE; three failures retained. One explicitly approved Proposal05 diagnostic is separately bound; actual results required.', 'INCOMPLETE in this document snapshot; current Code 1.145.1 admission and resumed local checks require their actual acceptance. Earlier failures remain retained.')
    .replace('Its required installed lifecycle remains INCOMPLETE after three failed normal rounds. An approved extra diagnostic must produce its own actual acceptance;', 'Its required installed lifecycle remains INCOMPLETE in this document snapshot. The owner approved resumed local tests and isolated current-host checks; actual acceptance is still required;')
    .replace('Current Code1.144.1 is recorded;', 'Available Code 1.145.1 is recorded; retained accepted CustomDocument10/reliability30 use Code 1.145.0;')
    .replace('-42 known', '- 42 known');
  write(doc + name, text);
}
const catalog = json(doc + 'catalog-results.json');
catalog.updatedAt = new Date().toISOString();
catalog.configuration = { ...catalog.configuration, codeVersion: '1.145.1', availableHostOnly: true, historicalNativeHosts: ['1.144.1', '1.145.0'], currentHostAcceptance: 'PENDING_EXACT_NATIVE_EVIDENCE' };
catalog.scopeExceptions = [{ feature: 'F26a', status: 'USER_RESUMED_INCOMPLETE_UNSUPPORTED_PENDING_VERIFICATION', furtherAttempts: 'AUTHORIZED_WITHIN_CURRENT_LOCAL_TEST_SCOPE', historicalSkipRetained: true }];
catalog.laterScopedEvidence = [fact(f05), fact(f28)];
catalog.laterScopedEvidenceMeaning = 'Exact-artifact developer-bootstrap observations on Code 1.145.0; no per-tool/item promotion and no current-host acceptance inferred.';
write(doc + 'catalog-results.json', catalog);
const oldIndex = json(doc + 'RELEASE-EVIDENCE.json');
const artifact = oldIndex.artifact, frozenCatalog = oldIndex.catalog;
const kitRoot = doc + 'independent-review-kit-20261104-18a12a73';
const identity = json(kitRoot + '/object-identity.json');
const configuration = {
  schemaVersion: 1, id: 'soterai-lite-e2ce3dc4-win32-x64-code1.145.1-20261106',
  artifactSha256: artifact.sha256, catalogSha256: frozenCatalog.sha256,
  platform: 'win32-x64', osRelease: '10.0.26300', availableCodeVersion: '1.145.1',
  installedCurrentHostAcceptance: 'PENDING', scope: 'LOCAL_TRUSTED_SYNTHETIC_ISOLATED_PROFILES',
  runtimeIdentity: identity.runtimeIdentity, candidateTools: catalog.tools.map(t => ({ id: t.id, name: t.name, version: t.pinnedVersion, surface: t.surface, status: 'UNVERIFIED_FINAL_ROUTE_PENDING', inventoryDate: '2026-11-04', currentVersionRequiresObservation: true })),
  actualUserConfiguration: null, meaning: 'Prepared configuration identity, not a measurement or supported-tool declaration.'
};
write(dir + '/CONFIGURATION.json', configuration);
const pending = { status: 'NOT_RUN', reportPath: null, reportSha256: null, observedAt: null };
write(dir + '/HUMAN-RESULT-TEMPLATES.json', {
  schemaVersion: 1, status: 'UNFILLED_TEMPLATE_NOT_ACCEPTANCE', artifact, catalog: frozenCatalog,
  configuration: fact(dir + '/CONFIGURATION.json'),
  smoke: catalog.tools.map(t => ({ toolId: t.id, actualVersion: null, supportedRouteEvidence: null, login: 'OWNER_ACTION_IF_REQUIRED', publicTask: null, fakeSecretWithheld: null, cancelled: null, providerFailure: null, withdrawal: null, ...pending })),
  benchmarks: ['NODE_EXPRESS_FAKE_DB', 'NEXTJS_FAKE_API'].map(project => ({ project, modelVersion: null, runs: ['OFF', 'ON'].map(protection => ({ protection, completions: null, tasksAttempted: null, actualModelPrompts: null, interruptions: null, elapsedMs: null, publicCorrectness: null, syntheticLeakObservation: null, ...pending })) })),
  usability: Array.from({ length: 5 }, (_, n) => ({ participantId: 'anonymous-' + (n + 1), install: null, understandLimits: null, restrictFile: null, setup: null, maskedPreview: null, cancel: null, restore: null, timeToUsefulProtectionMs: null, adminPrompts: null, extraInstalls: null, errors: [], ...pending })),
  screenReader: { name: null, version: null, codeVersion: null, focus: null, labels: null, maskedValues: null, announcements: null, keyboardFlows: null, ...pending },
  optionalSymlink: { decision: null, ...pending },
  independentReview: { reviewerCategory: null, vendor: null, staticScope: null, dynamicScope: null, originalVerbatim: null, ...pending },
  platforms: ['linux', 'darwin', 'remote', 'virtual', 'powershell7'].map(platform => ({ platform, decision: null, ...pending })),
  publication: { ownerIdentity: null, channel: null, advisoryRemediationOrRiskDecision: null, decision: null, executed: false }
});
write(dir + '/CURRENT-CLAIMS.md', '# Current claims supplement - 6 November 2026\n\nThe frozen README-CLAIMS is a historical input to the exact artifact. This supplement preserves those bytes and records later status. Candidate SHA-256: `' + artifact.sha256 + '`. Release NOT_READY; rating PENDING.\n\n- F31a/F31b scoped package preparation is retained. The exact F32-format package includes 18 entries, four runtimes, embedded SBOM, privacy and notices. Offline verification is not installed acceptance.\n- F26a work has resumed under the current owner instruction; pre-commit remains INCOMPLETE/unsupported in this candidate until accepted evidence. Prior permanent-skip wording does not control the resumed task. A code or manifest change requires a new artifact and affected checks.\n- Accepted CustomDocument10 and reliability30 observations use this exact artifact and Code 1.145.0. Their scopes are developer-bootstrap, not clean installation. The available Code 1.145.1 still needs current-host qualification.\n- The full suite retains 4,887 passes, zero failures and four privileged-symlink skips across 4,891 tests. The 17-case unmanaged baseline remains eight blocked and nine confirmed leaks.\n- The six-tool by 44-row catalog has 264 UNVERIFIED pairs. Actual per-tool route, public/negative controls and mutation evidence are still required; no aggregate count upgrades those rows.\n- Four scripted benchmark cases passed in their recorded component scope with zero model calls. The Node case is Express-shaped, without the Express dependency; actual Express integration and both real-model project trials remain pending.\n- The retained audit has 42 build-dependency associations: 17 HIGH, 19 MODERATE and 6 LOW. Remediation OPEN; owner risk acceptance NOT_GRANTED. No clean-audit or shipped-runtime vulnerability count is inferred.\n- The neutral 393-entry manifest plus current-status addendum is a review input. The external verdict, five-user usability and actual screen-reader evidence remain absent.\n\n[Human actions](../../../HUMAN-ACTIONS.md) and HANDOFF.json state the exact handoff and remaining prerequisites.\n');
oldIndex.updatedAt = new Date().toISOString();
oldIndex.facts.push(fact(f05), fact(f28), fact(doc + 'evidence/20261106-remaining-queue/f32-preparation.json'));
oldIndex.documents = ['USER-GUIDE.md', 'coverage-map.md', 'release-checklist.md', 'FINAL-REPORT.md', 'SCORECARD.md', 'catalog-results.json', 'HUMAN-ACTIONS.md', 'FEATURE-SPLIT.md', 'ITEM-MATRIX.md', 'README-CLAIMS.md', 'PUBLISHING-RUNBOOK.md', 'release-identity.json'].map(n => fact(doc + n));
oldIndex.limitations = oldIndex.limitations.map(x => x === 'F26a skipped unsupported' ? 'F26a owner-resumed; incomplete and unsupported pending verification' : x);
oldIndex.currentHost = '1.145.1_AVAILABLE_NO_NATIVE_ACCEPTANCE_INFERRED';
write(doc + 'RELEASE-EVIDENCE.json', oldIndex);
const humanActions = doc + 'HUMAN-ACTIONS.md';
write(dir + '/HANDOFF.json', {
  schemaVersion: 1, preparedAt: new Date().toISOString(), status: 'PREPARED_HANDOFF_PREREQUISITES_INCOMPLETE',
  artifact, catalog: frozenCatalog, sourceProof: fact(proofPath), frozenSourceCount: proof.files.length,
  configuration: fact(dir + '/CONFIGURATION.json'), runtimeIdentity: identity.runtimeIdentity,
  neutralKit: { root: kitRoot, manifest: fact(kitRoot + '/file-list.json'), manifestEntryCount: 393, totalFilesIncludingManifest: 394, addendum: fact(dir + '/NEUTRAL-REVIEW-ADDENDUM.md'), independentVerdict: 'NOT_PROVIDED' },
  currentHostObservation: fact(doc + 'evidence/20261106-remaining-queue/f32-preparation.json'),
  receipts: [...oldIndex.facts],
  documents: [...oldIndex.documents, fact(doc + 'RELEASE-EVIDENCE.json'), fact(dir + '/CURRENT-CLAIMS.md'), fact(dir + '/HUMAN-RESULT-TEMPLATES.json')],
  preservedBefore: previous.map(f => ({ ...f, preservedAt: dir + '/before-' + path.basename(f.path) })),
  gates: {
    F31: { status: 'SCOPED_PACKAGE_PREPARATION_RETAINED_GLOBAL_READINESS_INCOMPLETE', remaining: 'F26a/F32/final gates and owner release decisions' },
    V01: { status: 'INCOMPLETE', remaining: 'Installed F32/current-host acceptance and actual supported tool routes; preserve qualified native scope and unmanaged baseline' },
    V02: { status: 'INCOMPLETE', remaining: '44-by-6 applicability/control/mutation mapping, exact startup/scan/stream/stress budgets, Express integration and human model trials' },
    V03: { status: 'DELIVERABLES_PREPARED_PREREQUISITES_INCOMPLETE', remaining: 'Refresh claim/artifact bindings after accepted remaining work; no final rating' },
    V04: { status: 'NEUTRAL_PACKET_PREPARED_NOT_INDEPENDENT_REVIEW', remaining: 'External exact-object static/dynamic verdict; current status supplied by neutral addendum' },
    V05: { status: 'HUMAN_CHECKLIST_PREPARED_NOT_ENTERED', handoff: fact(humanActions), remaining: 'Original L6 prerequisites, then human actions and STOP' }
  },
  featureComplete: false, releaseReady: false, finalRating: null, humanResults: 'NOT_PROVIDED', independence: 'LOW',
  permittedByThisPreparation: { subprocesses: 0, network: 0, nativeLaunches: 0, publication: false }
});
console.log(JSON.stringify({ status: 'PREPARED_NOT_GATE_ACCEPTANCE', documents: oldIndex.documents.length, catalogPairs: catalog.pairCount, handoff: fact(dir + '/HANDOFF.json') }));
