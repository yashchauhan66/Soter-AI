'use strict';
// Serial exact-candidate affected runs. Each retained helper owns its isolated Code window.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
async function run() {
 const C = require('./v01-admission.cjs'), { repo, own, read, sha, fact } = C;
 const b = C.binding(), put = (name, value) => fs.writeFileSync(own(name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
 assert(!fs.existsSync(own('run-consumption.json')), 'Existing attempt retained; use a fresh prepared successor');
 const phaseFile = path.join(repo, 'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
 assert.equal(sha(fs.readFileSync(phaseFile)), 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
 const { phase } = require(phaseFile), results = [], ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
 const prefix = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];
 const artifact = ['-VsixPath', path.resolve(repo, b.vsix.path), '-ExpectedVsixSha256', b.vsix.sha256, '-ExpectedBundleSha256', b.frontendSha256];
 put('run-consumption.json', { status: 'CURRENT_V01_AFFECTED_SINGLE_SERIAL_ATTEMPT', observedAt: new Date().toISOString(), binding: fact(own('binding.json')), owner: b.owner, signalsRequested: 0 });
 async function step(name, args) {
  C.binding(); const before = new Set(fs.readdirSync(__dirname, { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name));
  const r = await phase({ executable: ps, args, cwd: repo, env: process.env, run: __dirname, name, profile: 'CURRENT_V01_SYNTHETIC_AFFECTED', deadlineMs: 1800000 });
  const result = { name, status: r.closed.code === 0 && r.closed.signal === null && !r.deadline && !r.error && !r.overflow && r.close.stdoutEOF && r.close.stderrEOF ? 'CLOSED_ZERO_VERIFY_ASSERTIONS' : 'FAILED_OR_INCOMPLETE', observedAt: new Date().toISOString(), directories: fs.readdirSync(__dirname, { withFileTypes: true }).filter(row => row.isDirectory() && !before.has(row.name)).map(row => row.name), close: fact(own(name + '-owned-close.json')), signalsRequested: 0 };
  put(name + '-result.json', result); results.push(result); console.log(JSON.stringify(result)); assert.equal(result.status, 'CLOSED_ZERO_VERIFY_ASSERTIONS'); C.binding();
 }
 try {
  for (const family of b.families) await step('affected-' + family.id, [...prefix, '-File', path.resolve(repo, family.helper.path), '-CodePath', path.resolve(repo, b.code.path), '-HostTestsPath', path.resolve(repo, family.driver.path), '-ExtensionRoot', path.resolve(repo, b.extractedRoot), ...artifact]);
  await step('affected-functional-security', [...prefix, '-File', own('affected-functional-security-05.ps1'), '-CodePath', path.resolve(repo, b.code.path), ...artifact, '-InspectionName', '01']);
  put('run-result.json', { status: 'ALL_FIVE_WRAPPERS_CLOSED_ASSERTION_VERIFICATION_PENDING', observedAt: new Date().toISOString(), results, binding: fact(own('binding.json')), releaseReady: false });
 } catch (error) { put('run-failure.json', { status: 'FAILED_OR_INCOMPLETE_EVIDENCE_RETAINED', observedAt: new Date().toISOString(), results, error: { name: error.name, message: error.message }, releaseReady: false }); throw error; }
}
module.exports = { run };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
