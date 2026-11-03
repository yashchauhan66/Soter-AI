'use strict';
// Local evidence mapping only: reads current files/results; no tests/Git/network/native execution.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replaceAll('\\', '/'), bytes: raw.length, sha256: sha(raw) }; };
const evidence = new Map();
function take(file) { const row = fact(file); evidence.set(row.path, row); return row; }
function pin(row) { const actual = fact(path.resolve(repo, row.path)); assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256); }
function closed(name) {
    const file = own(name + '-owned-close.json'), value = read(file);
    for (const [key, expected] of Object.entries({ actualClose: true, exitCode: 0, signal: null, stdoutEOF: true,
        stderrEOF: true, deadlineExceeded: false, overflow: false, streamError: false, signalsRequested: 0 })) assert.equal(value[key], expected, name + ':' + key);
    for (const stream of value.streams) {
        const row = take(own(name + '-' + stream.name + '.bin')); assert.equal(row.bytes, stream.bytes);
        assert.equal(row.bytes, stream.observedBytes); assert.equal(row.sha256, stream.sha256);
    }
    take(file); return value;
}
function canonical(name) {
    const result = read(own(name + '.txt.result.json')); assert.equal(result.exitCode, 0);
    assert.equal(take(own(name + '.txt')).sha256, result.sha256.toLowerCase()); take(own(name + '.txt.result.json'));
}
for (const target of ['F31b-case-map-01.json', 'F31b-case-map-01.md']) assert(!fs.existsSync(own(target)), 'Immutable mapping already exists.');
const C = require('./current-native-admission-06.cjs'), current = C.binding();
assert.equal(current.sourceProof.sha256, '221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99');
assert.equal(current.vsix.sha256, '6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c');
const packageClose = closed('package-components-06'), tapPath = own('package-components-06-stdout.bin');
const tap = fs.readFileSync(tapPath, 'utf8');
const controls = [...tap.matchAll(/^(ok|not ok) (\d+) - (.+)$/gm)].map(match => ({
    id: 'PKG' + match[2].padStart(3, '0'), tapOrdinal: Number(match[2]), title: match[3],
    result: match[1] === 'ok' ? 'PASS' : 'FAIL', run: 'package-components-06',
    kind: Number(match[2]) <= 20 ? 'LEGACY_SHARED_AUDITOR_CONTROL' : 'F31B_FINAL_PACKAGE_OR_METADATA_CONTROL' }));
assert.equal(controls.length, 46); assert(controls.every(row => row.result === 'PASS'));
for (const line of ['# tests 46', '# pass 46', '# fail 0', '# cancelled 0', '# skipped 0']) assert(tap.includes(line));
function refs(...titles) { return titles.map(title => { const matches = controls.filter(row => row.title === title); assert.equal(matches.length, 1, title); return matches[0].id; }); }
function byCase(id) { return controls.filter(row => row.title.startsWith(id + ' ')).map(row => row.id); }
const row = (id, subject, implementation, controlRefs, established, gaps = []) => ({ id, subject,
    status: gaps.length ? 'PARTIAL_NAMED_UNVERIFIED_SUBCASES' : 'OBSERVED_SCOPED_CONTROLS_AND_OBJECT_FACTS',
    implementation, controlRefs, established, gaps });
