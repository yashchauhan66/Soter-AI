const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const home = __dirname, json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const native = 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts', rawNative = fs.readFileSync(native);
const parsed = ts.createSourceFile(native, rawNative.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (parsed.parseDiagnostics.length) throw Error('Inherited native draft has incomplete syntax.');
fs.writeFileSync(path.join(home, 'litePreCommitGuard.host.ts.recovered-draft-01.txt'), rawNative, { flag: 'wx' });
fs.writeFileSync(path.join(home, 'native-draft-recovery-01.json'), JSON.stringify({ status: 'RECOVERED_DRAFT_SYNTAX_ONLY_NOT_FULLY_REVIEWED_OR_EXECUTED', time: new Date().toISOString(),
 path: native, bytes: rawNative.length, sha256: sha(rawNative), author: 'Interrupted by usage limit before semantic freeze/contract. Root retained whole candidate without claiming native coverage. Prior draft-path snapshot also retained.',
 declared: { primary: 28, restart: 4 }, pending: 'Root semantic review, compile, native launcher/interphase receipt, current host pins/full/new exactVSIX/content/actual allaffected execution remain required.' }, null, 2) + '\n', { flag: 'wx' });
const before = json(path.join(home, 'component-inputs-07.json'));
const prior = json(path.join(home, 'components-combined-07.txt.result.json'));
const extra = ['checkedHookFile.test.ts','checkedHookFileLinks.review.test.ts','checkedHookFileStage.review.test.ts','preCommitHookTransaction.test.ts',
 'preCommitHookRestore.test.ts','preCommitClientBundle.review.test.ts','preCommitCommands.test.ts','preCommitLegacyRoutes.review.test.ts',
 'preCommitControllerBackend.review.test.ts','preCommitOwnerAvailability.review.test.ts','continuous-guards.test.ts'];
const args = [...prior.arguments, ...extra.map(name => '../vscode-extension/src/__tests__/' + name)];
const files = new Set(before.files.map(value => value.path));
for (const name of fs.readdirSync('packages/vscode-extension/src/history-hooks')) if (name.endsWith('.ts')) files.add('packages/vscode-extension/src/history-hooks/' + name);
for (const name of extra) files.add('packages/vscode-extension/src/__tests__/' + name);
for (const file of [native, 'packages/vscode-extension/src/extension.ts', 'packages/vscode-extension/src/scanners/continuousGuards.ts', 'packages/vscode-extension/package.json',
 'packages/soterai-lite/package.json', 'packages/soterai-lite/scripts/build.cjs', 'packages/soterai-lite/scripts/verify-build.cjs', 'packages/soterai-lite/scripts/prepare-split.cjs',
 'packages/vscode-extension/README.md', 'packages/soterai-lite/README.md', 'docs/vscode-extension-readiness.md', 'docs/soterai-lite/FEATURE-SPLIT.md', 'package.json', 'package-lock.json']) files.add(file);
const inputs = [...files].sort().map(file => { const raw = fs.readFileSync(file); return { path: file, bytes: raw.length, sha256: sha(raw) }; });
const old = new Map(before.files.map(value => [value.path, value.sha256]));
const proof = { status: 'CURRENT_COMPONENT_AND_INTEGRATION_INPUTS09_NOT_FULL_OR_NATIVE', time: new Date().toISOString(), expectedTests: 617,
 testFiles: args.length - 4, files: inputs, changedPrior: inputs.filter(value => old.has(value.path) && old.get(value.path) !== value.sha256).map(value => value.path),
 added: inputs.filter(value => !old.has(value.path)).map(value => value.path), nativeDraft: 'SYNTAX_ONLY_NOT_YET_SEMANTICALLY_FROZEN_OR_EXECUTED' };
fs.writeFileSync(path.join(home, 'component-inputs-09.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(home, 'component-test-arguments-09.json'), JSON.stringify(args, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: inputs.length, testFiles: proof.testFiles, expectedTests: proof.expectedTests, changedPrior: proof.changedPrior, added: proof.added.length }));
