'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),out=path.resolve(repo,process.argv[2]||'output/hardening-check');
if(!out.startsWith(path.join(repo,'output')+path.sep))throw Error('OUTPUT_SCOPE');
// A clean CI checkout has no output directory. Keep the run directory exclusive.
fs.mkdirSync(path.join(repo,'output'),{recursive:true});fs.mkdirSync(out,{recursive:false});
const environment={};for(const name of ['SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE','ProgramFiles','ProgramW6432','ComSpec','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE'])if(process.env[name])environment[name]=process.env[name];
environment.CI='true';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];
function run(name,args){return new Promise(resolve=>{const file=path.join(out,name+'.log'),fd=fs.openSync(file,'wx');const child=spawn(process.execPath,args,{cwd:repo,env:environment,windowsHide:true,stdio:['ignore',fd,fd]});const timer=setTimeout(()=>child.kill(),900000);
 child.on('error',()=>{});child.on('close',code=>{clearTimeout(timer);fs.closeSync(fd);const b=fs.readFileSync(file),text=b.toString('utf8'),summary={};for(const k of ['tests','pass','fail','skipped']){const m=text.match(new RegExp('^# '+k+' (\\d+)\\r?$','m'));if(m)summary[k]=Number(m[1]);}const result={name,exitCode:code,log:path.relative(repo,file).replaceAll('\\','/'),bytes:b.length,sha256:hash(b),...summary};results.push(result);console.log(JSON.stringify(result));resolve(code===0);});});}
async function main(){const tsc=require.resolve('typescript/bin/tsc'),base=['--require',path.join(repo,'scripts/soterai-source-contract-loader.cjs'),'--import','tsx','--test','--test-concurrency=4'];
 const groups=[['core-typecheck',[tsc,'--noEmit','-p','packages/core/tsconfig.json']],['extension-typecheck',[tsc,'--noEmit','-p','packages/vscode-extension/tsconfig.json']],['cli-typecheck',[tsc,'--noEmit','-p','packages/soterai-cli/tsconfig.json']]];
 for(const [name,args]of groups)if(!await run(name,args))break;
 if(results.every(r=>r.exitCode===0)){
  const extension=fs.readdirSync(path.join(repo,'packages/vscode-extension/src/__tests__')).filter(n=>n.endsWith('.test.ts')).map(n=>'packages/vscode-extension/src/__tests__/'+n);
  await run('extension-source-tests',[...base,...extension]);
  const selected=['packages/soterai-cli/src/__tests__/protectedAgent.test.ts','packages/soterai-cli/src/__tests__/isolation.test.ts','packages/core/src/__tests__/RecoveryEnvelope.test.ts','packages/core/src/__tests__/secretlessOperationBroker.test.ts','packages/core/src/__tests__/fixedHttpsJsonGet.test.ts'].filter(p=>fs.existsSync(path.join(repo,p)));
  await run('core-cli-hardening-tests',[...base,...selected]);
 }
 const report={schemaVersion:1,status:results.every(r=>r.exitCode===0)&&results.length===5?'PASS_AUTOMATED_HARDENING':'FAIL_AUTOMATED_HARDENING',results,independentHumanReview:false,releaseReady:false};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});if(report.status.startsWith('FAIL'))process.exitCode=1;
}
main().catch(e=>{console.error(e.name);process.exitCode=2;});