const cases = [
    row('B01', 'Deterministic noncircular embedded metadata', ['packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'], byCase('B01'),
        ['Same admitted synthetic graph twice produces identical SBOM/notices; no timestamp/serialNumber/final-VSIX property.', 'Actual embedded SBOM binds immutable build-receipt SHA and runtime/source inventory; final archive SHA is detached.']),
    row('B02', 'Runtime/source graph changes bind different facts', ['packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'], byCase('B02'),
        ['Runtime digest and source-input digest mutations change metadata. Production object recomputation checks current actual source/runtime hashes.']),
    row('B03', 'Missing/tampered runtime/input/provenance refusal', ['packages/soterai-lite/scripts/audit-release.cjs:inspectProvenance', 'packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'],
        [...byCase('B03'), ...refs('missing runtime cannot yield inventory success', 'runtime bytes must agree with build provenance', 'missing build input cannot become a complete SBOM', 'changed build input is refused', 'duplicate runtime provenance is rejected'), ...byCase('B13').filter(id => controls.find(row => row.id === id).title.includes('provenance'))],
        ['Missing/duplicate runtime, runtime byte mismatch, missing/changed input and invalid provenance hash are refused. Legacy controls exercise shared provenance logic; they are not new final-mode permutations.']),
    row('B04', 'Actual bundled libraries, repeated inputs and versions', ['packages/soterai-lite/scripts/audit-release.cjs:inspectProvenance/packageRoot', 'packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'],
        [...byCase('B04'), ...refs('exact synthetic artifact yields inventory and actual bundled-component SBOM; readiness stays incomplete')],
        ['Production18 archive has exactly @babel/parser7.29.7 MIT, jsonc-parser3.3.1 MIT, yaml2.9.0 ISC as bundled library components.', 'Actual source-input grouping records bundled runtimes and package-root identity; no unbundled workspace dependency is called embedded.'],
        ['No focused fixture proves repeated nested package-version merging across different roots/runtimes.', 'Two roots with identical package name/version conservatively refuse unique notice matching; successful acceptance for that future graph is not claimed.']),
    row('B05', 'Complete exact notices and component identity', ['packages/soterai-lite/scripts/audit-release.cjs:inspectProvenance', 'packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'],
        [...byCase('B05'), ...byCase('B04'), ...refs('unknown license is visible INCOMPLETE without inventing approval', 'missing notice is visible INCOMPLETE')],
        ['Missing/unknown notices, mismatched notice-component identity and changed notice text are refused by final metadata controls; complete production notices are bound and recomputed.', 'Source explicitly rejects metadata.name differing from its node_modules package-root tail.'],
        ['No focused actual negative fixture mutates package.json name versus package path; code review alone is not dynamic coverage of that guard.']),
    row('B06', 'Dependency/path/notice resource boundaries', ['packages/soterai-lite/scripts/audit-release.cjs:ordinary/read/codeInput', 'packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'],
        [...byCase('B06'), ...refs('repository selector input paths outside code inventory are refused before reading')],
        ['Absolute source path and over256KiB notice text are refused; shared auditor rejects a .env input selector before reading.'],
        ['Linked dependency/input and excessive component/notice-count guards are implemented but have no named focused executed controls in package46.']),
    row('B07', 'Strict valid final archive and final inventory', ['packages/soterai-lite/scripts/audit-release.cjs:auditFinalRelease/verifyFinal'], byCase('B07'),
        ['Synthetic valid final18 archive recomputes embedded metadata/notices and keeps releaseReadyfalse.', 'Current production attempt03 has strict18 entries/four runtimes/final archive SHA and complete detached inventory.']),
    row('B08', 'Missing/extra/alias/malformed/oversized archive refusal', ['packages/soterai-lite/scripts/audit-release.cjs:archive/auditFinalRelease'],
        [...byCase('B08'), ...refs('source maps and evidence are not accepted as release entries', 'case alias entries are refused', 'truncated ZIP is a failure, never a partially successful inventory', 'archive entry with excessive expanded size is refused')],
        ['New final-mode controls reject missing privacy and an extra map.', 'Legacy shared ZIP controls reject aliases, truncation and oversized entries; strict final18 allowlist and bounded parsing remain active.'],
        ['No exhaustive final-mode duplicate/case-alias/malformed/truncated/oversized matrix was executed separately for each new SBOM/privacy/notices asset.']),
    row('B09', 'Recomputed component/runtime/notice consistency', ['packages/soterai-lite/scripts/audit-release.cjs:inspectProvenance/verifyFinal'],
        [...byCase('B09'), ...byCase('B05'), ...refs('runtime bytes must agree with build provenance')],
        ['Well-formed changed SBOM, post-receipt bundled source drift and changed notice bytes are detected; independent archive SHA does not substitute for provenance consistency.', 'Runtime mismatch is dynamically covered through shared legacy auditor; current final object exact runtime bytes are recomputed.']),
    row('B10', 'Actual platform/pre-release XML', ['packages/soterai-lite/scripts/audit-release.cjs:finalXml/verifyFinal', 'packages/soterai-lite/scripts/package.cjs:packageBuild'],
        [...byCase('B10'), ...refs('platform must be explicitly win32-x64')],
        ['Actual vsce output is win32-x64 with one real PreRelease=true property. Preview/missing property, duplicate attribute, comment-only property, unclosed tail, second root and undeclared entity controls refuse.']),
    row('B11', 'Identity, immutable manifest and virtual-workspace declaration', ['packages/soterai-lite/scripts/audit-release.cjs:verifyFinal', 'packages/soterai-lite/scripts/build.cjs', 'packages/vscode-extension/package.json', 'packages/soterai-lite/package.json'],
        [...byCase('B11'), ...refs('manifest identity must match build provenance')],
        ['Final virtual-workspace mutation refuses; actual canonical build copying preserves virtualWorkspaces.supportedfalse and limited-trust declaration.', 'Current archive identity/version/main/four runtimes match immutable build/package receipts; shared legacy wrong-publisher control refuses.']),
    row('B12', 'Trust and owner-required pre-commit release exclusion', ['packages/vscode-extension/src/history-hooks/commands.ts:registerPreCommitHooks', 'packages/soterai-lite/scripts/audit-release.cjs:verifyFinal', 'packages/vscode-extension/package.json'], byCase('B12'),
        ['Final package cannot remove unsupportedFeatures[preCommit]. Three actual full-suite F31b command controls refuse new grants despite flags/caller arguments, retain reviewed recovery, and refuse unreadable metadata without leaking its error.', 'Limited-trust/virtual declarations are current packaged facts.'],
        ['Actual installed restricted-workspace transition, disable/uninstall and aggregate removal are F32 NOT_RUN; package declarations alone cannot prove them.']),
    row('B13', 'Exclusive output and immutable attempt custody', ['packages/soterai-lite/scripts/package.cjs:parents/stable/packageBuild', 'packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'], byCase('B13'),
        ['Existing output sentinel is preserved after overwrite refusal; invalid provenance hash/duplicate source input refuse.', 'Three unique retained production attempts preserve failures01/02 and accepted03; COPYFILE_EXCL and exclusive new stage/assets paths are implemented.'],
        ['No named focused executed linked/outside output-parent or preexisting report collision negative control in package46.']),
    row('B14', 'Owner-selected complete BUSL and third-party notices', ['packages/soterai-lite/LICENSE.md', 'packages/soterai-lite/scripts/audit-release.cjs:verifyFinal', 'packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata'],
        [...byCase('B14'), ...byCase('B04'), ...byCase('B05')],
        ['Short BUSL summary refuses; current shipped full4493-byte terms equal owner-selected historical SHA50850df5...a253.', 'Actual shipped complete third-party notice bytes are bound to admitted three-library graph. No legal approval is inferred.']),
    row('B15', 'No invented results, safe metadata/log contents', ['packages/soterai-lite/scripts/release-metadata.cjs:createEmbeddedMetadata', 'packages/soterai-lite/scripts/audit-release.cjs:auditFinalRelease', 'packages/soterai-lite/PRIVACY.md'],
        [...byCase('B15'), ...refs('deterministic SBOM and report do not include current timestamps or guessed results', 'exact synthetic artifact yields inventory and actual bundled-component SBOM; readiness stays incomplete')],
        ['Metadata explicitly leaves native/advisory/legal authority outside itself and releaseReadyfalse; absolute fixture root is absent from shared auditor reports.', 'Authorized advisory response is now REVIEW_REQUIRED, never a clean audit; native actual scope and missing human gates are retained separately.'],
        ['No explicit synthetic environment/token sentinel injection-and-log/SBOM/inventory absence test was executed in package46. Real credentials were not inspected by this mapping.']),
    row('B16', 'Installed pinned packager integration', ['packages/soterai-lite/scripts/__tests__/release-package.test.cjs', 'packages/soterai-lite/scripts/package.cjs:packageBuild'], byCase('B16'),
        ['Three actual vsce component controls inspect real final18/pre-release output, production files allowlist and preservation of reviewed README relative-link bytes.', 'Synthetic stages/runtimes only; this is installed packager use, not Code installed-VSIX lifecycle.']),
    row('B17', 'Actual final production package and affected object checks', ['packages/soterai-lite/scripts/package.cjs', 'packages/soterai-lite/scripts/audit-release.cjs'], [],
        ['Current unique attempt03 VSIX6231159d...c688c/1735938 bytes has actual package04 natural0/bothEOF, strict content03 receipt,18 entries/four runtimes/88 settings and immutable graph1098.', 'Current affected chain03 wrappers closed successfully; accepted-root aggregation and withdrawal are recorded separately below, not inferred from old objects.']),
    row('B18', 'Claims, privacy, unsupported boundaries and content drift', ['docs/soterai-lite/README-CLAIMS.md', 'packages/soterai-lite/README.md', 'packages/soterai-lite/PRIVACY.md', 'docs/soterai-lite/PUBLISHING-RUNBOOK.md', 'packages/soterai-lite/scripts/audit-release.cjs:verifyFinal'],
        [...byCase('B18'), ...byCase('B16')],
        ['README source drift refuses; production README bytes survive actual vsce packaging unchanged.', 'README retains pre-commit unsupported/PS7 absent/unmanaged9leaks/same-user/other-extension/platform/human limits; privacy documents automatic scans, filenames/retention, separate provider traffic/telemetry and recovery.', 'Fresh manifest-reference559 checks and source claims review are distinct from full4783 and package46; repeated references do not add test counts.'],
        ['README-CLAIMS still labels some current packaging/route checks pending; do not read it as comprehensive current per-tool acceptance.', 'Positive/negative universal-claims mutation corpus and all final-tool/class/catalog checks remain V01/V02; authenticated human trials and independent exact-object review remain V05/L7.'])
];
assert.deepEqual(cases.map(row => row.id), Array.from({ length: 18 }, (_, i) => 'B' + String(i + 1).padStart(2, '0')));
closed('package-04'); canonical('content-03'); closed('manifest-components-03');
for (const name of ['full-inputs-04.json', 'full-suite-acceptance-04.json', 'backend-byte-reuse-01.json', 'content-inspection-02.json',
    'native-binding-01.json', 'affected-chain-result-03.json', 'interrupted-full-owner-observation-01.json', 'feature-source-scope01.json']) take(own(name));
