const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require(path.resolve('node_modules/typescript'));
const fixture = 'packages/vscode-extension/src/__tests__/preCommitControllerBackend.review.test.ts';
const raw = fs.readFileSync(fixture), source = ts.createSourceFile(fixture, raw.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw Error('Fixture syntax unavailable.');
const tests = [...raw.toString('utf8').matchAll(/^test\(/gm)].length;
if (tests !== 6) throw Error('Expected exactly six bounded backend review cases.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const archive = 'preCommitControllerBackend.review.test.ts.frozen-01.txt';
fs.writeFileSync(path.join(__dirname, archive), raw, { flag: 'wx' });
const context = ['PreCommitController.ts', 'PreCommitOwnerService.ts', 'PreCommitClient.ts', 'PreCommitWire.ts', 'PreCommitHookRestore.ts', 'PreCommitHookTransaction.ts'].map(name => {
    const file = 'packages/vscode-extension/src/history-hooks/' + name, bytes = fs.readFileSync(file), snapshot = name + '.before-controller-backend-review-01.txt';
    fs.writeFileSync(path.join(__dirname, snapshot), bytes, { flag: 'wx' });
    return { path: file, bytes: bytes.length, sha256: sha(bytes), archive: snapshot };
});
const receipt = { status: 'TEST_FIRST_SYNTAX_FROZEN_NOT_EXECUTED', time: new Date().toISOString(),
    fixture: { path: fixture, bytes: raw.length, sha256: sha(raw), archive }, tests, context,
    real: ['Unchanged controller source executing its actual private descriptor and save methods in an isolated CJS wrapper',
        'Canonical Ed25519 key serialization, hook text, wire verification, recovery receipt/digest and restore implementation',
        'Descriptor filesystem only inside retained synthetic profile; canonical artifact observer and directory identity for descriptors'],
    doubles: ['Phase2 editor/context and in-memory SecretStorage', 'Stable root/policy and boundary state', 'Complete owner discovery and synthetic checked hook CAS',
        'Synthetic worker/runtime observations without reading installed runtime', 'Service lifecycle witness and signed startup descriptor without listener/Git/child', 'Decrypted backup retrieval boundary'],
    cases: ['Valid signed prior descriptor resumes to a new signed session', 'Tampered prior descriptor preserved/refused',
        'Foreign generation record and hook swap during restore review preserved', 'Foreign generation record swap during backup retrieval preserved through later save',
        'Service unavailability revokes LIVE and held result authority independent of existing-descriptor issue', 'Missing signing key is not replaced'],
    validation: 'Only TypeScript createSourceFile parse diagnostics checked. Fixture, production modules, tests, compiler, build, Git and native processes were not executed.',
    limits: 'Six Windows-only cases, explicit synthetic dependency seams. No actual installer, Git, owner service listener, SecretStorage provider, runtime hashes, native editor, VSIX or independent evidence.' };
fs.writeFileSync(path.join(__dirname, 'precommit-controller-backend-review-freeze-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
