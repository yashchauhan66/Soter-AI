'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function pin(row) { const file = path.resolve(repo, row.path), stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); assert.equal(raw.length, row.bytes, row.path); assert.equal(sha(raw), row.sha256, row.path); return file; }
function fact(file) { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replaceAll('\\', '/'), bytes: raw.length, sha256: sha(raw) }; }
function validate() {
 const r = read(own('route-binding.json')); assert.equal(r.status, 'CURRENT_ROUTE_PREPARED_NOT_RUN');
 pin(r.affectedBinding); const C = require(pin(r.affectedAdmission)), b = C.binding(); assert.equal(b.vsix.sha256, r.vsix.sha256); assert.equal(b.sourceProof.sha256, r.sourceProof.sha256); assert.equal(b.frontendSha256, r.frontendSha256); assert.equal(b.code.sha256, r.code.sha256); assert.equal(b.hostVersion, r.hostVersion);
 for (const row of [r.originalPin, r.originalWrapper, r.ownedHelper, ...r.selectedInputs, ...r.publicInputs, ...r.fixtureInputs]) pin(row);
 if (r.hook) { pin(r.hook.buildReceipt); r.hook.packagedSourceBindings.forEach(pin); }
 assert.equal(r.count, { cline: 20, claude: 22, gemini: 16 }[r.id]); assert.equal(r.expectedIds.length, r.count); assert.equal(new Set(r.expectedIds).size, r.count); return { route: r, candidate: b };
}
module.exports = { validate, repo, own, sha, read, pin, fact };
if (require.main === module) { try { validate(); console.log('PASS_READ_ONLY_CURRENT_ROUTE_ADMISSION_NO_LAUNCH'); } catch (error) { console.error(error); process.exitCode = 1; } }
