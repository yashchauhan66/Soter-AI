const fs=require('node:fs'),{own}=require('./storage-current-admission-09.cjs');
for(const state of ['before','after']){
const s=fs.readFileSync(own('offline-helper-'+state+'-preflight-09.cjs'),'utf8');
const next=s.replace(".split('\\n').slice(1,6).map", ".split('\\n').filter(x=>/^\\s+at /.test(x)).slice(0,6).map");
fs.writeFileSync(own('offline-helper-'+state+'-preflight-10.cjs'),next,{flag:'wx'});
}
