'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const previous=read(path.join(repo,'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/full-inputs-09.json'));
const fact=p=>{const file=path.join(repo,p),s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,p);const b=fs.readFileSync(file);return {path:p,bytes:b.length,sha256:sha(b)};};
const names=new Set(previous.files.map(row=>row.path));
for(const directory of ['packages/vscode-extension/src/history-hooks','packages/vscode-extension/src/__tests__']){
 for(const name of fs.readdirSync(path.join(repo,directory))) if(/^(PrePush|prePush|CheckedPrePush|checkedPrePush|CheckedPushRefs|PushRootSnapshot|pushRootSnapshot)/.test(name)&&name.endsWith('.ts'))names.add(directory+'/'+name);
}
for(const p of ['packages/vscode-extension/src/history-hooks/preCommitClientMain.ts','packages/vscode-extension/src/extension.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','packages/soterai-lite/README.md','docs/vscode-extension-readiness.md']) names.add(p);
const files=[...names].sort().map(fact),start=read(own('start-checkpoint-01.json'));
for(const row of start.protectedSources)assert.deepEqual(fact(row.path),row,'Protected F26a source changed.');
const old=new Map(previous.files.map(row=>[row.path,row]));
const proof={status:'FROZEN_CURRENT_F26B_IMPLEMENTATION_NOT_NATIVE_OR_PUSH_ACCEPTANCE',feature:'F26b',observedAt:new Date().toISOString(),priorProof:fact('docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/full-inputs-09.json'),fileCount:files.length,files,delta:files.filter(row=>!old.has(row.path)||row.sha256!==old.get(row.path).sha256),protectedF26a:start.protectedSources,f26aNative09:'USER_DEFERRED_NOT_RUN',push:'NOT_AUTHORIZED_NOT_RUN'};
fs.writeFileSync(own('full-inputs-02.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:proof.status,fileCount:proof.fileCount,delta:proof.delta.length,sha256:sha(fs.readFileSync(own('full-inputs-02.json')))}));
