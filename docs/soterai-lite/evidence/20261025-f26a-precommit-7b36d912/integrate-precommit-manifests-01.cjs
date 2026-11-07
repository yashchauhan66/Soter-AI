const fs = require('node:fs');
const legacy = 'packages/vscode-extension/src/scanners/continuousGuards.ts', source = fs.readFileSync(legacy, 'utf8');
const begin = source.indexOf('    // #5 command: offer to install a pre-commit hook'), end = source.indexOf('    // #6 command: warn on screen-share risk', begin);
if (begin < 0 || end < begin) throw Error('Legacy hook registration boundary unavailable.');
fs.writeFileSync(legacy, source.slice(0, begin) + '    // Pre-commit install and legacy copy are owned by history-hooks/commands.\n\n' + source.slice(end));
const names = ['installPreCommitGuard', 'resumePreCommitGuard', 'restorePreCommitGuard', 'preCommitGuardStatus'];
const titles = ['Review and Install Pre-Commit Guard', 'Resume Pre-Commit Owner', 'Restore Original Pre-Commit Hook', 'Pre-Commit Owner Status'];
for (const file of ['packages/vscode-extension/package.json', 'packages/soterai-lite/package.json']) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let i = 0; i < names.length; i++) {
    const command = 'soterai.' + names[i];
    if (manifest.contributes.commands.some(value => value.command === command)) throw Error('New command already present.');
    manifest.contributes.commands.push({ command, title: titles[i], category: 'SoterAI' });
    manifest.contributes.menus.commandPalette.push({ command, when: 'soterai.advancedCommands' });
    manifest.activationEvents.push('onCommand:' + command);
  }
  const flag = 'soterai.lite.historyHooks.preCommit';
  if (Object.hasOwn(manifest.contributes.configuration.properties, flag)) throw Error('New setting already present.');
  manifest.contributes.configuration.properties[flag] = { type: 'boolean', default: false, scope: 'machine',
    description: 'Opt in to an owner-reviewed cooperative staged-tree pre-commit guard. Requires the live owning editor and explicit resume after restart. Unsupported data and absent owners withhold commits. Reviewed encrypted recovery/restore remains available while disabled. Deliberate bypass and final commit races remain; no complete detection or registered-value guarantee.' };
  manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.push(flag);
  for (const contribution of manifest.contributes.commands) {
    if (contribution.command === 'soterai.installGitSecretHook') contribution.title = 'Review and Install Pre-Commit Guard (Legacy Alias)';
    if (contribution.command === 'soterai.copyPreCommitHookScript') contribution.title = 'Pre-Commit Owner Guidance (Legacy Alias)';
  }
  if (file.includes('soterai-lite/')) manifest.files.splice(3, 0, 'dist/pre-commit-client.js');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}
console.log('Canonical hook routes, strict default-off setting and four-runtime manifest allowlist integrated; build/native pending.');
