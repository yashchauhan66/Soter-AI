const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const file = 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts', raw = fs.readFileSync(file);
const source = ts.createSourceFile(file, raw.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw Error('Native fixture syntax unavailable.');
const declarations = []; const visit = node => {
 if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'add') {
  if (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) throw Error('Native observation scope must be fixed.'); declarations.push(node.arguments[0].text);
 }
 ts.forEachChild(node, visit);
}; visit(source);
if (declarations.length !== 34 || new Set(declarations).size !== 34) throw Error('Native observation declaration count changed.');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
fs.writeFileSync(path.join(__dirname, 'litePreCommitGuard.host.ts.frozen-01.txt'), raw, { flag: 'wx' });
const proof = { status: 'SEMANTICALLY_REVIEWED_PREPARED_NOT_EXECUTED', time: new Date().toISOString(), file, bytes: raw.length, sha256: sha(raw),
 primary: declarations.slice(0, 30), restart: declarations.slice(30),
 recovery: 'Author usage-limit interruption retained original691-line candidate and prior draft-path copy. Root read all original source; added mandatory actual rename/deletion groups, extended the worktree-read oracle to renamed source, and kept full four-child assertions for nonempty listings; empty trees forbid object reads. No weakened existing observation.',
 launcher: { rootPrefix: 'D:\\SoterAI-Lite-test-profiles\\', marker: '.synthetic-lite-f26a-precommit-host=synthetic-only-v1',
  environmentPrefix: 'SOTERAI_LITE_F26A_HOOK_', fields: ['PROFILE','EVIDENCE','PHASE','BUNDLE_SHA256','WORKER_SHA256','DRIVER_KIND=native-bootstrap'],
  isolatedOwner: 'HOME/USERPROFILE/XDG_CONFIG_HOME=profile; GIT_CONFIG_GLOBAL/SYSTEM=empty retained profile files; GIT_CONFIG_NOSYSTEM=1; TEMP/TMP inside profile. No other GIT_* selector.',
  interphase: 'Primary retains precommit-restart-state.json. Only after actual Code exit0/bothEOF/zero signals/verified absence twice+stable streams, launcher executes exact recorded offlineArguments/environment in same synthetic root with pinned Git, no hooksPath override/no-verify. Retain child actual exit nonzero/close/bothEOF/no signals/no timeout plus exact source/index/hook/HEAD and stream hashes in precommit-owner-absent.json. Restart validates every receipt field and rawstream hash. No nested client closure inferred from parent Git.',
  refusal: 'Any child timeout is STOP_UNCONFIRMED; no signals, pipe destruction or later phase/launch. Keep ownership until actual natural closure. No normal profile or external traffic.' },
 requiredNext: 'Fresh full source input proof/typecheck, driver buildprovenance, reviewed current installed Code pins/APIs, exact new four-runtime VSIX/content and native launcher. Native behavior, registered values, human review and independent evidence are NOT_RUN/unverified.' };
fs.writeFileSync(path.join(__dirname, 'native-host-freeze-01.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
const prior = JSON.parse(fs.readFileSync(path.join(__dirname, 'component-inputs-09.json'), 'utf8'));
for (const item of prior.files) if (item.path !== file && sha(fs.readFileSync(item.path)) !== item.sha256) throw Error('Unexpected component drift: ' + item.path);
const next = { ...prior, status: 'CURRENT_INPUTS10_ONLY_NATIVE_FIXTURE_DELTA_FROM_COMPILER11_COMPONENT617', time: new Date().toISOString(),
 nativeDraft: 'SEMANTICALLY_REVIEWED_PREPARED_NOT_EXECUTED', files: prior.files.map(item => item.path === file ? { path: file, bytes: raw.length, sha256: sha(raw) } : item),
 deltaFrom09: [file], unchangedInputs: prior.files.length - 1 };
fs.writeFileSync(path.join(__dirname, 'component-inputs-10.json'), JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ native: { file, bytes: raw.length, sha256: sha(raw), checks: declarations.length, executed: false }, unchangedInputs: next.unchangedInputs }));
