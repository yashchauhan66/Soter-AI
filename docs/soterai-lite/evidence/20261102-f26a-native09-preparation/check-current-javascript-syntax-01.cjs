'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const names=['native09-current-admission-01.cjs','run-native09-current-chain-01.cjs','native09-offline-owner-01.cjs.txt'];
for(const name of names)new vm.Script(fs.readFileSync(path.join(__dirname,name),'utf8'),{filename:name});
console.log(JSON.stringify({status:'PASS_SYNTAX_ONLY_NO_EVALUATION',javascriptFiles:names}));
