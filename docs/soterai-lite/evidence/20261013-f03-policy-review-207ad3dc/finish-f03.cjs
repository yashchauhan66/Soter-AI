const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), base = path.relative(repo, __dirname).replaceAll('\\', '/');
const abs = name => path.resolve(repo, name);
const read = name => JSON.parse(fs.readFileSync(abs(name), 'utf8').replace(/^\uFEFF/, ''));
const sha = name => crypto.createHash('sha256').update(fs.readFileSync(abs(name))).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [nativeName, functionalName, securityName] = process.argv.slice(2);
assert.match(nativeName ?? '', /^current-native-d-host-[\dTZ]+-[a-f0-9]{8}$/);
assert.match(functionalName ?? '', /^privacy-[\dTZ]+-[a-f0-9]{8}$/);
assert.match(securityName ?? '', /^host-[\dTZ]+-[a-f0-9]{32}$/);
const artifact = 'packages/soterai-lite/soterai-lite-0.7.0-f03-20261014-attempt02.vsix';
const inspection = read(base + '/vsix-inspection-02.json'), runtime = inspection.entries.find(row => row.path === 'extension/dist/extension.js').sha256;
assert.equal(sha(artifact), inspection.sha256); assert.equal(inspection.entryCount, 14); assert.equal(inspection.runtimeCount, 3); assert.equal(inspection.forbiddenRuntimeInputs, 0);
const catalog = 'docs/soterai-lite/LITE-CATALOG.json';
assert.equal(sha(catalog), '1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4');
const checks = ['refresh-after-01.txt', 'focused-after-05.txt', 'full-tests-06.txt', 'typecheck-06.txt', 'package-02.txt', 'vsix-inspection-02.txt', 'host-build-03.txt', 'native-host-launch-05.txt', 'functional-launch-01.txt', 'security-launch-01.txt', 'downgrade-check-01.txt'];
for (const name of checks) { const result = read(base + '/' + name + '.result.json'); assert.equal(result.exitCode, 0, name); assert.equal(sha(base + '/' + name), result.sha256.toLowerCase(), name); }
const tap = name => {
  const text = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const count = key => Number(text.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1]);
  return { tests: count('tests'), suites: count('suites'), pass: count('pass'), fail: count('fail'), cancelled: count('cancelled'), skip: count('skipped') };
};
const full = tap('full-tests-06.txt'), focused = tap('focused-after-05.txt');
assert.deepEqual(full, { tests: 919, suites: 106, pass: 916, fail: 0, cancelled: 0, skip: 3 });
assert.equal(focused.tests, 65); assert.equal(focused.pass, 65); assert.equal(focused.fail, 0); assert.equal(focused.skip, 0);
const saved = read(base + '/' + nativeName + '/save-results.json'), reload = read(base + '/' + nativeName + '/reload-results.json'), freeze = read(base + '/' + nativeName + '/freeze.json');
for (const phase of [saved, reload]) { assert.equal(phase.failed, 0); assert.equal(phase.extensionBundleSha256, runtime); assert.equal(phase.currentDeveloperBundleSha256, runtime); assert.equal(phase.hostVersion, '1.141.1'); }
assert.equal(saved.passed, 8); assert.equal(reload.passed, 2); assert.equal(saved.policyDriftFlagRetainedForRestart, true);
assert.equal(saved.workspace, reload.workspace); assert.equal(saved.declaredProfilePath, reload.declaredProfilePath);
const ids = [...new Set([...saved.observations, ...reload.observations].map(row => { assert.equal(row.status, 'PASS'); return row.id; }))].sort();
assert.deepEqual(ids, Array.from({ length: 10 }, (_, index) => 'F03-H' + String(index + 1).padStart(2, '0')));
assert.equal(sha(freeze.codeExecutablePath ?? 'C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/Code.exe'), freeze.codeExecutableSha256);
const storage = path.join(saved.declaredProfilePath, 'User/workspaceStorage');
const databases = fs.readdirSync(storage).flatMap(dir => { const file = path.join(storage, dir, 'state.vscdb'); return fs.existsSync(file) ? [{ path: file, bytes: fs.statSync(file).size }] : []; });
assert.ok(databases.some(item => item.bytes > 0));
const functionalPath = base + '/functional/' + functionalName + '/functional-results.json', functional = read(functionalPath);
assert.equal(functional.passed, 10); assert.equal(functional.failed, 0); assert.equal(functional.extensionBundleSha256, runtime);
const securityPath = base + '/security/' + securityName + '/live-host.json', security = read(securityPath);
assert.equal(security.extensionBundleSha256, runtime); assert.equal(security.results.length, 17);
const baselinePath = 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-security/host-20261013T073045Z-3f95ffdd8e194667b6dba9be6f7c7335/live-host.json', baseline = read(baselinePath);
const rows = security.results.map(row => { const old = baseline.results.find(item => item.attack === row.attack); assert.ok(old); return { scenario: row.attack, baseline: old.status, current: row.status, unchanged: old.status === row.status }; });
assert.ok(rows.every(row => row.unchanged));
const blocked = security.results.filter(row => row.status === 'BLOCKED_SCOPED').length, leaks = security.results.filter(row => row.status === 'LEAK_CONFIRMED').length;
assert.equal(blocked, 8); assert.equal(leaks, 9);
write('security-comparison-01.json', { status: 'PASS_COMPARISON_ONLY', baseline: { path: baselinePath, sha256: sha(baselinePath) }, current: { path: securityPath, sha256: sha(securityPath) }, rows, changes: 0, residual: 'Nine unmanaged leak cases remain; this is not universal prevention.' });
write('native-aggregation-01.json', { status: 'PASS', runtime, hostVersion: '1.141.1', nativeRun: base + '/' + nativeName, distinctPassIds: ids, persistentDatabaseMetadataOnly: databases, independence: 'LOW', limitation: 'Scripted real command decisions and test-only bootstrap in persistent isolated developer window; not clean-profile VSIX installation or independent owner-presence proof.' });
const externalEvidence = [];
// Retain byte-identical copies of failed D phase result receipts in new C names.
// No profile or SQLite contents are read, and no evidence is moved or deleted.
for (const entry of fs.readdirSync(__dirname, { withFileTypes: true }).filter(item => item.isDirectory() && /^current-native-d-host-/.test(item.name))) {
  const root = path.join('D:/SoterAI-Lite-test-profiles', entry.name);
  if (!fs.existsSync(root)) continue;
  for (const file of fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isFile() && /^(save|reload)-results\.json(?:\.driver-error\.json)?$/.test(item.name))) {
    const source = path.join(root, file.name), target = path.join(__dirname, entry.name, file.name);
    if (fs.existsSync(target)) assert.equal(sha(source), sha(target)); else fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    externalEvidence.push({ path: source, bytes: fs.statSync(source).size, sha256: sha(source), retainedCopy: path.relative(repo, target).replaceAll('\\', '/') });
  }
}
write('external-phase-evidence-01.json', { status: 'PASS_BYTE_IDENTICAL_COPY', entries: externalEvidence, profiles: 'Retained D synthetic profiles; profile/SQLite contents excluded.' });
write('f03-acceptance-01.json', { status: 'PASS', feature: 'F03', completion: 'Local acceptance passed; scoped local commit and committed byte verification remain the serial barrier.', observedAt: new Date().toISOString(),
  artifact: { path: artifact, bytes: fs.statSync(abs(artifact)).size, sha256: sha(artifact), runtimeSha256: runtime, manifestSha256: inspection.entries.find(row => row.path === 'extension/package.json').sha256 },
  flag: { name: 'soterai.lite.policyDrift', scope: 'machine', mutation: 'AVAILABILITY_ONLY; no STRONG catalog promotion', rollback: 'No new session reviews; active grants revoked; permanent denies and sensitive masks retained.' },
  checks: { focused, full, nativeDistinct: 10, functional: { path: functionalPath, pass: 10, fail: 0 }, security: { path: securityPath, count: 17, blockedScoped: blocked, leakConfirmed: leaks, comparisonChanges: 0 }, downgrade: read(base + '/downgrade-result-01.json') },
  contract: { lifetime: 'This editor session; restart/drift/flagoff restore deny', permanentRemoval: false, sensitiveRawAccess: false, protectedRegions: 'Retained', cooldownMilliseconds: 10000, expiryMilliseconds: 60000, auditMaximumRecords: 64, auditMaximumBytes: 32768, envelopeMaximumBytes: 131072 },
  sourceReview: 'LOW; source-review-01.md and source-review-02.md; no remaining narrow blocker.',
  catalog: { path: catalog, sha256: sha(catalog), status: '44 frozen checks UNVERIFIED' }, rating: 'PENDING', cleanProfileInstall: 'NOT-RUN/F32',
  retainedFailures: 'Test-first baselines and S27/S28/S29/RF01-RF04; resource-limited full suite/typecheck; updater-blocked current host; renderer OOM with cause unverified; native fixture enrollment/source-drift failures. Earlier passes belong to earlier objects.',
  residual: 'Native same-user original/buffer/alias/environment/history reads and independent uploads remain unmanaged; actual tool, platform, human and independent gates pending.' });
