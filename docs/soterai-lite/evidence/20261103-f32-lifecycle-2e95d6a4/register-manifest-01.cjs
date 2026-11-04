const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const flag = 'soterai.lite.lifecycleRecovery';
const command = 'soterai.restoreChangesBeforeRemoval';
const prepared = ['vscode-extension', 'soterai-lite'].map(name => {
  const file = path.join(repo, 'packages', name, 'package.json');
  const raw = fs.readFileSync(file, 'utf8'), manifest = JSON.parse(raw);
  if (manifest.contributes.configuration.properties[flag] !== undefined || manifest.contributes.commands.some(row => row.command === command)) throw Error('Unexpected existing lifecycle registration.');
  manifest.contributes.configuration.properties[flag] = {
    type: 'boolean', default: true, scope: 'machine',
    description: 'Offer a native review of recorded project changes before removal. Existing per-action confirmations remain required. Unknown or manual recovery stays pending; policy, vault values and encrypted backups are retained. Repository overrides are ignored. Disable withdraws this coordinator without changing saved protection or recovery.'
  };
  manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.push(flag);
  manifest.contributes.commands.push({ command, title: 'Restore changes before removal', category: 'SoterAI' });
  const indent = name === 'vscode-extension' ? 4 : 2;
  const next = JSON.stringify(manifest, null, indent) + '\n';
  return { file, next, name, beforeSha256: crypto.createHash('sha256').update(raw).digest('hex') };
});
for (const row of prepared) {
  fs.writeFileSync(row.file, row.next);
  console.log(JSON.stringify({ file: row.name + '/package.json', beforeSha256: row.beforeSha256,
    afterSha256: crypto.createHash('sha256').update(row.next).digest('hex') }));
}
