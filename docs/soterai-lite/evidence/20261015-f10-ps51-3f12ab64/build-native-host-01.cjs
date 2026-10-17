// Test-only native harness build. Explicitly executed by the production owner
// after review/typecheck. No product source, activation entry or artifact edits.
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../../../..');
const name = process.argv[2] || 'prebuilt-native-host-01';
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('A new simple host output name is required.');
const out = path.join(__dirname, name);
if (fs.existsSync(out)) throw new Error('Immutable host build output already exists.');
fs.mkdirSync(out);
esbuild.build({ absWorkingDir: repo,
  entryPoints: [path.join(repo, 'packages/vscode-extension/src/__tests__/host/litePowerShell51.host.ts')],
  outfile: path.join(out, 'lite-powershell51-host.js'), bundle: true, platform: 'node', format: 'cjs',
  external: ['vscode'], tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'),
  sourcemap: false, logLevel: 'warning'
}).then(() => console.log(JSON.stringify({ status: 'BUILT_NOT_RUN', out })))
  .catch(error => { console.error(error); process.exitCode = 1; });
