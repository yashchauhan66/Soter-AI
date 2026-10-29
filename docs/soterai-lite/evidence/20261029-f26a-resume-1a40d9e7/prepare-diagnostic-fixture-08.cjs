const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
const original=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts'),'utf8');
let source=fs.readFileSync(own('f26a-install-diagnostics-07.host.ts'),'utf8');
const review=JSON.parse(fs.readFileSync(own('diagnostic-transform-07.json'),'utf8'));
for(const [from,to]of [['status: value?.status','status: (value as {status?:unknown} | undefined)?.status'],['server.once("error",error=>','server.once("error",(error: unknown)=>']]){
 assert.equal(source.split(from).length,2);source=source.replace(from,to);
 for(const row of review.changes)row.after=row.after.split(from).join(to);
}
let reversed=source;for(const row of [...review.changes].reverse()){assert.equal(reversed.split(row.after).length,2);reversed=reversed.replace(row.after,row.before);}assert.equal(reversed,original);
fs.writeFileSync(own('f26a-install-diagnostics-08.host.ts'),source,{flag:'wx'});
fs.writeFileSync(own('diagnostic-transform-08.json'),JSON.stringify({...review,status:'TWO_DIAGNOSTIC_TYPING_ONLY_CORRECTIONS_NOT_NATIVE_RETRY',parentTransform:'diagnostic-transform-07.json'},null,2)+'\n',{flag:'wx'});
console.log('Diagnostic typing successor08 prepared; original34 callbacks byte exact after reversal.');
