// Refine raw-blob differences against the sealed F25 WORKING-BYTE checkpoint.
// Older LF blobs vs unchanged CRLF working files are not F26a scope authority.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const baseFile = path.join(repo, 'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/native-source-inputs-03.json'), prior = json(baseFile), current = json(path.join(__dirname, 'native-source-inputs-03.json'));
if (prior.records.length !== 934 || current.files.length !== 989) throw Error('Checkpoint input membership differs.');
const before = new Map(prior.records.map(item => [item.path, item])), rawInventory = json(path.join(__dirname, 'source-candidates-01.json')), byPath = new Map(rawInventory.candidates.map(item => [item.path, item]));
const candidates = [], unchangedButRawBlobDifferent = [];
for (const item of current.files) {
 const present = fact(path.join(repo, item.path)); if (present.bytes !== item.bytes || present.sha256 !== item.sha256) throw Error('Current frozen source drift.');
 const old = before.get(item.path); before.delete(item.path);
 if (!old || old.bytes !== item.bytes || old.sha256 !== item.sha256) candidates.push({ ...item, baseline: old ?? null, rawHead: byPath.get(item.path)?.prior ?? null, classification: old ? 'CHANGED_SINCE_SEALED_F25_WORKING_CHECKPOINT' : 'ADDED_SINCE_SEALED_F25_WORKING_CHECKPOINT' });
 else if (byPath.has(item.path)) unchangedButRawBlobDifferent.push(item.path);
}
const result = { status: 'F26A_WORKING_CHECKPOINT_DELTA_CANDIDATES_NOT_FINAL_COMMIT_SCOPE', time: new Date().toISOString(), priorProof: fact(baseFile), sourceProof: fact(path.join(__dirname, 'native-source-inputs-03.json')), parent: rawInventory.parent, stagedPathsObservedByPriorReadOnlyInventory: rawInventory.stagedPaths, candidates, missingFromCurrentProof: [...before.values()], unchangedButRawBlobDifferent, correction: 'Raw inventory01 compares working bytes with historical Git blobs and found862 candidates. This is not evidence862files changed during F26a. Only the sealed F25 working-byte proof vs current proof determines this candidate delta. Preserve every unrelated/preexisting LF/CRLF difference; final acceptance allowlist and evidence/ledger/queue review still required. No Git writes.' };
fs.writeFileSync(path.join(__dirname, 'source-candidates-03.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, candidates: candidates.length, preexistingByteDifferencesExcluded: unchangedButRawBlobDifferent.length, missing: result.missingFromCurrentProof.length, paths: candidates.map(item => item.path) }));
