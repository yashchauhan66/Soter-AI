const fs=require('node:fs'),assert=require('node:assert/strict'),{own}=require('./storage-current-admission-09.cjs');
let s=fs.readFileSync(own('native08-provenance-gate-02.cjs'),'utf8');
const before="actual=read(own('native-driver-provenance-09.json')),expected=";
assert.equal(s.split(before).length,2);s=s.replace(before,"raw=read(own('native-driver-provenance-09.json')),actual={status:raw.status,drivers:raw.drivers},expected=");
fs.writeFileSync(own('native08-provenance-gate-03.cjs'),s,{flag:'wx'});
