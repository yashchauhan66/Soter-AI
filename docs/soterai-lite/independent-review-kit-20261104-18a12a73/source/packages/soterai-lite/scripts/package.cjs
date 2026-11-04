// Package one immutable build with noncircular metadata; never publish or overwrite.
'use strict';
const fs=require('node:fs/promises'),constants=require('node:fs').constants,path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),vsce=require('@vscode/vsce');
const {verifyBuild}=require('./verify-build.cjs'),{prepareReleaseAssets,auditFinalRelease,FINAL_ASSETS}=require('./audit-release.cjs');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function demand(ok,message){if(!ok)throw Error(message);}
async function parents(repoRoot,file){
 demand(file.startsWith(repoRoot+path.sep),'Package path escaped workspace');
 for(let cursor=path.dirname(file);;cursor=path.dirname(cursor)){const s=await fs.lstat(cursor);demand(s.isDirectory()&&!s.isSymbolicLink(),'Ordinary package parent required');if(cursor===repoRoot)break;}
}
async function stable(repoRoot,file,cap=8*1024*1024){
 await parents(repoRoot,file);const before=await fs.lstat(file);demand(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=cap,'Ordinary bounded package input required');
 const raw=await fs.readFile(file),after=await fs.lstat(file);demand(after.isFile()&&!after.isSymbolicLink()&&after.nlink===1&&after.ino===before.ino&&after.mtimeMs===before.mtimeMs&&after.ctimeMs===before.ctimeMs&&raw.length===before.size&&after.size===before.size,'Package input changed');return raw;
}
async function packageBuild({repoRoot,packageRoot,buildReceiptPath,output}){
 repoRoot=path.resolve(repoRoot);packageRoot=path.resolve(packageRoot);buildReceiptPath=path.resolve(buildReceiptPath);output=path.resolve(output);
 demand(packageRoot===path.join(repoRoot,'packages/soterai-lite')&&output.endsWith('.vsix'),'Explicit Lite package paths required');await parents(repoRoot,output);
 try{await fs.lstat(output);throw Error('Existing artifact overwrite refused');}catch(error){if(error.code!=='ENOENT')throw error;}
 const receiptRaw=await stable(repoRoot,buildReceiptPath,2*1024*1024),receipt=JSON.parse(receiptRaw),attempt=path.dirname(buildReceiptPath);
 const generated=await prepareReleaseAssets({repoRoot,buildReceiptPath});
 const staging=path.join(attempt,'package'),assetsRoot=path.join(attempt,'release-assets');await fs.mkdir(staging);await fs.mkdir(assetsRoot);
 await fs.writeFile(path.join(assetsRoot,'SBOM.cdx.json'),JSON.stringify(generated.sbom,null,2)+'\n',{flag:'wx'});await fs.writeFile(path.join(assetsRoot,'THIRD-PARTY-NOTICES.md'),generated.notices,{flag:'wx'});
 const original=await stable(repoRoot,path.join(attempt,'package.json'),2*1024*1024);demand(sha(original)===receipt.manifestSha256,'Immutable build manifest mismatch');
 const manifest=JSON.parse(original);delete manifest.scripts;delete manifest.devDependencies;const stagedManifest=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await fs.writeFile(path.join(staging,'package.json'),stagedManifest,{flag:'wx'});
 await fs.mkdir(path.join(staging,'dist'));
 for(const item of receipt.inventory){const raw=await stable(repoRoot,path.join(attempt,'dist',item.name));demand(raw.length===item.bytes&&sha(raw)===item.sha256,'Staged runtime mismatch');await fs.writeFile(path.join(staging,'dist',item.name),raw,{flag:'wx'});}
 const assets=[];
 for(const name of FINAL_ASSETS){const source=['SBOM.cdx.json','THIRD-PARTY-NOTICES.md'].includes(name)?path.join(assetsRoot,name):path.join(packageRoot,name),raw=await stable(repoRoot,source);const target=path.join(staging,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,raw,{flag:'wx'});assets.push({path:name,source:path.relative(repoRoot,source).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)});}
 const candidate=path.join(attempt,'package-candidate.vsix');try{await fs.lstat(candidate);throw Error('Existing candidate overwrite refused');}catch(error){if(error.code!=='ENOENT')throw error;}
 await vsce.createVSIX({cwd:staging,packagePath:candidate,dependencies:false,target:'win32-x64',preRelease:true,rewriteRelativeLinks:false});
 const raw=await stable(repoRoot,candidate,16*1024*1024);await parents(repoRoot,output);await fs.copyFile(candidate,output,constants.COPYFILE_EXCL);demand(sha(await stable(repoRoot,output,16*1024*1024))===sha(raw),'Final artifact copy mismatch');
 const result={status:'PACKAGED_NOT_HOST_VERIFIED',output:path.relative(repoRoot,output).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw),runId:receipt.runId??'synthetic',buildReceiptSha256:sha(receiptRaw),extensionSha256:receipt.inventory.find(x=>x.name==='extension.js').sha256,stagedManifestSha256:sha(stagedManifest),assets,target:'win32-x64',preRelease:true,releaseReady:false};
 const packageReceiptPath=path.join(attempt,'package-receipt.json');await fs.writeFile(packageReceiptPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 const audited=await auditFinalRelease({repoRoot,vsixPath:output,expectedSha256:result.sha256,buildReceiptPath,packageReceiptPath});await fs.writeFile(path.join(attempt,'final-release-inventory.json'),JSON.stringify(audited.report,null,2)+'\n',{flag:'wx'});
 return{...result,inventory:path.relative(repoRoot,path.join(attempt,'final-release-inventory.json')).replaceAll('\\','/')};
}
async function main(){
 execFileSync(process.execPath,[path.join(__dirname,'build.cjs')],{stdio:'inherit',windowsHide:true});const {receipt,attempt}=verifyBuild();
 const output=path.resolve(root,process.argv[2]||'soterai-lite-'+receipt.version+'-'+receipt.runId+'.vsix');
 console.log(JSON.stringify(await packageBuild({repoRoot:repo,packageRoot:root,buildReceiptPath:path.join(attempt,'build-provenance.json'),output})));
}
module.exports={packageBuild};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
