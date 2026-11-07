const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fixture = 'packages/vscode-extension/src/__tests__/preCommitControllerBackend.review.test.ts', testRaw = fs.readFileSync(fixture);
if (sha(testRaw) !== '7ebca5eefac45a04f61a47545a55be43291d75d4be168cc0defaf0c9811a88b1' || [...testRaw.toString('utf8').matchAll(/^test\(/gm)].length !== 6) throw Error('Original six fixture bytes drifted.');
const inputs = [fixture, 'packages/vscode-extension/src/history-hooks/PreCommitController.ts'].map(file => {
    const bytes = fs.readFileSync(file), archive = path.basename(file) + '.before-journal-extension-01.txt';
    fs.writeFileSync(path.join(__dirname, archive), bytes, { flag: 'wx' });
    return { path: file, bytes: bytes.length, sha256: sha(bytes), archive };
});
const receipt = { status: 'BEFORE_TEST_EXTENSION_SNAPSHOT_ONLY', time: new Date().toISOString(), inputs, testsBefore: 6,
    authorization: 'Append exactly two journal/recovery backend cases. Preserve the complete original six-case file prefix and assertions. No production or fixture execution.' };
fs.writeFileSync(path.join(__dirname, 'controller-journal-extension-before-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
