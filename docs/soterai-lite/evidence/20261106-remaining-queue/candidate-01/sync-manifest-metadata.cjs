'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..'), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const own = n => path.join(__dirname, n), read = n => JSON.parse(fs.readFileSync(n, 'utf8'));
const names = ['packages/soterai-lite/package.json', 'packages/vscode-extension/package.json'];
const labels = ['lite', 'canonical'];
const key = 'soterai.lite.historyHooks.preCommit';
const proof = read(own('full-inputs-01.json'));
const mode = process.argv[2]; assert(['snapshot', 'sync'].includes(mode));
if (mode === 'snapshot') {
 for (const [i, n] of names.entries()) { const raw = fs.readFileSync(path.join(repo, n)), pinned = proof.files.find(f => f.path === n); assert.equal(sha(raw), pinned.sha256); fs.writeFileSync(own('pre-metadata-' + labels[i] + '-package.json'), raw, { flag: 'wx' }); }
 console.log('Both exact pre-metadata manifests retained.');
} else {
 // Only after the original test chain has naturally closed. A completed full
 // run is retained; no old evidence is overwritten or relabeled as new.
 assert(fs.existsSync(own('full-suite-acceptance-01.json')));
 const priorFull = read(own('full-suite-acceptance-01.json')); assert.equal(priorFull.counts.fail, 0);
 const beforeLite = fs.readFileSync(own('pre-metadata-lite-package.json'));
 const beforeCanonical = fs.readFileSync(own('pre-metadata-canonical-package.json'));
 const desired = JSON.parse(beforeLite).contributes.configuration.properties[key].description;
 const old = JSON.parse(beforeCanonical).contributes.configuration.properties[key].description;
 assert.notEqual(desired, old);
 const actualCanonical = fs.readFileSync(path.join(repo, names[1])); assert(actualCanonical.equals(beforeCanonical));
 const canonicalText = actualCanonical.toString('utf8'); assert.equal(canonicalText.split(JSON.stringify(old)).length, 2);
 fs.writeFileSync(path.join(repo, names[1]), canonicalText.replace(JSON.stringify(old), JSON.stringify(desired)));
 fs.writeFileSync(path.join(repo, names[0]), beforeLite);
 const files = proof.files.map(row => { const raw = fs.readFileSync(path.join(repo, row.path)); return { path: row.path, bytes: raw.length, sha256: sha(raw) }; });
 const changed = files.filter((row, i) => row.sha256 !== proof.files[i].sha256);
 assert.deepEqual(changed.map(row => row.path), [names[1]]);
 const expectedCanonical = JSON.parse(beforeCanonical); expectedCanonical.contributes.configuration.properties[key].description = desired;
 assert.deepEqual(read(path.join(repo, names[1])), expectedCanonical);
 const currentLite = read(path.join(repo, names[0])), currentCanonical = read(path.join(repo, names[1]));
 for (const field of ['contributes', 'activationEvents', 'capabilities']) assert.deepEqual(currentLite[field], currentCanonical[field]);
 const current = { ...proof, observedAt: new Date().toISOString(), priorProof: { path: path.relative(repo, own('full-inputs-01.json')).replaceAll('\\', '/'), bytes: fs.statSync(own('full-inputs-01.json')).size, sha256: sha(fs.readFileSync(own('full-inputs-01.json'))) }, files, scopedSource: proof.scopedSource.map(row => files.find(f => f.path === row.path)), changedFromPrior: changed, metadataOnlyChange: { file: names[1], jsonPointer: '/contributes/configuration/properties/soterai.lite.historyHooks.preCommit/description', priorDescription: old, currentDescription: desired, runtimeSourceChanged: false } };
 fs.writeFileSync(own('full-inputs-02.json'), JSON.stringify(current, null, 2) + '\n', { flag: 'wx' });
 const sourceProofSha256 = sha(fs.readFileSync(own('full-inputs-02.json')));
 const qualifiedFull = { ...priorFull, observedAt: new Date().toISOString(), sourceProofSha256, executionStatus: 'EXECUTED_ON_PREVIOUS_PROOF_REUSED_AFTER_METADATA_ONLY_CHANGE', executionSourceProofSha256: priorFull.sourceProofSha256, originalAcceptance: { path: own('full-suite-acceptance-01.json'), bytes: fs.statSync(own('full-suite-acceptance-01.json')).size, sha256: sha(fs.readFileSync(own('full-suite-acceptance-01.json'))) }, metadataQualification: current.metadataOnlyChange, qualification: 'All test and runtime implementation bytes are unchanged; only the canonical setting description was synchronized to the previously tested Lite manifest. Original raw test/close evidence retained. Fresh metadata/package/compiler checks are required by the final package qualification.' };
 fs.writeFileSync(own('full-suite-acceptance-02.json'), JSON.stringify(qualifiedFull, null, 2) + '\n', { flag: 'wx' });
 console.log(JSON.stringify({ status: 'DESCRIPTION_ONLY_SOURCE_SYNCED_FRESH_PACKAGE_CHECKS_PENDING', sourceProofSha256, changed: changed.map(f => f.path), fullSuiteExecution: qualifiedFull.executionStatus }, null, 2));
}
