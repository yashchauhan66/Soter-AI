const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../..'),commit='b1ffbcce27b8bafda7a9358d81b78e4aaff6416e';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
 const sourcePath='packages/vscode-extension/src/ai-boundary/VersionedPolicy.ts';
 const source=execFileSync('git',['show',commit+':'+sourcePath],{cwd:repo,windowsHide:true});
 const policyPath='packages/vscode-extension/src/ai-boundary/policy.ts';
 const policy=execFileSync('git',['show',commit+':'+policyPath],{cwd:repo,windowsHide:true});
 assert.equal(sha(policy),sha(fs.readFileSync(path.join(repo,policyPath))),'Unchanged matcher dependency required');
 fs.writeFileSync(path.join(__dirname,'previous-v2-reader-source-01.ts'),source,{flag:'wx'});
 const output=path.join(__dirname,'previous-v2-reader-01.cjs');assert.equal(fs.existsSync(output),false);
 await esbuild.build({absWorkingDir:repo,stdin:{contents:source.toString('utf8'),resolveDir:path.join(repo,'packages/vscode-extension/src/ai-boundary'),sourcefile:'previous-v2-reader.ts',loader:'ts'},
  outfile:output,bundle:true,platform:'node',format:'cjs',tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),logLevel:'warning'});
 const reader=require(output),manual={paths:[{kind:'file',pattern:'synthetic-denied.txt'}],regions:[]};
 const policyValue={schemaVersion:1,presets:[],rules:{paths:[],regions:[]},sensitiveGlobs:[]};
 assert.deepEqual(reader.parseStoredPolicy({schemaVersion:2,manual,policy:policyValue}).manual,manual);
 const audit={schemaVersion:1,records:[{id:'00000000-0000-4000-8000-000000000001',at:1,mode:'ordinary',ruleDigest:'a'.repeat(64),revisionDigest:'b'.repeat(64),outcome:'REVIEWED_SESSION'}]};
 assert.throws(()=>reader.parseStoredPolicy({schemaVersion:3,manual,policy:policyValue,reviewAudit:audit}));
 const result={status:'PASS',scope:'Exact previous F02 schema-aware reader accepts its v2 control and rejects stronger v3. No native/same-user/platform claim.',commit,sourcePath,sourceSha256:sha(source),
  matcherSha256:sha(policy),readerBundleSha256:sha(fs.readFileSync(output)),v2Control:'ACCEPTED',v3Downgrade:'REJECTED',independence:'LOW'};
 fs.writeFileSync(path.join(__dirname,'downgrade-result-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1});
