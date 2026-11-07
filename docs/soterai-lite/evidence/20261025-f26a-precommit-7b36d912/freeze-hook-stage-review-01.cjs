const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const source = 'packages/vscode-extension/src/history-hooks/CheckedHookFile.ts', raw = fs.readFileSync(source);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
if (sha(raw) !== '9d173867e33feaff2ec8cd30135ea84f3e900a532b02786fd0e128f8a79014d1') throw Error('Production changed before review regression.');
const test = 'packages/vscode-extension/src/__tests__/checkedHookFileStage.review.test.ts', fixture = fs.readFileSync(test);
fs.writeFileSync(path.join(__dirname, 'checkedHookFileStage.review.test.ts.frozen-01.txt'), fixture, { flag: 'wx' });
const baseline = fs.readFileSync(path.join(__dirname, 'hook-stage-review-before-01.txt'));
if (!baseline.toString('utf8').includes('# tests 2') || !baseline.toString('utf8').includes('# fail 2')) throw Error('Expected two observed regression failures.');
const value = { status: 'TWO_ACTUAL_STAGE_OWNERSHIP_FAILURES_BEFORE_CORRECTION', time: new Date().toISOString(),
  source: { path: source, sha256: sha(raw) }, fixture: { path: test, bytes: fixture.length, sha256: sha(fixture) }, baselineSha256: sha(baseline),
  finding: 'The private FD creation identity was not compared with subsequent stage-path identity; foreign equal-byte/mode replacement was adopted or deleted. Root regression confirms both paths. One bounded filesystem correction will also reject already-observed dangling links. Original14 and all new assertions remain unchanged.' };
fs.writeFileSync(path.join(__dirname, 'hook-stage-review-freeze-01.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(value));
