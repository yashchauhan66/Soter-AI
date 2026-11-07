'use strict';
// Recreate the reviewed neutral allowlist for one newly qualified artifact.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = p => { const b = fs.readFileSync(p); return { path: path.relative(root, p).replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) }; };
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
function pin(row) { const f = path.resolve(root, row.path), actual = fact(f); assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256); return f; }
assert.equal(process.argv.length, 5); assert.equal(process.argv[2], '--binding');
const bindingFile = path.resolve(process.argv[3]); assert.equal(fact(bindingFile).sha256, process.argv[4]);
const binding = json(bindingFile), qualifier = json(pin(binding.qualification)), sourceProof = json(pin(binding.sourceProof));
assert.equal(qualifier.sourceProofSha256, binding.sourceProof.sha256); const artifact = pin(qualifier.vsix);
const sources = new Map(sourceProof.files.map(f => [f.path, f]));
const oldRoot = path.join(root, 'docs/soterai-lite/independent-review-kit-20261104-18a12a73');
const oldManifest = json(path.join(oldRoot, 'file-list.json'));
assert.equal(oldManifest.files.length, 393);
const output = path.join(root, 'docs/soterai-lite/independent-review-kit-20261106-' + qualifier.vsix.sha256.slice(0, 8));
assert(!fs.existsSync(output), 'Refuse prior packet overwrite'); fs.mkdirSync(output);
const rows = [];
const allowedRoles = new Set(['EXACT_ARTIFACT', 'FROZEN_CATALOG', 'PRODUCT_MANIFEST', 'PRODUCT_SOURCE', 'LICENSE', 'BUILD_RECIPE', 'NEUTRAL_INSTRUCTIONS', 'PACKET_EXCLUSION_PROOF']);
for (const row of oldManifest.files) {
  assert(allowedRoles.has(row.role)); assert(!path.isAbsolute(row.path) && !row.path.split('/').some(p => p === '..' || p === ''));
  const oldFile = path.join(oldRoot, row.path), oldBytes = fs.readFileSync(oldFile);
  assert.equal(oldBytes.length, row.bytes); assert.equal(sha(oldBytes), row.sha256);
  if (row.path === 'exclusion-search.json') continue;
  let content = oldBytes;
  if (row.role === 'EXACT_ARTIFACT') content = fs.readFileSync(artifact);
  else if (row.role === 'FROZEN_CATALOG') {
    content = fs.readFileSync(path.join(root, 'docs/soterai-lite/LITE-CATALOG.json')); assert.equal(sha(content), '1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4');
  } else if (row.path.startsWith('source/')) {
    const source = row.path.slice(7), sourceFile = path.join(root, source);
    if (sources.has(source)) pin(sources.get(source));
    else { const current = fs.readFileSync(sourceFile); assert.equal(sha(current), row.sha256, 'Unfrozen reviewer input drift: ' + source); }
    content = fs.readFileSync(sourceFile);
  } else if (row.path === 'reviewer-prompt.md') {
    content = Buffer.from(oldBytes.toString('utf8').replace('Pre-commit is unsupported and must not be advertised as verified. Check retained recovery access without re-running its withdrawn original native test program.', 'Pre-commit is an owner-reviewed opt-in candidate. Test its actual declared install/resume/recovery behavior and preserve the default-off setting. Capability availability does not establish verified protection. The owner resumed its verification; earlier scheduling restrictions are not part of this candidate contract.'));
  } else if (row.path === 'object-identity.json') {
    const identity = JSON.parse(oldBytes);
    identity.artifact = { path: 'product/SoterAI-Lite.vsix', bytes: qualifier.vsix.bytes, sha256: qualifier.vsix.sha256 };
    identity.runtimeIdentity = qualifier.payload.runtimes.map(r => ({ name: path.posix.basename(r.relative), bytes: r.bytes, sha256: r.sha256 }));
    identity.preCommit = 'OWNER_REVIEWED_DEFAULT_OFF_CANDIDATE_VERIFY_ACTUAL_BEHAVIOR';
    identity.availableHost = { codeVersion: '1.145.1', platform: 'win32-x64', status: 'REVIEWER_MUST_RECORD_ACTUAL_TEST_CONFIGURATION' };
    content = Buffer.from(JSON.stringify(identity, null, 2) + '\n');
  }
  const destination = path.join(output, row.path); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content, { flag: 'wx' });
  rows.push({ path: row.path, role: row.role, bytes: content.length, sha256: sha(content) });
}
const excluded = json(path.join(oldRoot, 'exclusion-search.json'));
let scanned = 0;
for (const row of rows.filter(r => !r.path.endsWith('.vsix'))) {
  const text = fs.readFileSync(path.join(output, row.path), 'utf8');
  for (const forbidden of excluded.prohibitedReferences) assert(!text.includes(forbidden), 'Excluded builder reference in ' + row.path);
  scanned++;
}
const exclusion = { status: 'PASS_EXACT_EXCLUDED_PATH_REFERENCE_SEARCH', scannedNonArchiveFiles: scanned, prohibitedReferences: excluded.prohibitedReferences, hits: [], limitation: excluded.limitation };
const exclusionBytes = Buffer.from(JSON.stringify(exclusion, null, 2) + '\n'); fs.writeFileSync(path.join(output, 'exclusion-search.json'), exclusionBytes, { flag: 'wx' });
rows.push({ path: 'exclusion-search.json', role: 'PACKET_EXCLUSION_PROOF', bytes: exclusionBytes.length, sha256: sha(exclusionBytes) }); assert.equal(rows.length, 393);
fs.writeFileSync(path.join(output, 'file-list.json'), JSON.stringify({ schemaVersion: 1, status: 'EXACT_PACKET_BYTES_NOT_INDEPENDENT_REVIEW', files: rows }, null, 2) + '\n', { flag: 'wx' });
const receipt = { status: 'PASS_NEUTRAL_PACKET_MATERIALIZATION_ONLY', observedAt: new Date().toISOString(), qualification: binding.qualification, sourceProof: binding.sourceProof, artifact: qualifier.vsix, manifest: fact(path.join(output, 'file-list.json')), filesIncludingManifest: 394, exclusionScanned: scanned, prohibitedHits: 0, independentVerdict: 'NOT_PROVIDED', nativeRuns: 0 };
const receiptFile = path.join(__dirname, 'neutral-current-' + qualifier.vsix.sha256.slice(0, 8) + '.json'); fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, directory: path.relative(root, output).replaceAll('\\', '/'), receipt: fact(receiptFile) }));
