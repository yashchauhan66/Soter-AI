'use strict';
// Actual new results, exact runtime identities and natural closure are all required.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
function verifySecurity(security, baseline, expectedBundle) {
 assert.equal(security.extensionBundleSha256, expectedBundle); assert.equal(security.results.length, 17); assert.equal(baseline.rows.length, 17);
 assert.equal(new Set(baseline.rows.map(row => row.attack)).size, 17); assert.equal(new Set(security.results.map(row => row.attack)).size, 17);
 const rows = baseline.rows.map(prior => {
  const current = security.results.find(row => row.attack === prior.attack); assert(current, prior.attack);
  assert.equal(current.status, prior.current, 'Baseline changed; inspect retained result: ' + prior.attack);
  return { attack: prior.attack, historical: prior.current, current: current.status, remainingUnmanagedLeak: current.status === 'LEAK_CONFIRMED' };
 });
 const residuals = rows.reduce((counts, row) => (counts[row.current] = (counts[row.current] || 0) + 1, counts), {});
 assert.deepEqual(residuals, { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 });
 return { cases: 17, changed: 0, residuals, rows, limitation: 'Nine unmanaged paths still leak; eight scoped blocks do not establish universal protection.' };
}
function verify() {
 const C = require('./v01-admission.cjs'), { repo, own, read, fact, sha, pin } = C, b = C.binding(), evidence = new Map();
 const take = file => { const row = fact(file); pin(row); evidence.set(row.path, row); return row; };
 const rootResult = read(own('run-result.json')); assert.equal(rootResult.status, 'ALL_FIVE_WRAPPERS_CLOSED_ASSERTION_VERIFICATION_PENDING');
 assert.deepEqual(rootResult.results.map(row => row.name), ['affected-ps51', 'affected-editor', 'affected-mcp', 'affected-retained', 'affected-functional-security']);
 function close(file, pipe = false) {
  const row = read(file); for (const [key, value] of Object.entries({ observedExit: true, exitCode: 0, stdoutEOF: true, stderrEOF: true, signalsRequested: 0 })) assert.equal(row[key], value, file + ':' + key);
  if (pipe) assert.equal(row.status, 'ACTUAL_CLOSE_AND_BOTH_EOF_BEFORE_DISPOSE'); take(file);
 }
 function wrapper(name) {
  const result = read(own(name + '-result.json')), closed = read(own(name + '-owned-close.json')); assert.equal(result.status, 'CLOSED_ZERO_VERIFY_ASSERTIONS');
  for (const [key, value] of Object.entries({ actualClose: true, exitCode: 0, signal: null, stdoutEOF: true, stderrEOF: true, deadlineExceeded: false, overflow: false, streamError: false, signalsRequested: 0 })) assert.equal(closed[key], value, name + ':' + key);
  assert.deepEqual(closed.streams.map(row => row.name).sort(), ['stderr', 'stdout']);
  for (const stream of closed.streams) { const file = own(name + '-' + stream.name + '.bin'); assert.equal(stream.bytes, stream.observedBytes); pin({ path: file, bytes: stream.bytes, sha256: stream.sha256 }); take(file); }
  take(own(name + '-result.json')); take(own(name + '-owned-close.json')); take(own(name + '-owned-start.json'));
  return result.directories.map(name => { assert.match(name, /^[A-Za-z0-9_-]+$/); const dir = own(name); assert(fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink()); return dir; });
 }
 function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(row => { assert(!row.isSymbolicLink()); const file = path.join(dir, row.name); return row.isDirectory() ? walk(file) : [file]; }); }
 function runtimeSnapshot(freeze) {
  assert.equal(freeze.runtimeBindings.length, 4);
  for (const runtime of freeze.runtimeBindings) { const expected = b.runtimes.find(row => path.basename(row.path) === runtime.name); assert(expected); assert.equal(runtime.bytes, expected.bytes); assert.equal(runtime.sha256, expected.sha256); assert(path.resolve(runtime.execution).toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\')); pin({ path: runtime.execution, bytes: runtime.bytes, sha256: runtime.sha256 }); }
 }
 let nativeChecks = 0, nativePhases = 0; const families = [];
 for (const family of b.families) {
  const matches = wrapper('affected-' + family.id).filter(dir => fs.existsSync(path.join(dir, 'summary.json'))); assert.equal(matches.length, 1, family.id); const dir = matches[0];
  const summary = read(path.join(dir, 'summary.json')), freeze = read(path.join(dir, 'freeze.json'));
  assert.equal(summary.status, 'PASS_SCOPED'); assert.equal(summary.vsixSha256, b.vsix.sha256); assert.equal(summary.extensionBundleSha256, b.frontendSha256); assert.equal(summary.nativeChecks, family.assertions); assert.equal(summary.phases.length, family.phases); assert.deepEqual(summary.phases.map(row => row.phase), ['primary', 'restart']);
  assert.equal(freeze.vsixSha256, b.vsix.sha256); assert.equal(freeze.hostProbeSha256, family.driver.sha256); assert.equal(freeze.codeExecutableSha256, b.code.sha256); runtimeSnapshot(freeze);
  let count = 0; const phases = [];
  for (const phase of summary.phases) {
   const file = path.join(dir, phase.phase + '-results.json'), result = read(file); assert.equal(sha(fs.readFileSync(file)), phase.sha256); assert.equal(result.phase, phase.phase);
   assert.equal(result.failed, 0); assert.equal(result.notRun, 0); assert(!result.driverFailure); assert.equal(result.passed, phase.passed); assert.equal(result.passed, result.observations.length); assert(result.observations.every(row => row.status === 'PASS' && typeof row.id === 'string' && typeof row.scope === 'string' && row.scope.length)); assert.equal(new Set(result.observations.map(row => row.id)).size, result.passed);
   assert.equal(result.hostVersion, b.hostVersion); assert.equal(result.extensionBundleSha256, b.frontendSha256); assert.equal(result.currentDeveloperBundleSha256, b.frontendSha256); assert.equal(result.hostProbeSha256, family.driver.sha256);
   const executionResult = path.resolve(phase.result); assert(executionResult.toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\')); assert.equal(sha(fs.readFileSync(executionResult)), phase.sha256);
   close(path.join(dir, phase.phase + '-owned-editor-close.json')); close(path.join(dir, phase.phase + '-helper-pipe-ownership.json'), true);
   phases.push({ phase: phase.phase, checks: result.passed, result: take(file) }); count += result.passed; nativePhases++;
  }
  assert.equal(count, family.assertions); nativeChecks += count; families.push({ id: family.id, checks: count, phases }); take(path.join(dir, 'summary.json')); take(path.join(dir, 'freeze.json'));
 }
 assert.equal(nativeChecks, 175); assert.equal(nativePhases, 8);
 const functionalMatches = wrapper('affected-functional-security').filter(dir => fs.existsSync(path.join(dir, 'affected-summary-01.json'))); assert.equal(functionalMatches.length, 1); const dir = functionalMatches[0];
 const combined = read(path.join(dir, 'affected-summary-01.json')); assert.equal(combined.status, 'PASS_SCOPED'); assert.equal(combined.vsixSha256, b.vsix.sha256); assert.equal(combined.extensionBundleSha256, b.frontendSha256); assert.equal(combined.functionalPassed, 10); assert.equal(combined.securityCompared, 17); assert.equal(combined.changed, 0);
 for (const file of [combined.functionalResult, combined.securityResult]) assert(path.resolve(file).toLowerCase().startsWith(dir.toLowerCase() + path.sep));
 const functional = read(combined.functionalResult), security = read(combined.securityResult); assert.equal(functional.extensionBundleSha256, b.frontendSha256); assert.equal(functional.passed, 10); assert.equal(functional.failed, 0); assert.equal(functional.observations.length, 10); assert(functional.observations.every(row => row.status === 'PASS')); assert.equal(new Set(functional.observations.map(row => row.id)).size, 10); for (const id of ['H09', 'H10']) assert(functional.observations.some(row => row.id === id && row.status === 'PASS'));
 const securityComparison = verifySecurity(security, read(pin(b.baseline)), b.frontendSha256);
 const comparison = read(path.join(dir, 'security-comparison-01.json')); assert.equal(comparison.status, 'PASS_NO_REGRESSION'); assert.equal(comparison.changed, 0); assert.equal(comparison.comparedRows, 17);
 const nested = walk(dir), closes = nested.filter(file => path.basename(file) === 'owned-editor-close.json'), pipes = nested.filter(file => path.basename(file) === 'helper-pipe-ownership.json'); assert.equal(closes.length, 2); assert.equal(pipes.length, 2); closes.forEach(file => close(file)); pipes.forEach(file => close(file, true));
 for (const file of nested.filter(file => file.endsWith('.txt.result.json'))) { const receipt = read(file); assert.equal(receipt.exitCode, 0); const raw = file.slice(0, -'.result.json'.length); assert.equal(sha(fs.readFileSync(raw)), receipt.sha256.toLowerCase()); take(file); take(raw); }
 for (const file of [combined.functionalResult, combined.securityResult, path.join(dir, 'affected-summary-01.json'), path.join(dir, 'security-comparison-01.json'), own('run-result.json'), own('run-consumption.json'), own('binding.json'), own('preparation.json')]) take(file);
 C.binding();
 const report = { status: 'PASS_CURRENT_AFFECTED175_FUNCTIONAL10_SECURITY17_BASELINE_ONLY', observedAt: new Date().toISOString(), sourceProof: b.sourceProof, vsix: b.vsix, frontendSha256: b.frontendSha256, hostVersion: b.hostVersion, families, nativeChecks, nativePhases, functionalChecks: 10, securityComparison, totalAssertions: 202, toolRoutes: 'NOT_CERTIFIED_BY_THIS_RUN', f26a: b.f26a, independentReview: 'LOW', releaseReady: false, remaining: 'Five real-client mock-provider routes plus remaining full V01/V02 and human/independent gates. Historical nine unmanaged leaks remain explicit.', evidence: [...evidence.values()] };
 fs.writeFileSync(own('affected-acceptance.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); return report;
}
module.exports = { verifySecurity, verify };
if (require.main === module) { try { const report = verify(); console.log(JSON.stringify({ status: report.status, nativeChecks: report.nativeChecks, functionalChecks: report.functionalChecks, security: report.securityComparison.residuals })); } catch (error) { console.error(error); process.exitCode = 1; } }
