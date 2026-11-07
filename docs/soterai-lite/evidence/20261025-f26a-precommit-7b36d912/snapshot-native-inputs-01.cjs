const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const material = json(path.join(__dirname, 'affected-native-materialization-01.json'));
if (material.status !== 'MATERIALIZED_NOT_EXECUTED' || material.outputs.length !== 26) throw Error('Current materialized helpers required.');
const provenance = json(path.join(__dirname, 'native-driver-provenance-02.json'));
if (provenance.status !== 'BUILT_NOT_RUN_ESM_PARSER_INLINED' || provenance.drivers.length !== 21) throw Error('Current drivers required.');
const files = material.outputs.map(item => ({ file: path.join(repo, item.path), expected: item }));
files.push(...provenance.drivers.map(item => ({ file: path.join(__dirname, item.path), expected: item })));
for (const name of ['host-current-binding-01.ps1','artifact-binding-01.ps1','inspect-vsix-01.ps1','retained-functional10-driver-01.js','retained-security17-driver-01.js','run-precommit-native-01.ps1','precommit-offline-owner-01.cjs','native-host-freeze-01.json']) files.push({ file: path.join(__dirname, name) });
const names = files.map(item => path.basename(item.file)); if (new Set(names).size !== names.length) throw Error('Snapshot filename collision.');
const target = path.join(__dirname, 'pre-native-execution-snapshots-01'); if (fs.existsSync(target)) throw Error('Immutable snapshots already exist.');
const checked = files.map(item => { const current = fact(item.file); if (item.expected && (item.expected.bytes !== current.bytes || item.expected.sha256 !== current.sha256)) throw Error('Current helper/driver drift.'); return { ...item, current }; });
fs.mkdirSync(target);
const records = [];
for (const item of checked) { const snapshot = path.join(target, path.basename(item.file)); fs.copyFileSync(item.file, snapshot, fs.constants.COPYFILE_EXCL); const copied = fact(snapshot); if (copied.bytes !== item.current.bytes || copied.sha256 !== item.current.sha256 || fact(item.file).sha256 !== item.current.sha256) throw Error('Snapshot mismatch.'); records.push({ ...item.current, snapshot: copied }); }
fs.writeFileSync(path.join(__dirname, 'pre-native-snapshots-01.json'), JSON.stringify({ status: 'PRE_NATIVE_EXACT_FIXTURE_SNAPSHOTS_NO_EXECUTION_CLAIM', time: new Date().toISOString(), records }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PRE_NATIVE_CUSTODY_ONLY', files: records.length, native: 'NOT_RUN' }));
