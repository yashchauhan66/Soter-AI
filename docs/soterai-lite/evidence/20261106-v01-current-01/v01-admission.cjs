'use strict';
// Read-only admission; safe to import. No process launch or package-code import.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name);
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function fact(file) { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replaceAll('\\', '/'), bytes: raw.length, sha256: sha(raw) }; }
function pin(row) { const file = path.resolve(repo, row.path), stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, row.path); assert.equal(raw.length, row.bytes, row.path); assert.equal(sha(raw), row.sha256, row.path); return file; }
function binding() {
 const b = read(own('binding.json')); assert.equal(b.status, 'CURRENT_V01_AFFECTED_PREPARED_NOT_RUN');
 const proof = read(pin(b.sourceProof)); assert.equal(proof.sourceParent, b.sourceParent); proof.files.forEach(pin);
 const full = read(pin(b.fullAcceptance)), q = read(pin(b.qualification));
 assert.equal(full.sourceProofSha256, b.sourceProof.sha256); assert.equal(full.counts.fail, 0); assert.equal(full.counts.cancelled, 0); assert.equal(full.counts.todo, 0);
 assert.equal(q.status, 'FINAL_SOURCE_FULL_COMPILER_VSIX_CONTENT_BACKEND_REVIEWED_NATIVE_PENDING'); assert.equal(q.sourceProofSha256, b.sourceProof.sha256); assert.equal(q.fullAcceptanceSha256, b.fullAcceptance.sha256); assert.equal(q.vsix.sha256, b.vsix.sha256);
 for (const row of [b.vsix, b.inspection, b.hostReview, b.code, b.baseline, b.driverProvenance, ...b.sourceInputs, ...b.fixtureInputs, ...b.runtimes]) pin(row);
 const vendor = read(pin(b.hostReview)); assert.equal(vendor.currentHost.version, b.hostVersion); assert.equal(vendor.currentHost.executable.sha256, b.code.sha256);
 const inventory = read(pin(b.inspection)); assert.equal(inventory.entries.length, 18);
 for (const row of inventory.entries.filter(row => row.path.startsWith('extension/'))) pin({ ...row, path: b.extractedRoot + '/' + row.path.slice(10) });
 assert.deepEqual(b.families.map(row => row.id), ['ps51', 'editor', 'mcp', 'retained']); assert.equal(b.families.reduce((sum, row) => sum + row.assertions, 0), 175);
 return b;
}
module.exports = { repo, own, read, sha, fact, pin, binding };
if (require.main === module) { try { const b = binding(); console.log(process.argv[2] === '--emit-binding' ? JSON.stringify(b) : 'PASS_READ_ONLY_ADMISSION_NO_HOST_RUN'); } catch (error) { console.error(error); process.exitCode = 1; } }
