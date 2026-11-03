'use strict';
// ENOSPC happened after the reviewed external map write, before proof05 data.
// Preserve that empty failed receipt and produce a distinct proof06 successor.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const own = name => path.join(__dirname, name);
assert.equal(fs.statSync(own('full-inputs-05.json')).size, 0);
let source = fs.readFileSync(own('finalize-feature-acceptance-01.cjs'), 'utf8');
assert.equal(source.split('full-inputs-05.json').length - 1, 5);
source = source.replaceAll('full-inputs-05.json', 'full-inputs-06.json');
const old = 'sourceCheckpoint(); const old = originalSources(); old.files.forEach(localPin);';
const next = 'sourceCheckpoint(); const old = originalSources(); old.files.filter(row => row.path !== claimPath).forEach(localPin);\n  const currentClaims = fact(path.join(repo, claimPath));\n  assert.equal(currentClaims.sha256, candidateSha256, "Only the already-reviewed completed map is accepted after ENOSPC.");';
assert.equal(source.split(old).length - 1, 1); source = source.replace(old, () => next);
const beforeWrite = 'fs.writeFileSync(path.join(repo, claimPath), candidate);';
assert.equal(source.split(beforeWrite).length - 1, 1);
source = source.replace(beforeWrite, 'assert(fs.readFileSync(path.join(repo, claimPath)).equals(candidate)); // Already completed before proof-write ENOSPC.');
new vm.Script(source, { filename: 'finalize-feature-acceptance-02.cjs' });
fs.writeFileSync(own('finalize-feature-acceptance-02.cjs'), source, { flag: 'wx' });
console.log('Prepared narrow claims-write recovery; empty proof05 retained, runtime/test/build checks unchanged.');
