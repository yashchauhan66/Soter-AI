'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
function verifyMatrix(result, route) {
 assert.equal(result.status, route.expectedStatus); assert.equal(result.checks.length, route.count); assert(result.checks.every(row => row.status === 'PASS')); assert.equal(new Set(result.checks.map(row => row.id)).size, route.count);
 if (route.expectedIds) assert.deepEqual(result.checks.map(row => row.id).sort(), [...route.expectedIds].sort());
 for (const key of ['driverFailure', 'providerFailure', 'privateOriginalLeak', 'privateFileChanged', 'ownedHookChanged', 'stopFailure']) assert(!result[key], key);
 assert(!result.brokerShutdown || result.brokerShutdown !== 'UNCONFIRMED'); assert(!result.childShutdown || result.childShutdown === 'CONFIRMED');
 for (const key of ['deniedExternal', 'deniedSignals', 'deniedChildLaunches', 'deniedDirectSpawns']) {
  assert(Array.isArray(result[key]), key);
  if (route.id !== 'cline' || key === 'deniedExternal' || key === 'deniedDirectSpawns') assert.equal(result[key].length, 0, key);
 }
 if (route.id === 'cline') assert(result.deniedSignals.every(value => ['ZERO_SIGNAL_LIVENESS_REFUSED', 'PROCESS_SIGNAL_REFUSED', 'CHILD_SIGNAL_REFUSED'].includes(value)));
 assert(Array.isArray(result.children) && result.children.length > 0); for (const child of result.children) assert(child.closed && child.stdoutEOF && child.stderrEOF);
 for (const child of result.native || []) assert(child.closed && child.stdoutEOF && child.stderrEOF && !child.timeout && !child.deadline && !child.launchFailure);
 if (route.id !== 'gemini') assert.equal(result.runtimeSha256, route.frontendSha256);
 return { checks: result.checks, limitations: result.limits || result.limitations || [], fixtureRefusals: { external: result.deniedExternal.length, signals: result.deniedSignals.length, signalReasons: [...new Set(result.deniedSignals)], childLaunches: result.deniedChildLaunches.length, directSpawns: result.deniedDirectSpawns.length, fileAccesses: result.deniedFileAccess?.length || 0 }, uncovered: 'Explicit override, unmanaged routes, vendor webview where excluded, and real-provider behavior are not certified by this scripted loopback matrix. Refused fixture operations were blocked by the unchanged test guard; they are not proof of product OS confinement.' };
}
async function run() {
 const C = require('./route-admission.cjs'), { own, repo, read, fact, pin, sha } = C, { route: r, candidate: b } = C.validate();
 const put = (name, value) => fs.writeFileSync(own(name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
 assert(!fs.existsSync(own('consumption.json')), 'Attempt already retained; prepare a fresh successor');
 const { phase } = require(pin(r.ownedHelper)); put('consumption.json', { status: 'CURRENT_ROUTE_SINGLE_ATTEMPT_STARTED', time: new Date().toISOString(), binding: fact(own('route-binding.json')), owner: r.owner, signalsRequested: 0 });
 const before = new Set(fs.readdirSync(__dirname, { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name));
 const result = await phase({ executable: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', pin(r.wrapper)], cwd: repo, env: process.env, run: __dirname, name: 'route', profile: 'CURRENT_V01_' + r.id.toUpperCase() + '_SYNTHETIC', deadlineMs: 1200000 });
 assert.equal(result.closed.code, 0); assert.equal(result.closed.signal, null); assert(!result.deadline && !result.error && !result.overflow && result.close.stdoutEOF && result.close.stderrEOF);
 const directories = fs.readdirSync(__dirname, { withFileTypes: true }).filter(row => row.isDirectory() && !before.has(row.name)).map(row => own(row.name)); assert.equal(directories.length, 1); const dir = directories[0];
 for (const name of ['owned-editor-close.json', 'helper-pipe-ownership.json']) { const close = read(path.join(dir, name)); assert(close.observedExit && close.exitCode === 0 && close.stdoutEOF && close.stderrEOF && close.signalsRequested === 0); if (name.startsWith('helper')) assert.equal(close.status, 'ACTUAL_CLOSE_AND_BOTH_EOF_BEFORE_DISPOSE'); }
 const freeze = read(path.join(dir, 'freeze.json')); assert.equal(freeze.vsixSha256, b.vsix.sha256); assert.equal(freeze.codeSha256, b.code.sha256); assert.equal(freeze.driverSha256, r.driver.sha256); assert.equal(freeze.guardSha256, r.guard.sha256); assert.equal(freeze.runtimeBindings.length, 4);
 for (const row of freeze.runtimeBindings) { const expected = b.runtimes.find(runtime => path.basename(runtime.path) === path.basename(row.path)); assert(expected); assert.equal(row.sha256, expected.sha256); pin({ path: row.path, bytes: expected.bytes, sha256: expected.sha256 }); }
 const actual = read(path.join(dir, 'product-result.json')); assert.equal(sha(fs.readFileSync(path.join(dir, 'product-result.json'))), sha(fs.readFileSync(path.join(freeze.executionRoot, 'product-result.json'))));
 const matrix = verifyMatrix(actual, r); C.validate(); let hook;
 if (r.hook) {
  const hookOutput = own('generated-hook-current.json'); const execution = await phase({ executable: 'C:\\Program Files\\nodejs\\node.exe', args: ['--import', 'tsx', pin(r.hook.driver), hookOutput], cwd: repo, env: process.env, run: __dirname, name: 'hook', profile: 'CURRENT_V01_CLINE_GENERATED_HOOK', deadlineMs: 180000 });
  assert.equal(execution.closed.code, 0); assert.equal(execution.closed.signal, null); assert(!execution.deadline && !execution.error && !execution.overflow && execution.close.stdoutEOF && execution.close.stderrEOF);
  const value = read(hookOutput); assert.equal(value.status, 'PASS_SCOPED_GENERATED_HOOK'); assert.equal(value.vsixSha256, b.vsix.sha256); assert.equal(value.rows.length, 4); assert.deepEqual(value.rows.map(row => row.id), ['ready', 'public', 'restricted', 'revoked']); assert(value.rows.every(row => row.status === 'PASS' && row.code === 0 && row.outEOF && row.errEOF)); hook = { checks: 4, evidence: fact(hookOutput), scope: r.hook.scope };
 }
 C.validate(); const report = { status: 'PASS_CURRENT_' + r.id.toUpperCase() + '_SCOPED_LOOPBACK_MATRIX', observedAt: new Date().toISOString(), sourceProof: b.sourceProof, vsix: b.vsix, code: b.code, routeBinding: fact(own('route-binding.json')), vendorUse: r.vendorUse, driver: r.driver, matrix, hook, result: fact(path.join(dir, 'product-result.json')), freeze: fact(path.join(dir, 'freeze.json')), ownedClose: fact(own('route-owned-close.json')), editorClose: fact(path.join(dir, 'owned-editor-close.json')), pipeClose: fact(path.join(dir, 'helper-pipe-ownership.json')), syntheticOnly: true, independentReview: 'LOW', releaseReady: false };
 put('route-acceptance.json', report); console.log(JSON.stringify({ status: report.status, checks: matrix.checks.length, hookChecks: hook?.checks || 0 })); return report;
}
module.exports = { run, verifyMatrix };
if (require.main === module) run().catch(error => { const file = path.join(__dirname, 'route-failure.json'); if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ status: 'FAILED_OR_INCOMPLETE_NO_RESULT_TRANSFER', time: new Date().toISOString(), error: { name: error.name, message: error.message }, signalsRequested: 0 }) + '\n', { flag: 'wx' }); console.error(error); process.exitCode = 1; });
