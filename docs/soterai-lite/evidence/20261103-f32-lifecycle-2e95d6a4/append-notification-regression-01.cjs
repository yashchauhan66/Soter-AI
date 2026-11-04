const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const file = path.join(repo, 'packages/vscode-extension/src/__tests__/lifecycleRecoveryCommands.test.ts');
const original = fs.readFileSync(file), snippet = fs.readFileSync(path.join(__dirname, 'lifecycle-notification-R21-proposed-01.ts.txt'));
assert.equal(sha(original), '06bd9d12366926dd30b6f694c00547b483cb5dd4994eb21f97cfe1c41f0a6e7d');
assert.equal(sha(snippet), '5f931748cdfcc6dcc174f9b26defecd50cebfe4e150554b9be5acd7da1c1afc3');
fs.appendFileSync(file, '\n' + snippet.toString('utf8'));
console.log(JSON.stringify({ status: 'CANONICAL_R21_APPENDED_BEFORE_PRODUCT_FIX', sha256: sha(fs.readFileSync(file)) }));