const queuePath = abs('docs/soterai-lite/FEATURE-QUEUE.json'), queue = read('docs/soterai-lite/FEATURE-QUEUE.json');
assert.equal(queue.activeFeature, 'F03'); queue.scope = 'F01/F02 DONE; F03 scoped acceptance PASS with65focused/919fulltests916PASS0FAIL3SKIP/currentCode1.141.1 native10PASS/functional10/17-case unchanged. F03 commit and byte verification pending; no F04 production.';
queue.preparations.find(item => item.id === 'P01').scope = 'Git connectivity-only PASS; supplemental full fsck ended resource-limited FAIL, full object integrity UNVERIFIED.';
fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n');
fs.appendFileSync(abs('docs/soterai-lite/ledger.md'), '\n## STEP RECEIPT F03 — deliberate session review and drift\n\nLocal scoped acceptance PASS; local commit/byte verification remains the serial barrier. Native UI metadata diff, exact typed challenge, real10s cooldown,60s expiry, strict atomic bounded v3 audit, cancellation/write-fault/flagoff/source-drift/restart checks retain every permanent deny. Ordinary manual selectors may relax only this editor session; sensitive reviews still withhold default context and require separately approved value-masked reads. Default/imported/team denies and protected text remain. Confirmation is labelled not agent-proof. Invalid-root transition notifications invalidate owned views once per invalid interval and rearm after valid recovery; all invalid reads remain withheld.\n\nExact command/argv/exit/logSHA records: focused-after-05.txt.result.json65PASS; full-tests-06.txt.result.json919tests/106suites916PASS0FAIL0cancel3SKIP; typecheck-06/package-02/vsix-inspection-02/host-build-03/native-host-launch-05/functional-launch-01/security-launch-01/downgrade-check-01 matching result receipts. Historical failures and skips retained; no earlier result reassigned. Final VSIX ' + artifact + ' ' + fs.statSync(abs(artifact)).size + 'bytes SHA256' + sha(artifact) + ', runtimeSHA256' + runtime + '. Inspection14entries/3runtimes/0forbiddeninputs.\n\nCurrentCode1.141.1 native10distinctH01-H10 PASS on same profile/workspace/runtime, save-phase grant remained live until owned window close and deny restored on actual restart; SQLite file metadata only. Native test-only bootstrap delegates byte-identical packaged runtime, scripted UI LOW independence, not clean-profile installed VSIX or independent presence proof. Functional10PASS; existing17-case SecurityReview8BLOCKED_SCOPED/9LEAK_CONFIRMED;17comparisonrows0changes. Previous exact F02 schema-aware reader v2controlACCEPTED/v3REJECTED. Source review LOW no remaining narrow blocker. Flag withdrawal AVAILABILITY_ONLY;44frozenchecksUNVERIFIED, ratingPENDING.\n\nHashes/explicit source/raw allowlist in f03-evidence-index-01.json; external D result hashes/byte-identical C copies in external-phase-evidence-01.json. Existing profiles/artifacts/logs retained. Earlier renderer OOM cause UNVERIFIED; full fsck resource-limited FAIL and full integrityUNVERIFIED, scoped connectivityPASS unchanged. User20GBwaiver remains; bothverifiedbackupsD:. What remains unprotected: nine unmanaged leaks, actual-agent routes, human/independent/platform gates. Next: scoped F03 commit and byte verification; only then activate F04 exact one-time safe-read consent.\n');
const sources = ['docs/soterai-lite/FEATURE-QUEUE.json', 'docs/soterai-lite/ledger.md', 'docs/vscode-extension-readiness.md', 'packages/soterai-lite/CHANGELOG.md', 'packages/soterai-lite/README.md', 'packages/soterai-lite/package.json', 'packages/vscode-extension/README.md', 'packages/vscode-extension/package.json',
  ...['ai-boundary.test.ts', 'sensitive-policy.test.ts', 'lite-owner-review-protocol.test.ts', 'lite-owner-policy-session.test.ts', 'lite-policy-drift.test.ts', 'lite-owner-policy-refresh.test.ts', 'host/liteOwnerReview.host.ts'].map(name => 'packages/vscode-extension/src/__tests__/' + name),
  ...['BoundarySnapshot.ts', 'VersionedPolicy.ts', 'commands.ts', 'OwnerReviewProtocol.ts', 'PolicyDrift.ts'].map(name => 'packages/vscode-extension/src/ai-boundary/' + name), 'packages/vscode-extension/src/project-privacy/commands.ts'];
