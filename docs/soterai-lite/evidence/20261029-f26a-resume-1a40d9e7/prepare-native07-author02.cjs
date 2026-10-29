const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n);
const source=fs.readFileSync(own('record-native07-approval-01.cjs'),'utf8');
assert(source.includes('native07-prior-owner-observation-01.json'));
fs.writeFileSync(own('record-native07-approval-02.cjs'),source.replaceAll('native07-prior-owner-observation-01.json','native07-prior-owner-observation-02.json'),{flag:'wx'});
console.log('Approval recorder successor only rebinds corrected read-only owner observation; candidate/proposal/attempt unchanged.');
