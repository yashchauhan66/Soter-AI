const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require(path.resolve('node_modules/typescript')), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const file = 'packages/vscode-extension/src/__tests__/preCommitControllerBackend.review.test.ts', raw = fs.readFileSync(file);
const before = fs.readFileSync(path.join(__dirname, 'preCommitControllerBackend.review.test.ts.before-journal-extension-01.txt'));
if (sha(before) !== '7ebca5eefac45a04f61a47545a55be43291d75d4be168cc0defaf0c9811a88b1' || !raw.subarray(0, before.length).equals(before)) throw Error('Original six-case prefix was changed.');
const source = ts.createSourceFile(file, raw.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw Error('Fixture syntax unavailable.');
const tests = [...raw.toString('utf8').matchAll(/^test\(/gm)].length;
if (tests !== 8 || [...raw.subarray(before.length).toString('utf8').matchAll(/^test\(/gm)].length !== 2) throw Error('Expected exactly two appended cases, eight total.');
const archive = 'preCommitControllerBackend.review.test.ts.frozen-journal-01.txt';
fs.writeFileSync(path.join(__dirname, archive), raw, { flag: 'wx' });
const controllerFile = 'packages/vscode-extension/src/history-hooks/PreCommitController.ts', controller = fs.readFileSync(controllerFile);
const priorController = fs.readFileSync(path.join(__dirname, 'PreCommitController.ts.before-journal-extension-01.txt'));
const receipt = { status: 'EIGHT_CASES_SYNTAX_FROZEN_NOT_EXECUTED', time: new Date().toISOString(),
    fixture: { path: file, bytes: raw.length, sha256: sha(raw), archive }, tests, extensionCases: 2,
    preservedPrefix: { bytes: before.length, sha256: sha(before), exact: true, originalCases: 6 },
    controller: { path: controllerFile, bytes: controller.length, sha256: sha(controller), unchangedSinceBeforeSnapshot: controller.equals(priorController), archive: 'PreCommitController.ts.before-journal-extension-01.txt' },
    coverage: ['Useful real private #save restoration: ROLLED_BACK root record equals exact new immutable private revision, previous journal/index retained and public index only opaque IDs',
        'Awaited journal store swaps root record to a foreign valid generation: retain the owned revision and newer root raw, zero stale root stores, INCOMPLETE with no journal retry'],
    limits: 'Same six-case unchanged-controller wrapper and explicit dependency seams. Additive actual synthetic AES-GCM backup artifact plus in-memory scoped key checks retention only; FakeBackups still supplies decrypted retrieval. No real SecretStorage provider, native editor, owner listener/Git/child, VSIX or independent evidence.',
    validation: 'TypeScript createSourceFile parse diagnostics empty and exact original prefix check only; no fixture, compiler, tests, builds, Git or production execution.' };
fs.writeFileSync(path.join(__dirname, 'controller-journal-extension-freeze-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
