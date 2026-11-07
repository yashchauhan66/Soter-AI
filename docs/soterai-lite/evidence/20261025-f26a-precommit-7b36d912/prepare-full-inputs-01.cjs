const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const prior = JSON.parse(fs.readFileSync('docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/full-inputs-04.json', 'utf8'));
const components = JSON.parse(fs.readFileSync(path.join(__dirname, 'component-inputs-10.json'), 'utf8'));
for (const item of components.files) if (sha(fs.readFileSync(item.path)) !== item.sha256) throw Error('Component/input drift before full freeze: ' + item.path);
const paths = new Set([...prior.records.map(item => item.path), ...components.files.map(item => item.path)]);
function walk(directory) {
 for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
  const file = directory + '/' + entry.name;
  if (entry.isSymbolicLink()) throw Error('Aliased source input unavailable.');
  if (entry.isDirectory()) walk(file); else if (/\.(?:ts|mjs|cjs|json)$/.test(entry.name)) paths.add(file);
 }
}
walk('packages/vscode-extension/src');
const files = [...paths].sort().map(file => { const raw = fs.readFileSync(file); return { path: file, bytes: raw.length, sha256: sha(raw) }; });
const value = { status: 'FULL_CURRENT_INPUTS_FROZEN_NOT_EXECUTED', time: new Date().toISOString(), parent: '1969c368d439237126a360af452c254a5826be88',
 components: { path: path.relative(process.cwd(), path.join(__dirname, 'component-inputs-10.json')).replace(/\\/g, '/'), sha256: sha(fs.readFileSync(path.join(__dirname, 'component-inputs-10.json'))) },
 fileCount: files.length, files, exclusions: ['No evidence, retained profiles, generated build outputs, normal user profile, real secrets or workspace history are discovered. Known old inputs plus current canonical source/test fixtures and explicit integration inputs only.'],
 claimed: 'Freeze only; current617 components separate, fresh compiler12/full/backend/newpackage/native gates required.' };
fs.writeFileSync(path.join(__dirname, 'full-inputs-01.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: value.status, fileCount: files.length, sha256: sha(fs.readFileSync(path.join(__dirname, 'full-inputs-01.json'))) }));
