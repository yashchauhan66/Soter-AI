const fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const canonical = JSON.parse(fs.readFileSync(path.join(repo, 'packages/vscode-extension/package.json'), 'utf8'));
const file = path.join(repo, 'packages/soterai-lite/package.json'), lite = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const key of ['contributes', 'activationEvents', 'capabilities']) lite[key] = canonical[key];
fs.writeFileSync(file, JSON.stringify(lite, null, 2) + '\n');
const count = Object.values(canonical.contributes.configuration.properties).filter(value => value.scope === 'machine').length;
if (count !== 49) throw new Error('Machine count changed: ' + count);
console.log(JSON.stringify({ machineSettings: count, restricted: canonical.capabilities.untrustedWorkspaces.restrictedConfigurations.length, profile: canonical.contributes.terminal }));
