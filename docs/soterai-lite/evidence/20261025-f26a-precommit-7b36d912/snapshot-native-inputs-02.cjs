const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const correctionFile = path.join(__dirname, 'affected-pipe-ownership-correction-02.json'), correction = json(correctionFile);
if (correction.status !== 'PREPARED_CORRECTED_SUCCESSORS_NOT_EXECUTED' || correction.records.length !== 25) throw Error('Corrected affected helpers required.');
const files = [...correction.records.map(item => item.target), correction.helper];
const launcherCorrection = json(path.join(__dirname, 'precommit-launcher-correction-02.json')); files.push(launcherCorrection.after);
if (json(path.join(__dirname, 'precommit-ancestry-guard-check-02.json')).status !== 'PASS_ORIGINAL_REFUSAL_AND_SCOPED_SUCCESSOR_NO_CODE_LAUNCH') throw Error('Guard-only evidence absent.');
const target = path.join(__dirname, 'pre-native-execution-snapshots-02');
if (fs.readdirSync(target).length) throw Error('New custody directory must remain empty until first copy.');
const records = [];
for (const item of files) {
 const file = path.join(repo, item.path), current = fact(file); if (current.bytes !== item.bytes || current.sha256 !== item.sha256) throw Error('Corrected helper drift.');
 const snapshot = path.join(target, path.basename(file)); fs.copyFileSync(file, snapshot, fs.constants.COPYFILE_EXCL); const copied = fact(snapshot);
 if (copied.sha256 !== current.sha256 || copied.bytes !== current.bytes) throw Error('Copy mismatch.'); records.push({ ...current, snapshot: copied });
}
fs.writeFileSync(path.join(__dirname, 'pre-native-snapshots-02.json'), JSON.stringify({ status: 'CORRECTED_PRE_NATIVE_CUSTODY_NO_EXECUTION_CLAIM', time: new Date().toISOString(), prior: fact(path.join(__dirname, 'pre-native-snapshots-01.json')), pipeCorrection: fact(correctionFile), ancestryCorrection: fact(path.join(__dirname, 'precommit-launcher-correction-02.json')), records }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'CORRECTED_PRE_NATIVE_CUSTODY_ONLY', files: records.length }));