for (const name of ['packages/soterai-lite/scripts/__tests__/audit-release.test.cjs', 'packages/soterai-lite/scripts/__tests__/release-metadata.test.cjs',
    'packages/soterai-lite/scripts/__tests__/release-package.test.cjs', 'packages/soterai-lite/scripts/audit-release.cjs', 'packages/soterai-lite/scripts/package.cjs',
    'packages/soterai-lite/scripts/release-metadata.cjs', 'docs/soterai-lite/README-CLAIMS.md', 'packages/soterai-lite/README.md', 'packages/soterai-lite/PRIVACY.md',
    'docs/soterai-lite/PUBLISHING-RUNBOOK.md', 'docs/soterai-lite/evidence/20261102-release-gate-readiness/F31B-ACCEPTANCE-SPEC-01.md']) take(path.join(repo, name));
const content = read(own('content-inspection-02.json')), inventory = read(own('offline-inventory-02/release-inventory.json'));
take(own('offline-inventory-02/release-inventory.json')); take(own('offline-inventory-02/sbom.cdx.json'));
take(path.join(repo, content.vsix.output)); take(path.join(repo, content.buildReceipt));
assert.equal(inventory.status, 'PASS_FINAL_OFFLINE_PACKAGE_NOT_RELEASE_READY'); assert.equal(inventory.entries.length, 18);
const full = read(own('full-suite-acceptance-04.json')); assert.equal(full.counts.tests, 4783); assert.equal(full.counts.fail, 0);
const commandTitles = ['F31b excluded Lite release cannot install or resume pre-commit even with the machine flag and caller approval',
    'F31b excluded Lite release retains explicit owned-hook recovery while disabled',
    'F31b unreadable release capability refuses new pre-commit grants without leaking metadata errors'];
