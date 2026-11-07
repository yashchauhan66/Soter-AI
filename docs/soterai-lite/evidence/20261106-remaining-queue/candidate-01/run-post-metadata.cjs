'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..'), own = n => path.join(__dirname, n), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const proof = read(own('full-inputs-02.json')), sourceProofSha256 = sha(fs.readFileSync(own('full-inputs-02.json')));
const helper = path.resolve(__dirname, '../../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
assert.equal(sha(fs.readFileSync(helper)), 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const { phase } = require(helper), completed = [];
const verify = () => { for (const row of proof.files) { const raw = fs.readFileSync(path.join(repo, row.path)); assert.equal(raw.length, row.bytes, row.path); assert.equal(sha(raw), row.sha256, row.path); } };
const write = (n, v) => fs.writeFileSync(own(n), JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const keep = setInterval(() => {}, 1000);
(async () => {
 verify();
 const temporary = path.join('D:\\SoterAI-Lite-test-profiles', 'resumed-metadata-' + crypto.randomBytes(6).toString('hex')); fs.mkdirSync(temporary);
 const env = { ...process.env, TEMP: temporary, TMP: temporary };
 async function run(name, args) {
  verify(); const result = await phase({ executable: process.execPath, args, cwd: repo, env, run: __dirname, name, profile: 'METADATA_ONLY_CURRENT_PACKAGE_VERIFICATION', deadlineMs: 1800000 });
  assert.equal(result.closed.code, 0, name); assert.equal(result.closed.signal, null);
  for (const key of ['actualClose', 'stdoutEOF', 'stderrEOF']) assert.equal(result.close[key], true);
  assert(!result.deadline && !result.error && !result.overflow); verify(); completed.push(name);
 }
 await run('compiler-owned-02', [path.join(repo, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', path.join(repo, 'packages/soterai-lite/tsconfig.json')]);
 const tests = ['extension.test.ts', 'manifest-assets.test.ts', 'lifecycle.manifest.test.ts', 'prePushManifest.test.ts', 'protectionCenter.manifest.test.ts', 'setupVerification.manifest.test.ts', 'readiness-doc.test.ts'];
 await run('metadata-components-02', ['--import', 'tsx', '--test', '--test-concurrency=2', ...tests.map(f => path.join(repo, 'packages/vscode-extension/src/__tests__', f))]);
 await run('package-components-02', ['--test', ...['audit-release.test.cjs', 'release-metadata.test.cjs', 'release-package.test.cjs'].map(f => path.join(repo, 'packages/soterai-lite/scripts/__tests__', f))]);
 await run('readiness-02', [path.join(repo, 'packages/vscode-extension/scripts/generate-readiness.mjs'), '--check']);
 const artifact = 'soterai-lite-0.7.0-resumed-20261106-attempt02.vsix';
 await run('package-02', [path.join(repo, 'packages/soterai-lite/scripts/package.cjs'), artifact]);
 const raw = fs.readFileSync(path.join(repo, 'packages/soterai-lite', artifact));
 const full = read(own('full-suite-acceptance-02.json'));
 write('integrated-result-02.json', { status: 'CURRENT_FULL_COMPILER_COMPONENTS_BUILD_PACKAGE_PASS_NATIVE_PENDING', observedAt: new Date().toISOString(), sourceProofSha256, full: full.counts, fullSuiteExecution: full.executionStatus, fileCount: full.fileCount, completed: ['compiler-owned-01', ...full.shards.map(s => s.name), ...completed], freshMetadataChecks: tests, artifact: { path: 'packages/soterai-lite/' + artifact, bytes: raw.length, sha256: sha(raw) }, releaseReady: false, signalsRequested: 0 });
 console.log(JSON.stringify({ status: 'METADATA_COMPILER_PACKAGE_PASS_FULL_IMPLEMENTATION_SUITE_EXPLICITLY_REUSED', artifact, sourceProofSha256 }));
})().catch(error => { write('post-metadata-failure-' + Date.now() + '.json', { completed, error: String(error.stack || error), signalsRequested: 0 }); console.error(error); process.exitCode = 1; }).finally(() => clearInterval(keep));
