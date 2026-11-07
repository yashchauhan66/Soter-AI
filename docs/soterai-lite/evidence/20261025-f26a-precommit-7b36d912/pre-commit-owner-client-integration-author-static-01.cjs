'use strict';
// Static source-text parsing and immutable byte snapshots only. Does not import
// tests/production, create fixtures/listeners, request, compile, run Git or signal.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const repo = path.resolve(__dirname, '../../../..'), prefix = 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/';
const test = 'packages/vscode-extension/src/__tests__/preCommitOwnerClient.integration.test.ts';
const snapshot = prefix + 'preCommitOwnerClient.integration.before-execution-01.test.ts';
const contract = prefix + 'pre-commit-owner-client-integration-contract-01.md', review = prefix + 'pre-commit-client-http-review-01.md';
const staticReport = prefix + 'pre-commit-owner-client-integration-author-static-01.json';
const productions = ['PreCommitClient', 'PreCommitOwnerService'].map(name => ({ source: 'packages/vscode-extension/src/history-hooks/' + name + '.ts', snapshot: prefix + name + '.before-default-http-integration-01.ts' }));
function fact(file) { const bytes = fs.readFileSync(path.join(repo, file)); return { path: file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; }
const bytes = fs.readFileSync(path.join(repo, test)), text = bytes.toString('utf8');
const parsed = ts.createSourceFile(test, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const errors = parsed.parseDiagnostics.map(d => ({ start: d.start, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') }));
const report = { status: errors.length ? 'FAIL_STATIC_TYPESCRIPT_PARSE' : 'PASS_STATIC_TYPESCRIPT_PARSE_ONLY', source: fact(test), errors,
    declaredTests: (text.match(/^test\(/gm) || []).length, containsNul: bytes.includes(0), testedCodeEvaluated: false,
    testCompilerBuildGitNative: 'NOT_RUN', scope: 'TypeScript source-text parse, exact SHA256 and byte snapshots only; no typecheck, module evaluation, fixture, network, child or behavior result.', time: new Date().toISOString() };
fs.writeFileSync(path.join(repo, staticReport), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
if (errors.length || report.declaredTests !== 6 || report.containsNul) { process.exitCode = 1; console.log(JSON.stringify({ status: 'REFUSED_BEFORE_FREEZE', report })); }
else {
    fs.writeFileSync(path.join(repo, snapshot), bytes, { flag: 'wx' });
    const productionFacts = productions.map(item => {
        const before = fs.readFileSync(path.join(repo, item.source)); fs.writeFileSync(path.join(repo, item.snapshot), before, { flag: 'wx' });
        if (!fs.readFileSync(path.join(repo, item.source)).equals(before)) throw Error('Production changed during static freeze; retain snapshots and use a new successor.');
        return { source: fact(item.source), snapshot: fact(item.snapshot), byteExact: true };
    });
    const freeze = { status: 'ADDITIVE_TESTS_FROZEN_NOT_EXECUTED', feature: 'F26a', component: 'OwnerClientDefaultHTTP', tests: 6,
        facts: [test, snapshot, contract, review, staticReport, path.relative(repo, __filename).split(path.sep).join('/')].map(fact),
        productionFacts, snapshotByteExact: fs.readFileSync(path.join(repo, snapshot)).equals(bytes), existingProductionModules: true,
        firstExecution: 'ROOT_MUST_CAPTURE_BEFORE_ANY_CORRESPONDING_FIX_NOT_A_MISSING_MODULE_BASELINE',
        scope: 'Author-only default HTTP integration with real owner, manual synthetic DIRC, fake completed scanners and actual inert synthetic artifacts. Numeric-loopback-only guard; no test/compiler/native/Git/queue/ledger execution or edits.',
        staticStatus: report.status, time: new Date().toISOString() };
    fs.writeFileSync(path.join(__dirname, 'pre-commit-owner-client-integration-freeze-01.json'), JSON.stringify(freeze, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(freeze));
}
