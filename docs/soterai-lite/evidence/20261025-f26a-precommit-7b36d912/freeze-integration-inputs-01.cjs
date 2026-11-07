const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const files = ['packages/vscode-extension/src/extension.ts', 'packages/vscode-extension/src/scanners/continuousGuards.ts', 'packages/vscode-extension/package.json',
 'packages/soterai-lite/package.json', 'packages/soterai-lite/scripts/build.cjs', 'packages/soterai-lite/scripts/verify-build.cjs', 'packages/soterai-lite/scripts/prepare-split.cjs',
 'packages/vscode-extension/src/__tests__/preCommitLegacyRoutes.review.test.ts'];
const directory = path.join(__dirname, 'integration-before-01'); fs.mkdirSync(directory);
const inputs = files.map((file, i) => { const raw = fs.readFileSync(file), archive = path.join(directory, i + '-' + path.basename(file)); fs.writeFileSync(archive, raw, { flag: 'wx' });
 return { path: file, bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex'), archive: path.relative(process.cwd(), archive).replace(/\\/g, '/') }; });
fs.writeFileSync(path.join(__dirname, 'integration-inputs-before-01.json'), JSON.stringify({ time: new Date().toISOString(), status: 'PRE_REGISTRATION_AND_FOURTH_RUNTIME', inputs }, null, 2) + '\n', { flag: 'wx' });
console.log('Eight integration inputs retained before registration/fourth-runtime edits.');
