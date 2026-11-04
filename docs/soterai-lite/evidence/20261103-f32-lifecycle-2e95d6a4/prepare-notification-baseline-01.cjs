const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const original = fs.readFileSync(path.join(repo, 'packages/vscode-extension/src/__tests__/lifecycleRecoveryCommands.test.ts'));
const snippet = fs.readFileSync(path.join(__dirname, 'lifecycle-notification-R21-proposed-01.ts.txt'));
let text = original.toString('utf8');
const rewrites = [
  ['./phase2/register.mjs', 'src/__tests__/phase2/register.mjs'],
  ['./phase2/vscode-stub', 'src/__tests__/phase2/vscode-stub.ts'],
  ['../lifecycle/RemovalCoordinator', 'src/lifecycle/RemovalCoordinator.ts'],
  ['../lifecycle/commands', 'src/lifecycle/commands.ts'],
];
for (const [from, relative] of rewrites) {
  const before = JSON.stringify(from), after = JSON.stringify(path.join(repo, 'packages/vscode-extension', relative).replaceAll('\\', '/'));
  assert.equal(text.split(before).length, 2, from); text = text.replace(before, after);
}
text += '\n' + snippet.toString('utf8');
const output = path.join(__dirname, 'lifecycle-notification-before-01.test.cts');
fs.writeFileSync(output, text, { flag: 'wx' });
const result = { status: 'INERT_EXACT_COMMAND_TEST_COPY_PLUS_R21_ONLY_IMPORT_RELOCATION', originalSha256: sha(original), snippetSha256: sha(snippet),
  output: path.relative(repo, output).replaceAll('\\', '/'), outputSha256: sha(Buffer.from(text)), rewrites };
fs.writeFileSync(path.join(__dirname, 'notification-baseline-source-01.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
