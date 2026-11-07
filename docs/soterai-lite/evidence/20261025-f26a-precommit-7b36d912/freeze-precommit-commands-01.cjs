const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require(path.resolve('node_modules/typescript'));
const rel = 'packages/vscode-extension/src/__tests__/preCommitCommands.test.ts';
const absent = ['commands.ts', 'PreCommitController.ts', 'PreCommitFlags.ts'].map(name => 'packages/vscode-extension/src/history-hooks/' + name);
for (const file of absent) if (fs.existsSync(file)) throw Error('Test-first production boundary unavailable.');
const raw = fs.readFileSync(rel), text = raw.toString('utf8');
const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (source.parseDiagnostics.length) throw Error('Fixture syntax unavailable.');
const tests = [...text.matchAll(/^test\(/gm)].length;
if (tests !== 16) throw Error('Expected exactly 16 frozen grouped cases.');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const archive = 'preCommitCommands.test.ts.frozen-01.txt';
fs.writeFileSync(path.join(__dirname, archive), raw, { flag: 'wx' });
const receipt = {
    status: 'TEST_FIRST_SYNTAX_FROZEN_NOT_EXECUTED',
    time: new Date().toISOString(),
    fixture: { path: rel, bytes: raw.length, sha256: sha256(raw), archive },
    tests,
    absentProduction: absent,
    staticValidation: 'TypeScript createSourceFile parse diagnostics empty; fixture and production modules were not executed. No compiler, test, build, Git or native run.',
    coverage: [
        'Registration/default-off status resource-free; six public commands with argument-free controller routing and current-after-await publication.',
        'Fixed frozen mutation results, safe informational legacy copy without clipboard or executable text, stale result/error refusal, shared mutation pending lock, flag-off explicit restore.',
        'Disposed and retained handler refusal; late success suppression; initial result authenticity; configuration/workspace withdrawal; unsupported roots.',
        'Strict machine boolean global/default precedence, missing inspect false, no merged get fallback, workspace/folder ignored, untrusted/remote/configuration-error refusal.'
    ],
    limits: 'Phase2 synthetic editor/controller prototype doubles only. No actual install, owner review, filesystem, Git, listener, SecretStorage provider, VSIX, native editor or independent evidence. Signing-key event case intentionally awaits a concrete private controller key contract.',
    unchanged: 'Existing 14 filesystem/18 transaction fixtures and root review regressions were not edited.'
};
fs.writeFileSync(path.join(__dirname, 'precommit-commands-freeze-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
