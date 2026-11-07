const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const files = ['packages/vscode-extension/src/history-hooks/CheckedHookFile.ts', 'packages/vscode-extension/src/__tests__/checkedHookFileLinks.review.test.ts'];
const inputs = files.map((file, i) => { const raw = fs.readFileSync(file), archive = i ? 'checkedHookFileLinks.review.test.ts.frozen-01.txt' : 'CheckedHookFile.ts.before-dangling-review-01.txt';
  fs.writeFileSync(path.join(__dirname, archive), raw, { flag: 'wx' });
  return { path: file, bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex'), archive }; });
const value = { time: new Date().toISOString(), status: 'STATIC_GAP_REGRESSION_BEFORE_CORRECTION', inputs,
  hypothesis: 'ordinary() resolves realpath before lstat; ENOENT for dangling junction may be admitted as absence. One retained synthetic regression covers selected leaf and custom parent. No original 14 assertions changed.' };
fs.writeFileSync(path.join(__dirname, 'hook-links-review-freeze-01.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(value));
