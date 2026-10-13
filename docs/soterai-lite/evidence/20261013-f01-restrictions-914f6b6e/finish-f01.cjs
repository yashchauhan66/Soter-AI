const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const dir = __dirname;
const repo = path.resolve(dir, '../../../..');
const rel = name => path.relative(repo, path.join(dir, name)).replaceAll('\\', '/');
const read = filename => JSON.parse(fs.readFileSync(path.resolve(repo, filename), 'utf8').replace(/^\uFEFF/, ''));
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(repo, filename))).digest('hex');
const write = (filename, value) => fs.writeFileSync(path.join(dir, filename), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const base = 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-security/host-20261013T073045Z-3f95ffdd8e194667b6dba9be6f7c7335/live-host.json';
const current = rel('security/host-20261013T141428Z-7c4b1b1878914698a6c31730ac8c298b/live-host.json');
const old = read(base), now = read(current);
assert.equal(old.results.length, 17); assert.equal(now.results.length, 17);
const comparison = now.results.map(row => {
    const prior = old.results.find(item => item.attack === row.attack);
    assert.ok(prior);
    return { attack: row.attack, previous: prior.status, current: row.status, unchanged: prior.status === row.status };
});
assert.ok(comparison.every(row => row.unchanged));
write('security-comparison-01.json', { status: 'PASS', scope: 'Comparison only; nine unmanaged leaks remain confirmed.', baseline: { path: base, sha256: hash(base) }, current: { path: current, sha256: hash(current) }, rows: comparison, changed: 0 });
const native = 'native-host-20261013T140805Z-90f83793/';
const save = read(rel(native + 'save-results.json')), reload = read(rel(native + 'reload-results.json'));
assert.equal(save.failed, 0); assert.equal(reload.failed, 0);
assert.equal(save.workspace, reload.workspace); assert.equal(save.declaredProfilePath, reload.declaredProfilePath);
assert.equal(save.extensionBundleSha256, reload.extensionBundleSha256);
const hostIds = [...new Set([...save.observations, ...reload.observations].filter(item => item.status === 'PASS').map(item => item.id))];
assert.equal(hostIds.length, 5);
const storageRoot = path.join(dir, native, 'profile/User/workspaceStorage');
const databases = fs.readdirSync(storageRoot).flatMap(name => {
    const filename = path.join(storageRoot, name, 'state.vscdb');
    return fs.existsSync(filename) ? [{ path: rel(path.relative(dir, filename)), bytes: fs.statSync(filename).size }] : [];
});
assert.ok(databases.length > 0);
write('native-host-aggregation-01.json', { status: 'PASS', distinctChecks: hostIds, distinctPassCount: 5, savePassObservations: save.passed, reloadPassObservations: reload.passed, persistentStorageMetadataOnly: databases, runtimeSha256: save.extensionBundleSha256, scope: 'Normal isolated developer window; test-only bootstrap delegates unchanged packaged runtime. Scripted UI, LOW independence. Raw installed-bundle field means loaded developer fixture bytes, not clean-profile installed VSIX or authenticated in-memory identity.' });
const functional = rel('functional/privacy-20261013T141221Z-e2b0d1c7/functional-results.json');
const f = read(functional);
assert.equal(f.failed, 0);
const artifact = 'packages/soterai-lite/soterai-lite-0.7.0-f01-20261013-attempt02.vsix';
assert.equal(hash(artifact), '67476e3e1aa4e18b2266a5a206dbd2c3be9961c25611e5f8416de7c61c7f99d8');
const catalog = 'docs/soterai-lite/LITE-CATALOG.json';
assert.equal(hash(catalog), '1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4');
for (const name of ['focused-after-06.txt', 'full-tests-03.txt', 'typecheck-04.txt', 'package-02.txt', 'native-host-launch-01.txt', 'functional-launch-01.txt', 'security-launch-01.txt']) {
    const receipt = read(rel(name + '.result.json'));
    assert.equal(receipt.exitCode, 0, name);
}
write('f01-acceptance-01.json', {
    status: 'PASS', feature: 'F01', completion: 'Local checks complete; scoped commit and byte verification remain the serial barrier.',
    observedAt: new Date().toISOString(), catalog: { path: catalog, sha256: hash(catalog), coverageStatus: 'All 44 frozen definitions remain UNVERIFIED; no catalog promotion by this feature.' },
    artifact: { path: artifact, bytes: fs.statSync(path.join(repo, artifact)).size, sha256: hash(artifact), runtimeSha256: save.extensionBundleSha256, archiveEntries: 14 },
    checks: { focused: { tests: 35, pass: 35, fail: 0, skip: 0 }, full: { tests: 816, suites: 106, pass: 813, fail: 0, skip: 3 }, nativeDistinct: 5, functional: { path: functional, pass: 10, fail: 0 }, security: { path: current, checks: 17, blockedScoped: 8, leakConfirmed: 9, comparisonChanges: 0 } },
    mutation: { flag: 'soterai.lite.restrictionSave', scope: 'machine', result: 'AVAILABILITY_ONLY', safeWithdrawal: 'New manual saves return UNAVAILABLE. Existing denies and masking remain enforced; unrelated public controls remain usable.' },
    negativeEvidence: ['16-fail test-first baseline', '3-fail workspace-drift baseline', 'Earlier focused/full/host failures and disk-full unexecuted actions retained', 'Extension-test mode uses in-memory storage; native two-launch persistent storage check retained separately', 'H02 is missing-file failure, not host storage fault injection; unit tests exercise rejecting Memento updates'],
    independence: 'LOW', cleanProfileInstall: 'NOT-RUN; F32 remains planned', rating: 'PENDING',
    residual: 'Nine unmanaged baseline leaks remain; native same-user reads, original buffers, aliases, inherited environment, Git history and independent egress are not prevented by F01.'
});
const ledger = path.join(repo, 'docs/soterai-lite/ledger.md');
fs.appendFileSync(ledger, '\n## STEP RECEIPT F01 — reliable saved restrictions\n\nResult **PASS** for local F01 behavior/tests/artifact/affected hosts; serial barrier remains the scoped local commit plus byte verification. Restriction saves await persistent success; typed FAILED/CANCELLED/UNAVAILABLE never acknowledge SAVED. Machine-scope flag soterai.lite.restrictionSave withdraws new saves without weakening retained denies. Scoped overlapping pending saves temporarily withhold affected reads, preserve unrelated public reads, revoke approvals/views, and validate original workspace ownership before queued persistence and before saved acknowledgement. Already committed stronger records remain on post-write drift.\n\nExact commands, argv, times, exits and log hashes: focused-after-06.txt.result.json (35PASS/0FAIL); full-tests-03.txt.result.json (816tests/106suites,813PASS/0FAIL/3SKIP); typecheck-04.txt.result.json; package-02.txt.result.json; native-host-launch-01.txt.result.json; functional-launch-01.txt.result.json; security-launch-01.txt.result.json, all in evidence/20261013-f01-restrictions-914f6b6e/. Earlier failures/skips and disk-full unexecuted actions remain immutable. Full-suite corrections retained the public-read control and restored the README original UTF-8 bytes; assertions were not removed.\n\nNew exact VSIX packages/soterai-lite/soterai-lite-0.7.0-f01-20261013-attempt02.vsix,1324828bytes,SHA25667476e3e1aa4e18b2266a5a206dbd2c3be9961c25611e5f8416de7c61c7f99d8; runtime8f6fabef2c79239d09c8cf4795c5d435420305abb8c6355cdfd40071fc9ed38e. Archive14entries, no Full/test/evidence inputs. Native normal isolated developer window save/restart: five distinct H01-H05 PASS, same profile/workspace/runtime, actual persistent SQLite file metadata observed without reading database contents. Test-only bootstrap delegates unchanged packaged runtime; scripted UI is LOW independence. Raw installed-bundle label denotes loaded developer fixture bytes, not clean-profile installed VSIX/authenticated memory. Standard extensionTestsPath uses in-memory storage, verified in installed source and official VS Code source; earlier restart failures remain recorded and are not counted PASS. Clean-profile installation remains F32 NOT-RUN.\n\nAffected functional10PASS/0FAIL; existing SecurityReview17cases8BLOCKED_SCOPED/9LEAK_CONFIRMED, comparison17rows/0changes. security-comparison-01.json and native-host-aggregation-01.json retain exact identities. Flag-off evidence AVAILABILITY_ONLY, not prevention-sensitive mutation; frozen catalog44checks remain UNVERIFIED and no numerical rating is assigned. Same-lineage source adversarial review found no remaining F01 blocker; independenceLOW.\n\nFiles changed and SHA-256 are in f01-evidence-index-01.json, with explicit raw/source allowlist. Older artifact/test attempts remain. Both verified backup pair files now D:/SoterAI-backups; only explicitly authorized verified C: duplicates were removed,20GB remainsWAIVED. Supplemental full fsck still RUNNING/INCOMPLETE; connectivity PASS remains scoped.\n\nWhat remains unprotected: all nine unmanaged baseline leaks, native same-user original reads/buffers/aliases/env/history/independent uploads, untested actual-tool routes and human acceptance. Next: commit and verify F01 bytes; only then activate F02 versioned policy/defaults test-first.\n', 'utf8');
const sources = [
    'docs/soterai-lite/FEATURE-QUEUE.json', 'docs/soterai-lite/inputs.json', 'docs/soterai-lite/ledger.md', 'docs/vscode-extension-readiness.md',
    'packages/soterai-lite/CHANGELOG.md', 'packages/soterai-lite/README.md', 'packages/soterai-lite/package.json',
    'packages/vscode-extension/README.md', 'packages/vscode-extension/package.json',
    'packages/vscode-extension/src/ai-boundary/commands.ts', 'packages/vscode-extension/src/ai-boundary/RestrictionOperation.ts',
    'packages/vscode-extension/src/project-privacy/commands.ts', 'packages/vscode-extension/src/__tests__/lite-restriction-save.test.ts',
    'packages/vscode-extension/src/__tests__/host/liteRestrictionSave.host.ts'
];
const reports = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => rel(entry.name));
for (const subdir of ['host-20261013T134751Z-679e8e81', 'host-20261013T135828Z-a838967e', native.replace(/\/$/, ''), 'functional/privacy-20261013T141221Z-e2b0d1c7', 'security/host-20261013T141428Z-7c4b1b1878914698a6c31730ac8c298b']) {
    for (const entry of fs.readdirSync(path.join(dir, subdir), { withFileTypes: true })) {
        if (entry.isFile() && /\.(json|txt)$/.test(entry.name)) reports.push(rel(subdir + '/' + entry.name));
    }
}
reports.push('docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p00-p03-committed-byte-verification.json');
const entries = [...new Set([...sources, ...reports])].sort().map(filename => ({ path: filename, bytes: fs.statSync(path.join(repo, filename)).size, sha256: hash(filename) }));
write('f01-evidence-index-01.json', { schemaVersion: 1, scope: 'F01 explicit source/raw reports only; profiles, synthetic workspaces, database contents, copied runtime trees and unknown prior artifacts excluded.', entries });
fs.writeFileSync(path.join(dir, 'f01-commit-allowlist-01.txt'), [...entries.map(entry => entry.path), rel('f01-evidence-index-01.json')].join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PASS', entries: entries.length, distinctHostChecks: hostIds.length, securityComparisonChanges: 0, commit: 'PENDING' }));
