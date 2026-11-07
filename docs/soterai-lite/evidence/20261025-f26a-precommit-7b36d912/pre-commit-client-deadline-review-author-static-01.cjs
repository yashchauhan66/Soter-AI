'use strict';
// Syntax and exact immutable snapshots only; never imports/evaluates tested code.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const repo = path.resolve(__dirname, '../../../..'), prefix = 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/';
const test = 'packages/vscode-extension/src/__tests__/preCommitClientDeadline.review.test.ts';
const snapshot = prefix + 'preCommitClientDeadline.review.before-execution-01.test.ts';
const contract = prefix + 'pre-commit-client-deadline-review-contract-01.md', reportFile = prefix + 'pre-commit-client-deadline-review-author-static-01.json';
const production = 'packages/vscode-extension/src/history-hooks/PreCommitClient.ts', productionSnapshot = prefix + 'PreCommitClient.before-deadline-review-01.ts';
function fact(file) { const bytes = fs.readFileSync(path.join(repo, file)); return { path: file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; }
const bytes = fs.readFileSync(path.join(repo, test)), source = bytes.toString('utf8');
const parsed = ts.createSourceFile(test, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const errors = parsed.parseDiagnostics.map(d => ({ start: d.start, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') }));
const report = { status: errors.length ? 'FAIL_STATIC_TYPESCRIPT_PARSE' : 'PASS_STATIC_TYPESCRIPT_PARSE_ONLY', source: fact(test), errors,
    declaredTests: (source.match(/^test\(/gm) || []).length, containsNul: bytes.includes(0), testedCodeEvaluated: false,
    testCompilerBuildGitNative: 'NOT_RUN', scope: 'TypeScript source-text parse and exact SHA256 only; no typecheck, module evaluation, fixture, HTTP, timers or behavior execution.', time: new Date().toISOString() };
fs.writeFileSync(path.join(repo, reportFile), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
if (errors.length || report.declaredTests !== 1 || report.containsNul) { process.exitCode = 1; console.log(JSON.stringify({ status: 'REFUSED_BEFORE_FREEZE', report })); }
else {
    fs.writeFileSync(path.join(repo, snapshot), bytes, { flag: 'wx' });
    const before = fs.readFileSync(path.join(repo, production)); fs.writeFileSync(path.join(repo, productionSnapshot), before, { flag: 'wx' });
    if (!fs.readFileSync(path.join(repo, production)).equals(before)) throw Error('Client changed during freeze; retain original and create a successor.');
    const freeze = { status: 'ADDITIVE_BEFORE_CORRECTION_TEST_FROZEN_NOT_EXECUTED', feature: 'F26a', component: 'ClientDefaultHTTPAbsoluteDeadlineOwnership', tests: 1,
        facts: [test, snapshot, contract, reportFile, path.relative(repo, __filename).split(path.sep).join('/')].map(fact),
        production: { source: fact(production), snapshot: fact(productionSnapshot), byteExact: true }, snapshotByteExact: fs.readFileSync(path.join(repo, snapshot)).equals(bytes),
        firstExecution: 'ROOT_BASELINE_REQUIRED_BEFORE_CORRESPONDING_PRODUCTION_FIX',
        scope: 'Author-only actual default HTTP ownership regression; controlled actual outer JS deadline and positive live-socket/streamed-byte witnesses. All network numeric captured loopback only; cleanup graceful after assertion. No behavior execution or production/queue/ledger edits.',
        staticStatus: report.status, time: new Date().toISOString() };
    fs.writeFileSync(path.join(__dirname, 'pre-commit-client-deadline-review-freeze-01.json'), JSON.stringify(freeze, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(freeze));
}
