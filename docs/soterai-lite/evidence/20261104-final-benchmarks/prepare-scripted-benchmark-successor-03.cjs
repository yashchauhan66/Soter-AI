'use strict';
// Successor: original controls share a line; match the exact field fragment.
// Prior generator02 count guard failed before emitting any driver02 bytes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const originalPath = path.join(__dirname, 'run-scripted-benchmarks-proposed-01.cjs');
const bytes = fs.readFileSync(originalPath);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '7a58609651689921005d2ad30dcaa3f6a7b7dee24a924be3b5bdd68a13d5f107');
let candidate = bytes.toString('utf8');
function once(before, after) { assert.equal(candidate.split(before).length, 2); candidate = candidate.replace(before, () => after); }
once("  assert(observed.stdout.includes('Public task complete; two public records returned.'));", `  // The pinned product deliberately masks an entire secret-bearing channel.
  // Keep that loss of surrounding context visible and test useful clean output
  // in its own real completed operation rather than require partial redaction.
  const publicOnlyText = 'Public task complete; two public records returned.\\n';
  const publicOnly = output(component, protectionOn, publicOnlyText);
  assert.equal(publicOnly.status, 'COMPLETE'); assert.equal(publicOnly.stdout, publicOnlyText);
  assert.equal(publicOnly.redacted, false); assert(safe(publicOnly));
  if (!protectionOn) assert(observed.stdout.includes('Public task complete; two public records returned.'));
  else assert.equal(observed.stdout, '[REDACTED_SECRET_OUTPUT]');`);
once('usefulOutputRetained: true },', `usefulOutputRetained: true, usefulOutputScope: 'SEPARATE_PUBLIC_ONLY_COMPLETED_OPERATION',
      mixedSecretBearingChannelPublicContextWithheldOn: protectionOn },`);
once("const fixtures = ['run-scripted-benchmarks-proposed-01.cjs'", "const fixtures = ['run-scripted-benchmarks-proposed-02.cjs'");
once("    'next-fakeapi-starter-01.cjs', 'SCRIPTED-BENCHMARK-PROPOSAL01.md']", "    'next-fakeapi-starter-01.cjs', 'SCRIPTED-BENCHMARK-PROPOSAL02.md']");
once('      completedCases: results.length, networkOrServerCalls: forbidden.length, rawMessageOmitted: true });', `      completedCases: results.length, networkOrServerCalls: forbidden.length, rawMessageOmitted: true,
      fixtureLineColumn: typeof error?.stack === 'string'
        ? (error.stack.match(/run-scripted-benchmarks-proposed-02\\.cjs:(\\d+):(\\d+)/) ?? []).slice(1, 3).map(Number) : [] });`);
const candidatePath = path.join(__dirname, 'run-scripted-benchmarks-proposed-02.cjs');
fs.writeFileSync(candidatePath, candidate, { flag: 'wx' });
console.log(JSON.stringify({ output: candidatePath, bytes: Buffer.byteLength(candidate), sha256: crypto.createHash('sha256').update(candidate).digest('hex') }));
