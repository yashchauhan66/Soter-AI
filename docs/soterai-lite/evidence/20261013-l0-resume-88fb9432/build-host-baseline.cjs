const esbuild=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../../..');
const output=path.join(__dirname,'p03-prebuilt-hosts');
fs.mkdirSync(output);
Promise.all([
 ['privacy-host.js','index.ts'],['security-host.js','securityReview.host.ts']
].map(([name,input])=>esbuild.build({absWorkingDir:root,
 entryPoints:[path.join(root,'packages/vscode-extension/src/__tests__/host',input)],
 outfile:path.join(output,name),bundle:true,platform:'node',format:'cjs',external:['vscode'],
 tsconfig:path.join(root,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'})))
 .then(()=>console.log(JSON.stringify({status:'BUILT_NOT_RUN',output})))
 .catch(error=>{console.error(error);process.exitCode=1;});