const commandTap = fs.readFileSync(own('unit-shard-05-02-stdout.bin'), 'utf8');
for (const title of commandTitles) assert(commandTap.split('\n').some(line => /^ok \d+ - /.test(line) && line.endsWith(title)));
const commandEvidence = take(own('unit-shard-05-02-stdout.bin')); take(own('unit-shard-05-02-owned-close.json'));
const chain = read(own('affected-chain-result-03.json'));
assert.equal(chain.status, 'F31B_REMAINING_FUNCTIONAL_SECURITY_MCP_RETAINED_ROUND03_CLOSED_ROOT_AGGREGATION_PENDING');
for (const phase of chain.results) { assert.equal(phase.status, 'PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING'); closed(phase.name); }
const native = { currentChain: take(own('affected-chain-result-03.json')), rootAcceptance: 'PENDING_ROOT_VERIFIER_NOT_INFERRED_FROM_CHAIN',
    markedOwnerAbsence: 'PENDING', original34Precommit: 'USER_SKIPPED_INCOMPLETE_NO_RETRY', installedVsixLifecycle: 'F32_NOT_RUN' };
if (fs.existsSync(own('affected-acceptance-01.json'))) {
    const accepted = read(own('affected-acceptance-01.json'));
    assert.equal(accepted.status, 'PASS_CURRENT_F31B_AFFECTED4_175_8_FUNCTIONAL10_SECURITY17_BASELINE');
    assert.equal(accepted.sourceProof.sha256, current.sourceProof.sha256); assert.equal(accepted.vsix.sha256, current.vsix.sha256);
    assert.equal(accepted.totalAssertions, 202); assert.deepEqual(accepted.residuals, { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 });
    accepted.evidence.forEach(pin); native.rootAcceptance = take(own('affected-acceptance-01.json'));
    native.counts = { affectedChecks: 175, affectedPhases: 8, functional: 10, securityBaseline: 17, blockedScoped: 8, confirmedLeaks: 9 };
}
if (fs.existsSync(own('post-owner-absence-01.json'))) {
    const post = read(own('post-owner-absence-01.json')); assert.equal(post.status, 'MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS');
    assert.equal(post.observations.length, 2); assert(post.observations.every(row => row.markedCount === 0));
    native.markedOwnerAbsence = take(own('post-owner-absence-01.json'));
}
const advisory = read(own('advisory-runner-01-results/summary.json'));
assert.equal(advisory.status, 'REVIEW_REQUIRED_ADVISORY_IDS_FOUND'); assert.equal(advisory.advisoryIds.length, 42);
assert.equal(advisory.completedBatches, 8); assert.equal(advisory.artifactSha256, current.vsix.sha256);
canonical('advisory-run-01'); take(own('advisory-runner-01-results/summary.json'));
const preparation = read(own('advisory-preparation-01.json')); take(own('advisory-preparation-01.json'));
const report = { schemaVersion: 1, status: 'F31B_CASE_MAP18_SCOPED_OBSERVED_CONTROLS_GAPS_AND_ADVISORY_REVIEW_REQUIRED',
    observedAt: new Date().toISOString(), feature: 'F31b', featureComplete: false, releaseReady: false, nextFeatureSelected: false,
    independence: 'LOW_SAME_LINEAGE_EVIDENCE_MAPPING_NOT_INDEPENDENT_ACCEPTANCE', sourceProof: current.sourceProof, artifact: current.vsix,
    caseCount: 18, cases, controls, countBoundary: { package: { tests: 46, pass: 46, fail: 0, skipped: 0 },
        full: full.counts, manifestTargeted: { tests: 559, pass: 559, fail: 0 },
        rule: 'Control IDs are references into one actual package46 run, not new executions. A control may support multiple cases but is counted once. Full/manifest/package counts are separate and never summed as unique tests.' },
    releaseWithdrawalCommands: { titles: commandTitles, evidence: commandEvidence, fullSuiteIncluded: true, extraUniqueTestCount: 0 },
    bundledComponents: inventory.licenses.map(row => ({ name: row.name, version: row.version, license: row.license, status: row.status })),
    native, advisory: { status: advisory.status, gate: advisory.advisoryGate, requests: advisory.requestAttempts,
        queries: preparation.proposedRequest.totalUniqueQueries, completedBatches: 8, distinctAdvisoryIds: 42,
        otherLockfileVersionRecordsUnaudited: advisory.otherLockfileVersionRecordsUnaudited,
        detailRequests: advisory.detailRequests, paginationRequests: advisory.paginationRequests, retryRequests: advisory.retryRequests,
        exposureAssessment: 'UNRESOLVED_IDS_ARE_NOT_42_CONFIRMED_EXPLOITABLE_VSIX_FINDINGS', cleanAuditClaim: false },
    historicalOwnerGaps: ['Original outer exec84707 close/EOF UNCONFIRMED; Node21856 absent twice does not establish historical exit/EOF.',
        'Original monolithic full01 close/EOF/TAP UNVERIFIED; corrected accepted shards are separate evidence.',
        'Earlier F20/interrupted F28 and unobserved nested/vendor descendant closure remain separately UNCONFIRMED.'],
    remaining: ['Review/resolve current advisory and required unaudited dependency scope before F31b DONE.',
        'Named unexecuted subcases above remain unverified; no perfect or complete permutation coverage claim.',
        'Scoped source/evidence commit and raw byte proof pending; all unrelated changes preserved.',
        'F32 installed-only lifecycle, V01/V02 final corpus, V03/V04 docs/reviewer packet, original V05/L6 HUMAN-ACTIONS and STOP.',
        'Required human/different-vendor evidence precedes L7/final rating; no publish/push/tag authority.'],
    checksPerformedByMapper: 'Read-only current source/hash/owned-close/TAP/receipt consistency checks. No tests, product changes, Git writes, network or native launches.',
    evidence: [...evidence.values()] };
