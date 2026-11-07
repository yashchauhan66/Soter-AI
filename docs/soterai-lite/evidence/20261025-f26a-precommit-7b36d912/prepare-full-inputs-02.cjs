const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const home = __dirname, sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const prior = JSON.parse(fs.readFileSync(path.join(home, 'full-inputs-01.json'), 'utf8'));
const expected = new Set(['packages/vscode-extension/src/history-hooks/commands.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','docs/vscode-extension-readiness.md']);
const changes = [], files = prior.files.map(item => { const raw = fs.readFileSync(item.path), current = { path: item.path, bytes: raw.length, sha256: sha(raw) };
 if (item.sha256 !== current.sha256) changes.push(item.path); return current; });
if (changes.length !== expected.size || changes.some(file => !expected.has(file))) throw Error('Unexpected integration delta.');
const rawGate = fs.readFileSync(path.join(home, 'full-integration-tests-01.txt')), receipt = JSON.parse(fs.readFileSync(path.join(home, 'full-integration-tests-01.txt.result.json'), 'utf8').replace(/^\uFEFF/, ''));
if (receipt.exitCode !== 0 || sha(rawGate) !== receipt.sha256.toLowerCase()) throw Error('Current targeted integration gate unavailable.');
const value = { ...prior, status: 'FULL_INPUTS02_AFTER5FAIL_INTEGRATION_CORRECTION', time: new Date().toISOString(), files,
 deltaFrom01: changes, unchangedInputs: files.length - changes.length, coverage: 'Original full01 actual4221/4212PASS5FAIL4SKIP retained. Targeted integration01 PASS current changed behavior; unchanged617 priorcomponent assertions retained. Fresh compiler13/full02 required, no full PASS transfer.' };
fs.writeFileSync(path.join(home, 'full-inputs-02.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const components = JSON.parse(fs.readFileSync(path.join(home, 'component-inputs-10.json'), 'utf8'));
components.files = components.files.map(item => files.find(current => current.path === item.path) ?? item);
components.status = 'COMPONENT_INPUTS11_AFTER_ONLY_INTEGRATION_CORRECTION_TARGETED_PASS_FULL_PENDING'; components.time = value.time; components.deltaFrom10 = changes;
fs.writeFileSync(path.join(home, 'component-inputs-11.json'), JSON.stringify(components, null, 2) + '\n', { flag: 'wx' });
const runner = fs.readFileSync(path.join(home, 'run-full-tests-01.ps1'), 'utf8').replaceAll('full-inputs-01.json', 'full-inputs-02.json')
 .replaceAll('full-tests-start-01.json', 'full-tests-start-02.json').replaceAll('full-tests-01.txt', 'full-tests-02.txt');
fs.writeFileSync(path.join(home, 'run-full-tests-02.ps1'), runner, { flag: 'wx' });
console.log(JSON.stringify({ fileCount: files.length, unchangedInputs: value.unchangedInputs, changes, sha256: sha(fs.readFileSync(path.join(home, 'full-inputs-02.json'))) }));
