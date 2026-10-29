const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../../../../packages/vscode-extension/src/__tests__'),rows=[];
for(const base of ['HookTransaction.test.ts','HookRestore.test.ts','ControllerBackend.review.test.ts']){
 const name='preCommit'+base,old=fs.readFileSync(path.join(dir,name),'utf8');let s=old;
 for(const[a,b]of [['PreCommit','PrePush'],['preCommit','prePush'],['pre-commit','pre-push'],['F26A','F26B'],['F26a','F26b'],['f26a','f26b'],['CheckedHookFile','CheckedPrePushHookFile']])s=s.replaceAll(a,b);
 // Both routes intentionally share the original fourth finite runtime file.
 s=s.replaceAll('pre-push-client.js','pre-commit-client.js');
 fs.writeFileSync(path.join(dir,'prePush'+base),s,{flag:'wx'});rows.push({source:name,sha256:crypto.createHash('sha256').update(old).digest('hex'),target:'prePush'+base});
}
fs.writeFileSync(path.join(__dirname,'recovery-test-derivation-01.json'),JSON.stringify({status:'TEST_ONLY_NOT_RUN',rows,scope:'Existing reviewed transaction, undo and persisted-controller oracles mapped to isolated push leaf/record/domain; explicit component seams retained.'},null,2)+'\n',{flag:'wx'});
