const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../../../..'), out = path.join(__dirname, 'prebuilt-host-01');
fs.mkdirSync(out);
esbuild.build({ absWorkingDir: repo, entryPoints: [path.join(repo, 'packages/vscode-extension/src/__tests__/host/liteSafeConsent.host.ts')], outfile: path.join(out, 'lite-safe-consent-host.js'), bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'), sourcemap: false, logLevel: 'warning' }).then(() => console.log(JSON.stringify({ status: 'BUILT_NOT_RUN', out }))).catch(error => { console.error(error); process.exitCode = 1; });
