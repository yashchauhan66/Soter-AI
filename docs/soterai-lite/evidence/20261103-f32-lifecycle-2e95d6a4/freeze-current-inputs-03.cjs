'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const priorPath = path.resolve(__dirname, '../20261102-f31b-final-package-7be1c304/full-inputs-06.json');
const priorRaw = fs.readFileSync(priorPath); assert.equal(sha(priorRaw), '8997794c97c6c093905ccf3a94badc19ad7f4cf03260181b8fed7d9099ee96f1');
const prior = JSON.parse(priorRaw);
const source = [
  'src/lifecycle/RemovalCoordinator.ts', 'src/lifecycle/RecoveryInventory.ts', 'src/lifecycle/OwnedLifecycleStop.ts', 'src/lifecycle/commands.ts', 'src/lifecycle/LifecycleFlags.ts',
  'src/extension.ts', 'src/project-privacy/SecureEditor.ts', 'src/vault-runtime/commands.ts',
  'src/terminal/CheckedPowerShellProfile.ts', 'src/terminal/CheckedCmdProfile.ts', 'src/terminal/CheckedGitBashProfile.ts',
  'src/terminal/commands.ts', 'src/terminal/cmdCommands.ts', 'src/terminal/gitBashCommands.ts',
  'src/__tests__/removalCoordinator.test.ts', 'src/__tests__/recoveryInventory.test.ts', 'src/__tests__/ownedLifecycleStop.test.ts',
  'src/__tests__/lifecycleRecoveryCommands.test.ts', 'src/__tests__/lifecycleProfileRecovery.test.ts', 'src/__tests__/lifecycleVaultWithdrawal.test.ts',
  'src/__tests__/lifecycle.manifest.test.ts', 'src/__tests__/lite-secure-editor-commands.test.ts',
  'src/__tests__/extension.test.ts',
].map(file => 'packages/vscode-extension/' + file);
source.push('packages/vscode-extension/package.json', 'packages/soterai-lite/package.json', 'packages/soterai-lite/README.md', 'packages/soterai-lite/CHANGELOG.md', 'docs/vscode-extension-readiness.md');
function fact(relative) {
  const file = path.join(repo, relative);
  for (let current = file;; current = path.dirname(current)) { assert(!fs.lstatSync(current).isSymbolicLink()); if (current === repo) break; }
  const stat = fs.lstatSync(file); assert(stat.isFile() && stat.nlink === 1);
  const raw = fs.readFileSync(file); return { path: relative, bytes: raw.length, sha256: sha(raw) };
}
const files = [...new Set([...prior.files.map(row => row.path), ...source])].sort().map(fact);
const old = new Map(prior.files.map(row => [row.path, row])), scope = new Set(source);
const delta = files.filter(row => row.sha256 !== old.get(row.path)?.sha256);
for (const row of delta) assert(scope.has(row.path), 'Unrelated input drift: ' + row.path);
for (const row of prior.retainedF26a ?? []) assert.deepEqual(fact(row.path), row);
const result = { status: 'FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE', observedAt: new Date().toISOString(),
  sourceParent: '4f5154c4c646f057f8bf6518572586cf5a9dad8d', priorProof: { path: path.relative(repo, priorPath).replaceAll('\\', '/'), sha256: sha(priorRaw) },
  fileCount: files.length, files, scopedSource: source.sort().map(fact), delta,
  retainedF26a: prior.retainedF26a ?? [], f26a: 'USER_SKIPPED_INCOMPLETE_UNSUPPORTED_NO_MORE_NATIVE_ATTEMPTS', releaseReady: false };
fs.writeFileSync(path.join(__dirname, 'full-inputs-03.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, files: files.length, scopedSource: source.length, delta: delta.map(row => row.path), sha256: sha(fs.readFileSync(path.join(__dirname, 'full-inputs-03.json'))) }));
