const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const names = ['packages/vscode-extension/src/history-hooks/PreCommitController.ts', 'packages/vscode-extension/src/__tests__/preCommitControllerBackend.review.test.ts'];
const inputs = names.map((file, i) => { const raw = fs.readFileSync(file), archive = i ? 'preCommitControllerBackend.review.test.ts.fixed-state-before-01.txt' : 'PreCommitController.ts.fixed-state-before-01.txt';
 fs.writeFileSync(path.join(__dirname, archive), raw, { flag: 'wx' }); return { path: file, bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex'), archive }; });
const prior = fs.readFileSync(path.join(__dirname, 'preCommitControllerBackend.review.test.ts.before-journal-extension-01.txt'));
if (!fs.readFileSync(names[1]).subarray(0, prior.length).equals(prior)) throw Error('Original six assertions changed.');
fs.writeFileSync(path.join(__dirname, 'fixed-recovery-review-freeze-01.json'), JSON.stringify({ time: new Date().toISOString(), status: 'PRE_CORRECTION_FIXED_GENERATION_STATE_ASSERTIONS', tests: 8, originalSixByteExact: true, inputs,
 rationale: 'Unique journals and the active pointer use non-atomic storage. Keep first exact private state at a generation/state-derived key so recovery discovery never depends only on an opaque index update. Two additive existing-case assertions; no weakened assertions or new native claims.' }, null, 2) + '\n', { flag: 'wx' });
console.log('Fixed-generation recovery regression assertions frozen.');
