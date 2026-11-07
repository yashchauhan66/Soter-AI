const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const relative = 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts', sourceFile = path.join(repo, relative), before = fact(sourceFile);
if (before.sha256 !== '91f6823b50b6c36aa5c8d277386978d3f92e15251c9f7ab2194d31ecc35b636d') throw Error('Frozen fixture differs.');
const fullFile = path.join(__dirname, 'full-inputs-02.json'), proof = json(fullFile);
for (const item of proof.files) { const current = fact(path.join(repo, item.path)); if (current.bytes !== item.bytes || current.sha256 !== item.sha256) throw Error('Before fixture correction source drift.'); }
const snapshot = path.join(__dirname, 'litePreCommitGuard.host.ts.before-CodeExpectedError-01.txt'); fs.copyFileSync(sourceFile, snapshot, fs.constants.COPYFILE_EXCL);
const source = fs.readFileSync(sourceFile, 'utf8'), wrong = 'error.name === "ExpectedError"';
if (source.split(wrong).length !== 2) throw Error('One exact error-name assertion required.');
const hostFile = 'C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/e646868227/resources/app/out/vs/workbench/api/node/extensionHostProcess.js';
const hostRaw = fs.readFileSync(hostFile), witness = 'this.name="CodeExpectedError"'; if (!hostRaw.includes(Buffer.from(witness))) throw Error('Current installed host error witness absent.');
for (const [name, token] of [['liteArtifactScanner.host.ts','"CodeExpectedError"'],['liteHistoryScanner.host.ts','"CodeExpectedError"'],['liteLogs.host.ts','"CodeExpectedError"']]) if (!fs.readFileSync(path.join(repo, 'packages/vscode-extension/src/__tests__/host', name), 'utf8').includes(token)) throw Error('Established native pattern absent.');
fs.writeFileSync(sourceFile, source.replace(wrong, 'error.name === "CodeExpectedError"'));
const after = fact(sourceFile), freeze = json(path.join(__dirname, 'native-host-freeze-01.json'));
freeze.bytes = after.bytes; freeze.sha256 = after.sha256; freeze.fixtureCorrection = { before, after, reason: 'Exact installed CodeExpectedError name; same34 frozen checks, payloads, timeouts and all remaining assertions unchanged.' };
fs.writeFileSync(path.join(__dirname, 'native-host-freeze-02.json'), JSON.stringify(freeze, null, 2) + '\n', { flag: 'wx' });
const current = { ...proof, status: 'NATIVE_ONLY_FIXTURE_CORRECTED_INPUT_PROOF_NOT_NEW_FULL_EXECUTION', time: new Date().toISOString(), priorFullProof: fact(fullFile), allowedNativeOnlyDelta: relative, unchangedFullInputs: 988, files: proof.files.map(item => item.path === relative ? after : item) };
if (current.files.filter(item => item.path === relative).length !== 1) throw Error('Fixture not in prior freeze.');
for (const item of current.files) { const value = fact(path.join(repo, item.path)); if (value.bytes !== item.bytes || value.sha256 !== item.sha256) throw Error('Current source proof drift.'); }
fs.writeFileSync(path.join(__dirname, 'native-source-inputs-03.json'), JSON.stringify(current, null, 2) + '\n', { flag: 'wx' });
const failure = path.join(__dirname, 'f26a-precommit-native-20261026T052530Z-69297ca7/primary-results.json');
fs.writeFileSync(path.join(__dirname, 'native-error-name-correction-01.json'), JSON.stringify({ status: 'NATIVE_FIXTURE_ONLY_CORRECTION_NOT_BEHAVIOR_PASS', time: new Date().toISOString(), before, beforeSnapshot: fact(snapshot), after, nativeFreeze: fact(path.join(__dirname, 'native-host-freeze-02.json')), currentInputs: fact(path.join(__dirname, 'native-source-inputs-03.json')), installedHost: { ...fact(hostFile), witness, offset: hostRaw.indexOf(Buffer.from(witness)) }, previousFailure: fact(failure), unchangedOtherInputs: 988, correctionRound: 1, productChange: false, evidence: 'Actualnative02 first2PASS/HP03AssertionError/27NOTRUN/restartNOTRUN. Existing three native fixtures expect CodeExpectedError; installed exact application constructor uses that name. Only the incorrect literal changed. Earlier preflight-only01refusal and every raw result retained; no PASS regrade.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ corrected: after, unchanged: 988, currentInputs: fact(path.join(__dirname, 'native-source-inputs-03.json')), freeze: fact(path.join(__dirname, 'native-host-freeze-02.json')) }));
