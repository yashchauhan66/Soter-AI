const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const files = ['packages/vscode-extension/src/history-hooks/commands.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','docs/vscode-extension-readiness.md'];
const dir = path.join(__dirname, 'full-integration-before-01'); fs.mkdirSync(dir);
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const inputs = files.map((file, i) => { const raw = fs.readFileSync(file); fs.writeFileSync(path.join(dir, i + '-' + path.basename(file)), raw, { flag: 'wx' }); return { path: file, bytes: raw.length, sha256: sha(raw) }; });
const raw = fs.readFileSync(path.join(__dirname, 'full-tests-01.txt'), 'utf8');
if (!raw.includes('# tests 4221') || !raw.includes('# pass 4212') || !raw.includes('# fail 5') || !raw.includes('# skipped 4')) throw Error('Observed full integration failure unavailable.');
const names = ['installPreCommitGuard','resumePreCommitGuard','restorePreCommitGuard','preCommitGuardStatus'];
for (const file of files.slice(1, 3)) {
 const value = JSON.parse(fs.readFileSync(file, 'utf8'));
 const removed = value.activationEvents.filter(item => names.some(name => item === 'onCommand:soterai.' + name));
 if (removed.length !== 4) throw Error('Unexpected activation-event correction scope.');
 value.activationEvents = value.activationEvents.filter(item => !removed.includes(item));
 for (const id of ['soterai.installGitSecretHook','soterai.copyPreCommitHookScript']) {
  const rows = value.contributes.menus.commandPalette.filter(item => item.command === id); if (rows.length !== 1) throw Error('Legacy alias menu unavailable.'); rows[0].when = 'false';
 }
 fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
const readme = fs.readFileSync(files[3], 'utf8');
const before = '| `SoterAI: Install Git Pre-Commit Secret Hook` | Block commits containing secrets. Refuses (and explains) when husky/lefthook owns `core.hooksPath`. |';
if (readme.split(before).length !== 2) throw Error('Expected one stale README command row.');
fs.writeFileSync(files[3], readme.replace(before, () => '| `SoterAI: Review and Install Pre-Commit Guard` | Review a bounded owning-editor hook with encrypted recovery. Unsupported data withholds the commit; explicit restore remains available while disabled. |'));
fs.writeFileSync(path.join(__dirname, 'full-integration-correction-01.json'), JSON.stringify({ time: new Date().toISOString(), status: 'CORRECTION_AFTER_ACTUAL_FULL5FAIL', inputs,
 changes: 'Keep modern contributed-command activation implicit; hide two callable legacy aliases in favour of canonical palette rows; update stale README table. Root separately changes the registration helper to the existing reg(full command id,...) convention so original parity assertions stay unchanged. No tests/limits/approvals weakened; fresh full required.' }, null, 2) + '\n', { flag: 'wx' });
console.log('Integration correction archived and applied; helper source patch/readiness refresh and fresh checks required.');
