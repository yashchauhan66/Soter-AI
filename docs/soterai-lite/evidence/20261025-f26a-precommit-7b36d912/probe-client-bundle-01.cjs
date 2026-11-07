const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), esbuild = require('esbuild');
(async () => {
  const result = await esbuild.build({ absWorkingDir: process.cwd(), entryPoints: ['packages/vscode-extension/src/history-hooks/preCommitClientMain.ts'],
    bundle: true, write: false, outfile: 'pre-commit-client.js', platform: 'node', format: 'cjs', target: 'node18', minify: true, sourcemap: false, metafile: true,
    tsconfig: 'packages/vscode-extension/tsconfig.json', logLevel: 'warning' });
  const bundle = result.outputFiles[0].contents;
  const receipt = { status: 'STATIC_BUNDLE_PROBE_NOT_RELEASE_OR_NATIVE', time: new Date().toISOString(), bytes: bundle.length,
    sha256: crypto.createHash('sha256').update(bundle).digest('hex'), inputs: Object.keys(result.metafile.inputs),
    imports: Object.values(result.metafile.outputs).flatMap(value => value.imports),
    childProcessImport: Object.values(result.metafile.outputs).some(value => value.imports.some(item => /(?:^|:)child_process$/.test(item.path))) };
  fs.writeFileSync(path.join(__dirname, 'client-bundle-probe-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt));
})().catch(() => { console.error('Client static bundle probe unavailable.'); process.exitCode = 1; });
