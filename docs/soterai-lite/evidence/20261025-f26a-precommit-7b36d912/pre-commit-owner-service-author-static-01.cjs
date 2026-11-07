'use strict';
// Source-text parse and exact metadata only. Never imports/evaluates a test or
// production module, creates a fixture/listener, or runs compiler/build/Git.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const repo = path.resolve(__dirname, '../../../..');
const test = 'packages/vscode-extension/src/__tests__/preCommitOwnerService.test.ts';
const snapshot = 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/preCommitOwnerService.pre-production-01.test.ts';
const contract = 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/pre-commit-owner-service-contract-01.md';
const staticReport = 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/pre-commit-owner-service-author-static-01.json';
const production = 'packages/vscode-extension/src/history-hooks/PreCommitOwnerService.ts';
const bytes = fs.readFileSync(path.join(repo, test)), source = bytes.toString('utf8');
const parsed = ts.createSourceFile(test, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const errors = parsed.parseDiagnostics.map(d => ({ start: d.start, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') }));
function fact(file) { const b = fs.readFileSync(path.join(repo, file)); return { path: file, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }; }
const report = { status: errors.length ? 'FAIL_STATIC_TYPESCRIPT_PARSE' : 'PASS_STATIC_TYPESCRIPT_PARSE_ONLY', source: fact(test),
    errors, declaredTests: (source.match(/^test\(/gm) || []).length, containsNul: bytes.includes(0), testedCodeEvaluated: false,
    testCompilerBuildGitNative: 'NOT_RUN', scope: 'TypeScript syntax text parsing and SHA256 only; no typecheck, test registration, module evaluation, fixture creation, listener, child, signals or behavior verification.', time: new Date().toISOString() };
fs.writeFileSync(path.join(repo, staticReport), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
if (errors.length || report.declaredTests !== 28 || report.containsNul || fs.existsSync(path.join(repo, production))) {
    process.exitCode = 1; console.log(JSON.stringify({ status: 'REFUSED_BEFORE_FREEZE', report, productionAlreadyExists: fs.existsSync(path.join(repo, production)) }));
} else {
    fs.writeFileSync(path.join(repo, snapshot), bytes, { flag: 'wx' });
    const freeze = { status: 'FROZEN_TEST_FIRST_NOT_EXECUTED', feature: 'F26a', component: 'PreCommitOwnerService', tests: 28,
        facts: [test, snapshot, contract, staticReport, path.relative(repo, __filename).split(path.sep).join('/')].map(fact),
        snapshotByteExact: fs.readFileSync(path.join(repo, snapshot)).equals(bytes), productionModuleAbsentAtFreeze: true,
        scope: 'Test author only: retained manual DIRC capabilities, synthetic Ed25519 keys, fake scanners, real loopback HTTP. Root must run the actual missing-module baseline before implementation. No production, behavior execution, compiler/build/Git/native/queue/ledger edits or claims.',
        staticStatus: report.status, time: new Date().toISOString() };
    fs.writeFileSync(path.join(__dirname, 'pre-commit-owner-service-freeze-01.json'), JSON.stringify(freeze, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(freeze));
}
