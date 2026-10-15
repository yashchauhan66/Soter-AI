// F09 evidence scaffolding. Execute only after the owner schedules metadata sync.
// No tests, application launch, host launch or acceptance decision is performed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const canonicalPath = path.join(repo, 'packages/vscode-extension/package.json');
const litePath = path.join(repo, 'packages/soterai-lite/package.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const outputs = ['metadata-sync-02.json', 'metadata-canonical-input-02.json', 'metadata-lite-before-02.json'];
for (const name of outputs) if (fs.existsSync(path.join(__dirname, name))) throw new Error('Immutable metadata evidence already exists: ' + name);
const canonicalBytes = fs.readFileSync(canonicalPath), liteBeforeBytes = fs.readFileSync(litePath);
const canonical = JSON.parse(canonicalBytes), lite = JSON.parse(liteBeforeBytes);
const properties = canonical.contributes?.configuration?.properties;
if (!properties || typeof properties !== 'object') throw new Error('Canonical configuration is unavailable.');
const machine = Object.keys(properties).filter(key => properties[key].scope === 'machine');
const flag = 'soterai.lite.vaultRuntime', setting = properties[flag];
if (machine.length !== 48 || setting?.type !== 'boolean' || setting.default !== true || setting.scope !== 'machine') throw new Error('Expected 48 machine settings and default-true F09 flag.');
const restricted = canonical.capabilities?.untrustedWorkspaces?.restrictedConfigurations;
if (!Array.isArray(restricted) || restricted.filter(key => key === flag).length !== 1) throw new Error('F09 flag must be restricted in untrusted workspaces.');
const commands = ['soterai.configureVaultApp', 'soterai.runVaultApp', 'soterai.stopVaultApp', 'soterai.vaultAppStatus'];
for (const id of commands) if (canonical.contributes?.commands?.filter(item => item.command === id).length !== 1) throw new Error('Required F09 command missing or duplicated: ' + id);
for (const key of ['taskDefinitions', 'debuggers']) if (canonical.contributes?.[key]?.filter(item => item.type === 'soterai-vault').length !== 1) throw new Error('Required F09 task/debug type missing or duplicated.');
if (lite.name !== 'soterai-ide-guard' || lite.publisher !== 'soterai' || lite.version !== '0.7.0' || lite.main !== './dist/extension.js') throw new Error('Unexpected Lite identity.');
for (const key of ['contributes', 'activationEvents', 'capabilities']) lite[key] = canonical[key];
const liteAfterBytes = Buffer.from(JSON.stringify(lite, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'metadata-canonical-input-02.json'), canonicalBytes, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'metadata-lite-before-02.json'), liteBeforeBytes, { flag: 'wx' });
if (!canonicalBytes.equals(fs.readFileSync(canonicalPath)) || !liteBeforeBytes.equals(fs.readFileSync(litePath))) throw new Error('Manifest changed during metadata preparation.');
if (!liteBeforeBytes.equals(liteAfterBytes)) fs.writeFileSync(litePath, liteAfterBytes);
if (!liteAfterBytes.equals(fs.readFileSync(litePath)) || !canonicalBytes.equals(fs.readFileSync(canonicalPath))) throw new Error('Manifest readback differs.');
const receipt = { status: 'METADATA_SYNCED_NOT_TESTED', artifact: 'soterai-lite-0.7.0-f09-20261015-attempt01.vsix',
  canonical: { path: path.relative(repo, canonicalPath), bytes: canonicalBytes.length, sha256: sha(canonicalBytes) },
  liteBefore: { bytes: liteBeforeBytes.length, sha256: sha(liteBeforeBytes) }, liteAfter: { bytes: liteAfterBytes.length, sha256: sha(liteAfterBytes) },
  identity: lite.publisher + '.' + lite.name, version: lite.version, machineSettings: machine.length, flag,
  commands, taskType: 'soterai-vault', debugType: 'soterai-vault', observedAt: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, 'metadata-sync-02.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));