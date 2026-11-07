const fs=require('node:fs'),assert=require('node:assert/strict'),{own}=require('./storage-current-admission-09.cjs');
const before=fs.readFileSync(own('record-native09-user-defer-01.cjs'),'utf8'),from="assert(!fs.existsSync(own(name))),'Native09",to="assert(!fs.existsSync(own(name)),'Native09";
assert.equal(before.split(from).length,2);fs.writeFileSync(own('record-native09-user-defer-02.cjs'),before.replace(from,to),{flag:'wx'});