const reports = fs.readdirSync(__dirname, { withFileTypes: true }).filter(item => item.isFile()).map(item => base + '/' + item.name);
for (const entry of fs.readdirSync(__dirname, { withFileTypes: true }).filter(item => item.isDirectory() && /^(?:current-native(?:-d)?-host|compat-native-host|native-host)-/.test(item.name))) {
  for (const file of fs.readdirSync(path.join(__dirname, entry.name), { withFileTypes: true })) if (file.isFile() && /\.(json|txt)$/.test(file.name)) reports.push(base + '/' + entry.name + '/' + file.name);
}
for (const family of ['functional', 'security']) for (const run of fs.readdirSync(path.join(__dirname, family), { withFileTypes: true }).filter(item => item.isDirectory())) for (const file of fs.readdirSync(path.join(__dirname, family, run.name), { withFileTypes: true })) if (file.isFile() && /\.(json|txt)$/.test(file.name)) reports.push(base + '/' + family + '/' + run.name + '/' + file.name);
reports.push('docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/git-fsck-01.txt');
const entries = [...new Set([...sources, ...reports])].sort().map(name => ({ path: name, bytes: fs.statSync(abs(name)).size, sha256: sha(name) }));
write('f03-evidence-index-01.json', { schemaVersion: 1, scope: 'Explicit F03 source/raw evidence allowlist; copied runtime trees, profiles, SQLite contents, synthetic workspaces and unrelated changes excluded.', entries });
fs.writeFileSync(path.join(__dirname, 'f03-commit-allowlist-01.txt'), [...entries.map(item => item.path), base + '/f03-evidence-index-01.json'].join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PASS', indexedEntries: entries.length, full, focusedTests: focused.tests, nativeDistinct: ids.length, artifactSha256: sha(artifact), runtime, securityChanges: 0, commit: 'PENDING' }));
