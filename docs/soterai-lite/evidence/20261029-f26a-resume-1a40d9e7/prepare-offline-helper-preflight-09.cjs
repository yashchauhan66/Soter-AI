const fs=require('node:fs'),assert=require('node:assert/strict'),{own,read}=require('./storage-current-admission-09.cjs');
const before=fs.readFileSync(own('precommit-offline-owner-01.cjs'),'utf8');
const old='899f01c8e699e613ac5d3fc2f8066e8997938e79ecc665dfe34af3e5c4e9090b',next='8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced';
assert.equal(before.split(old).length,2);const after=before.replace(old,next);
for(const [name,text]of [['before',before],['after',after]]){
 const end=text.indexOf('  const stdoutFile =');assert(end>0);
 const prefix=text.slice(0,end)+"  process.stdout.write('ALL_OFFLINE_PRESPAWN_GATES_PASS_NO_GIT_OR_CODE_LAUNCHED\\n');\n}\ntry{main();}catch(error){process.exitCode=1;const rows=String(error.stack).split('\\n').slice(1,6).map(x=>/:([0-9]+):([0-9]+)\\)?$/.exec(x)).filter(Boolean).map(x=>({line:Number(x[1]),column:Number(x[2])}));process.stderr.write(JSON.stringify({status:'READONLY_PREFLIGHT_REFUSED',errorName:error.name,frames:rows})+'\\n');}\n";
 fs.writeFileSync(own('offline-helper-'+name+'-preflight-09.cjs'),prefix,{flag:'wx'});
}
fs.writeFileSync(own('precommit-offline-owner-09.cjs.txt'),after,{flag:'wx'});
