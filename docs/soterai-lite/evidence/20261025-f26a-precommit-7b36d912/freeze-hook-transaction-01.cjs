const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require(path.resolve('node_modules/typescript'));
const home = __dirname, rel = 'packages/vscode-extension/src/__tests__/preCommitHookTransaction.test.ts';
const raw = fs.readFileSync(rel), source = ts.createSourceFile(rel, raw.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw Error('Fixture syntax unavailable.');
const count = [...raw.toString('utf8').matchAll(/^test\(/gm)].length;
if (count !== 18 || fs.existsSync('packages/vscode-extension/src/history-hooks/PreCommitHookTransaction.ts')) throw Error('Pre-implementation boundary unavailable.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const archive = 'preCommitHookTransaction.test.ts.frozen-01.txt';
fs.writeFileSync(path.join(home, archive), raw, { flag: 'wx' });
const hookRel = 'packages/vscode-extension/src/history-hooks/PreCommitHookText.ts', hookRaw = fs.readFileSync(hookRel);
fs.writeFileSync(path.join(home, 'PreCommitHookText.ts.before-transaction-01.txt'), hookRaw, { flag: 'wx' });
const receipt = { status: 'TEST_FIRST_FROZEN_NOT_EXECUTED', time: new Date().toISOString(), fixture: { path: rel, bytes: raw.length, sha256: sha(raw), archive }, tests: count,
  recovery: 'Author interrupted by selected-model-capacity error. Root reviewed all 18 complete draft cases, syntax-parsed unchanged bytes, and adopted this fixture before production/baseline. Same-lineage LOW only.',
  before: { path: hookRel, bytes: hookRaw.length, sha256: sha(hookRaw) },
  contract: 'Private one-shot transaction. Review before preparation/keys/backup; exact encrypted backup readback; durable PREPARED before guarded write; projection/current checks; synchronous final read/current/return. Non-APPLIED prepared lease withdrawn once. Exact owned-after rollback only; owner edits retained INCOMPLETE. Existing body and actual mode retained. No actual filesystem/SecretStorage/native evidence.' };
fs.writeFileSync(path.join(home, 'hook-transaction-freeze-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
