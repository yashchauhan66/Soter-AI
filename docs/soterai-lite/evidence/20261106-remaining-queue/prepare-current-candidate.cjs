'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const previous = path.resolve(__dirname, '../20261103-f32-lifecycle-2e95d6a4');
const target = path.join(__dirname, 'candidate-01');
const sourceParent = process.argv[2];
assert(/^[a-f0-9]{40}$/.test(sourceParent));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function fact(file) { const raw = fs.readFileSync(file), st = fs.lstatSync(file); assert(st.isFile() && !st.isSymbolicLink() && st.nlink === 1); return { path: path.relative(repo, file).replaceAll('\\', '/'), bytes: raw.length, sha256: sha(raw) }; }
function walk(dir, suffix) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => { assert(!e.isSymbolicLink()); const f = path.join(dir, e.name); return e.isDirectory() ? walk(f, suffix) : e.name.endsWith(suffix) ? [path.relative(repo, f).replaceAll('\\', '/')] : []; }); }
const priorFile = path.join(previous, 'full-inputs-04.json');
const prior = JSON.parse(fs.readFileSync(priorFile, 'utf8'));
const names = [...new Set([...prior.files.map(r => r.path), ...walk(path.join(repo, 'packages/vscode-extension/src/__tests__'), '.test.ts'), ...walk(path.join(repo, 'packages/soterai-lite/scripts/__tests__'), '.test.cjs')])].sort();
const files = names.map(n => fact(path.join(repo, n)));
const changed = files.filter(row => !prior.files.some(old => old.path === row.path && old.sha256 === row.sha256));
const scope = new Set([...prior.scopedSource.map(r => r.path), ...changed.map(r => r.path)]);
const proof = { status: 'FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE', observedAt: new Date().toISOString(), sourceParent, priorProof: fact(priorFile), fileCount: files.length, scopedSource: files.filter(r => scope.has(r.path)), files, changedFromPrior: changed, f26a: 'OWNER_RESUMED_LOCAL_CANDIDATE_NATIVE_ACCEPTANCE_PENDING', releaseReady: false };
fs.mkdirSync(target);
fs.writeFileSync(path.join(target, 'full-inputs-01.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
let runner = fs.readFileSync(path.join(previous, 'run-integrated-04.cjs'), 'utf8');
runner = runner.replace("path.resolve(__dirname, '../../../..')", "path.resolve(__dirname, '../../../../..')")
  .replace("'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs'", "'../../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs'")
  .replaceAll('-04', '-01')
  .replace("profile: 'F32_SYNTHETIC_COMPONENT_BUILD_NO_NATIVE_F26A_PUSH_OR_NETWORK'", "profile: 'RESUMED_LOCAL_SYNTHETIC_COMPONENT_BUILD_NO_NATIVE_OR_NETWORK'")
  .replace("  await run('build-01', [path.join(repo, 'packages/soterai-lite/scripts/build.cjs')]);\n", '')
  .replace("soterai-lite-0.7.0-f32-20261103-attempt01.vsix", "soterai-lite-0.7.0-resumed-20261106-attempt01.vsix");
fs.writeFileSync(path.join(target, 'run-integrated-01.cjs'), runner, { flag: 'wx' });
console.log(JSON.stringify({ status: 'NEW_SOURCE_FROZEN_NOT_VERIFIED', proof: fact(path.join(target, 'full-inputs-01.json')), sourceParent, inputCount: files.length, changed: changed.map(r => r.path), runner: fact(path.join(target, 'run-integrated-01.cjs')) }, null, 2));
