'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = n => path.join(__dirname, n);
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = f => { f = path.resolve(repo, f); const b = fs.readFileSync(f); return { path: path.relative(repo, f).replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) }; };
const write = (n, v) => fs.writeFileSync(own(n), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const config = read(own('candidate-01/f32-candidate-config.json')), qualified = read(config.finalQualification.path), full = read(config.fullAcceptance.path);
const native = read(own('f26a/native14-acceptance.json'));
assert.equal(qualified.vsix.sha256, '011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
const affectedPath = path.resolve(__dirname, '../20261106-v01-current-01/affected-acceptance.json'), affected = read(affectedPath);
assert.equal(native.status, 'PASS_CURRENT_FINAL_CANDIDATE_ORIGINAL_NATIVE34');
const f05Path = path.resolve(__dirname, '../20261106-editor-reliability-01/f05-current-acceptance-04.json');
const queueFile = path.join(repo, 'docs/soterai-lite/FEATURE-QUEUE.json'), q = read(queueFile);
write('FEATURE-QUEUE.before-current-progress.json', q);
const progress = {
 observedAt: new Date().toISOString(), status: 'CURRENT_CODE_PACKAGE_NATIVE34_AFFECTED175_VERIFIED_REMAINING_NATIVE_BLOCKED_BY_UPDATER',
 artifact: fact(config.currentVsix.path), sourceProof: fact(config.sourceProof.path), fullAcceptance: fact(config.fullAcceptance.path),
 fullCounts: full.counts, fullSuiteExecution: full.executionStatus, metadataTests: qualified.metadataTests, packageTests: qualified.packageTests,
 compiler: 'PASS_CURRENT', package: 'PASS18_ENTRIES_FOUR_RUNTIMES_EMBEDDED_SBOM',
 native34: fact(own('f26a/native14-acceptance.json')), affected175: fact(affectedPath),
 f05Native10: fact(f05Path), benchmarksAndMutation: fact(own('final/V02-CURRENT-SUPPLEMENT-01.json')),
 handoff: fact(own('final/HANDOFF-current-01.json')), nativeSupplement: fact(own('final/NATIVE-CURRENT-SUPPLEMENT-02.json')),
 updaterObservation: fact(path.resolve(__dirname, '../20261106-editor-reliability-01/f28-current-01/updater-observation-01.json')),
 preparedRemaining334: fact(path.resolve(__dirname, '../20261106-v01-remaining334-01/binding.json')),
 preparedF32: fact(path.resolve(__dirname, '../20261103-f32-lifecycle-2e95d6a4/installed-extra09-admission.json')),
 f32: { acceptedAssertions: 0, requiredAssertions: 44, requiredObservations: 59, requiredPhases: 8, status: 'EARLY_RENDERER_ATTACH_SUCCESSOR_READY_NOT_RUN', failure: 'Previous installed run observed trust changing before renderer attachment; initiating trigger remains unknown. Failed runs retained.' },
 remaining: ['Actual remaining334 to reach original509 affected checks', 'F32 installed44/59/eight phases', 'Current F28 native30 complete run', 'Five real tool-route matrices99 plus Cline hook4', 'Per-catalog applicable tool control/oracle and mutation evidence', 'Scoped source/evidence commit and transition byte proofs', 'Required authenticated real-agent, usability, screen-reader and independent review evidence'],
 releaseReady: false, finalRating: null, featureComplete: false,
 nativeBlocker: 'External VS Code updater holds vscode-updating; installed1.145.1 hash unchanged at last observation. No updater termination or normal-profile changes authorized or performed.'
};
write('current-progress-01.json', progress); const progressFact = fact(own('current-progress-01.json'));
q.currentResumedWork = { ...q.currentResumedWork, status: progress.status, latestProgress: progressFact, artifact: progress.artifact, sourceProof: progress.sourceProof, nativeBlocker: progress.nativeBlocker, featureComplete: false, releaseReady: false };
const f26 = q.features.find(f => f.id === 'F26'), f26a = f26.subcards.find(f => f.id === 'F26a');
f26a.status = 'VERIFYING'; f26a.result = 'INCOMPLETE'; f26a.progressEvidence = progressFact.path;
f26a.executionState = 'NATIVE34_PASS_ORIGINAL_AFFECTED509_AND_COMMIT_PENDING';
f26a.currentNativeAcceptance = progress.native34; f26a.currentAffectedAcceptance = progress.affected175;
f26a.remaining = ['Original remaining334 affected assertions; current175 already accepted', 'Scoped source/evidence commit, ledger and transition byte proofs'];
f26a.candidateAvailability = { preCommitDefault: false, ownerReviewedOptIn: true, native34: 'PASS_SCOPED', featureComplete: false };
const f32 = q.features.find(f => f.id === 'F32');
f32.historicalImplementationState = f32.historicalImplementationState || f32.implementationState;
f32.implementationState = { recordedAt: '2026-11-06', status: 'SOURCE_FULL_PACKAGE_PASS_INSTALLED_ACCEPTANCE_PENDING', sourceProof: progress.sourceProof, vsix: progress.artifact, fullSuite: { ...full.counts, evidence: progress.fullAcceptance, execution: full.executionStatus }, metadataTests: qualified.metadataTests, packageTests: qualified.packageTests };
f32.installedLifecycle.currentAttemptState = progress.f32;
f32.installedLifecycle.preparedSuccessor = progress.preparedF32;
f32.installedLifecycle.currentNativeBlocker = progress.nativeBlocker;
const f31 = q.features.find(f => f.id === 'F31'); f31.currentPackageQualification = fact(config.finalQualification.path);
f31.remaining = 'Current packaging controls pass55, content18/four runtimes verified; parent completion still requires original F26a/F32 and final evidence. Known42 builder findings remain disclosed.';
const gateStates = { V01: 'FULL_PACKAGE_AFFECTED175_F05_PASS_REMAINING_NATIVE_PENDING', V02: 'SCRIPTED4_STREAM6_COMPONENT_MUTATION_AND_CATALOG_MAPPING_COMPLETE_FULL_APPLICABILITY_PENDING', V03: 'CURRENT_DELIVERABLES_PREPARED_PREREQUISITES_INCOMPLETE', V04: 'CURRENT_NEUTRAL_KIT393_VERIFIED_PREREQUISITES_INCOMPLETE', V05: 'HUMAN_CHECKLIST_PREPARED_NOT_ENTERED' };
for (const g of q.finalGates) { g.status = 'VERIFYING'; g.result = 'INCOMPLETE'; g.preparationState = gateStates[g.id]; g.currentProgress = progressFact; }
fs.writeFileSync(queueFile, JSON.stringify(q, null, 2) + '\n');
fs.appendFileSync(path.join(repo, 'docs/soterai-lite/ledger.md'), '\n\n## STEP RECEIPT CURRENT CANDIDATE / native34 and affected175 verified\n\n6 November 2026. Current VSIX `011f96d1` is 1,742,104 bytes; package55 and metadata110 controls pass, compiler passes, archive18/four runtimes and embedded SBOM verified. Full suite4892:4888PASS/zeroFAIL/4privilegedSKIP, transparently reused after only the canonical setting-description synchronization; original full execution and fresh metadata/package checks remain distinct. F26a native34 and actual owner-absent Git block PASS; both Code phases, outer wrappers and streams closed. Same-candidate affected175/8phases plus functional10 PASS; security17 retains8BLOCKED_SCOPED/9LEAK_CONFIRMED. F05 current10 PASS. F32 extra08 failed before renderer attachment; improved extra09 is prepared, not accepted. F28 peer and Cline startup hit an external vscode-updating mutex, all failures retained. Original remaining334/29phases, tool routes and final catalog/human gates remain required. No source/transition commit or feature DONE is inferred. Current exact evidence: `' + progressFact.path + '` SHA256 `' + progressFact.sha256 + '`.\n');
console.log(JSON.stringify({ status: 'CURRENT_PROGRESS_RECORDED_NO_FALSE_COMPLETION', progress: progressFact, queue: fact(queueFile) }, null, 2));
