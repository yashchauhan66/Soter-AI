const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../../../..');
const output=path.join(__dirname,'prebuilt-host');
fs.mkdirSync(output);
esbuild.build({absWorkingDir:root,
 entryPoints:[path.join(root,'packages/vscode-extension/src/__tests__/host/liteRestrictionSave.host.ts')],
 outfile:path.join(output,'lite-restriction-host.js'),bundle:true,platform:'node',format:'cjs',external:['vscode'],
 tsconfig:path.join(root,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'})
 .then(()=>console.log(JSON.stringify({status:'BUILT_NOT_RUN',output})))
 .catch(error=>{console.error(error);process.exitCode=1;});
