const fs=require('node:fs'),path=require('node:path');
const old=path.resolve(__dirname,'../20261014-f05-secure-editor-597d8a24');
for(const [source,target] of [['run-native-02.ps1','run-native-01.ps1'],['inspect-vsix-02.ps1','inspect-vsix-01.ps1']]) {
 let text=fs.readFileSync(path.join(old,source),'utf8').replace(/F05/g,'F06').replace(/f05/g,'f06');
 if(target.startsWith('inspect'))text=text.replace(/attempt02/g,'attempt01').replace(/extracted-02/g,'extracted-01').replace(/inspection-02/g,'inspection-01');
 fs.writeFileSync(path.join(__dirname,target),text,{flag:'wx'});
}
for(const name of ['run-functional-01.ps1','run-security-01.ps1'])fs.copyFileSync(path.join(old,name),path.join(__dirname,name),fs.constants.COPYFILE_EXCL);
const build=`const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');\nconst repo=path.resolve(__dirname,'../../../..'),out=path.join(__dirname,'prebuilt-host-01');fs.mkdirSync(out);\nesbuild.build({absWorkingDir:repo,entryPoints:[path.join(repo,'packages/vscode-extension/src/__tests__/host/liteVault.host.ts')],outfile:path.join(out,'lite-vault-host.js'),bundle:true,platform:'node',format:'cjs',external:['vscode'],tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'}).then(()=>console.log(JSON.stringify({status:'BUILT_NOT_RUN',out}))).catch(error=>{console.error(error);process.exitCode=1;});\n`;
fs.writeFileSync(path.join(__dirname,'build-host-01.cjs'),build,{flag:'wx'});
console.log('Prepared immutable runners; no build/GUI executed.');
