// Read-only Git/source inventory for later explicit review. Never stages or commits.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..'), git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex'), json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const env = { GIT_CONFIG_GLOBAL: 'NUL', GIT_CONFIG_SYSTEM: 'NUL', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: '', LC_ALL: 'C', LANG: 'C' };
for (const key of ['SystemRoot','WINDIR','COMSPEC']) if (process.env[key] !== undefined) env[key] = process.env[key];
const run = args => cp.execFileSync(git, ['--no-pager','-C',repo,...args], { cwd: repo, env, windowsHide: true, shell: false, maxBuffer: 16 * 1024 * 1024 });
const parent = run(['rev-parse','HEAD']).toString('utf8').trim(); if (parent !== '1969c368d439237126a360af452c254a5826be88') throw Error('Checkpoint parent changed; review required.');
const entries = new Map(); for (const row of run(['ls-tree','-r','-z',parent]).toString('utf8').split('\0').filter(Boolean)) { const match = /^([0-7]{6}) blob ([a-f0-9]{40})\t(.+)$/.exec(row); if (match) entries.set(match[3], { mode: match[1], oid: match[2] }); }
const proof = json(path.join(__dirname, 'native-source-inputs-03.json')), candidates = [];
for (const item of proof.files) {
 const raw = fs.readFileSync(path.join(repo, item.path)); if (raw.length !== item.bytes || sha(raw) !== item.sha256) throw Error('Current frozen source differs.');
 if (item.path.startsWith('node_modules/')) continue;
 const oid = crypto.createHash('sha1').update(Buffer.from('blob ' + raw.length + '\0')).update(raw).digest('hex'), old = entries.get(item.path);
 if (!old || old.oid !== oid) candidates.push({ ...item, prior: old ?? null, currentRawBlobOid: oid, classification: old ? 'MODIFIED_REVIEW_REQUIRED' : 'ADDED_REVIEW_REQUIRED' });
}
const stagedPaths = run(['diff','--cached','--name-only','-z','--no-ext-diff','--no-textconv']).toString('utf8').split('\0').filter(Boolean);
if (run(['rev-parse','HEAD']).toString('utf8').trim() !== parent) throw Error('Parent changed during inventory.');
const result = { status: 'READONLY_SOURCE_CANDIDATES_NOT_A_FINAL_COMMIT_SCOPE', time: new Date().toISOString(), parent, stagedPaths, sourceProof: 'native-source-inputs-03.json', candidates, evidenceScope: 'H26 evidence/ledger/queue and any removed paths require separate final acceptance review. node_modules dependencies excluded. No index/object/commit writes.' };
fs.writeFileSync(path.join(__dirname, 'source-candidates-01.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, candidates: candidates.length, staged: stagedPaths.length, paths: candidates.map(item => item.path) }));