const json = JSON.stringify(report, null, 2) + '\n';
const md = ['# F31b B01–B18 current evidence map', '',
    'This map references executed results; it runs no tests. F31b remains **INCOMPLETE**, with mandatory advisory review and named unverified subcases. No F32 transition, release-ready or rating claim.', '',
    'Current VSIX: `' + current.vsix.sha256 + '` / ' + current.vsix.bytes + ' bytes. Current source graph1098: `' + current.sourceProof.sha256 + '`.', '',
    'Package46 PASS, full4783/4779PASS/4SKIP, and targeted manifest559 PASS are separate result sets. Repeated references below add zero tests.', '',
    '| Case | Observed support | Remaining boundary |', '| --- | --- | --- |',
    ...cases.map(row => '| ' + row.id + ' ' + row.subject + ' | ' + (row.controlRefs.join(', ') || 'Actual package04/content03/artifact receipts') + ': ' + row.established.join(' ') + ' | ' + (row.gaps.join(' ') || 'Scoped claims only; no exhaustive/general safety claim.') + ' |'), '',
    '## Exact control index', '', ...controls.map(row => '- `' + row.id + '` / package-components-06 TAP' + row.tapOrdinal + ': ' + row.title + ' — PASS.'), '',
    '## Native and remaining gates', '',
    'Current native root acceptance: ' + (typeof native.rootAcceptance === 'string' ? native.rootAcceptance : native.rootAcceptance.path) + '. Developer bootstrap is not F32 installed-only lifecycle. Retained baseline8blocked/9confirmed leaks is never relabeled clean.', '',
    'Authorized OSV initial8 requests queried284 public package/version pairs and returned42 distinct advisory IDs. Gate **REVIEW_REQUIRED**;745 other lockfile-version records remain unaudited. No advisory detail/pagination/retry requests occurred. IDs do not establish42 exploitable final-VSIX vulnerabilities.', '',
    'Original outer84707 close/EOF remains **UNCONFIRMED** despite Node21856 being absent twice; historical missing closures and original full01 are not repaired by current success.', '',
    ...report.remaining.map(value => '- ' + value), '',
    'The JSON companion pins concrete evidence, actual test titles and case boundaries. This mapping is LOW same-lineage review, not human/different-vendor approval.', ''].join('\n');
fs.writeFileSync(own('F31b-case-map-01.json'), json, { flag: 'wx' });
fs.writeFileSync(own('F31b-case-map-01.md'), md, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, caseCount: 18, uniquePackageControlReferences: controls.length,
    featureComplete: false, nativeRootAcceptancePresent: typeof native.rootAcceptance !== 'string', json: fact(own('F31b-case-map-01.json')), markdown: fact(own('F31b-case-map-01.md')) }));
