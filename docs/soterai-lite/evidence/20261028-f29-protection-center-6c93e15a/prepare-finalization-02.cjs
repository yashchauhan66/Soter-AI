'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');const {own}=require('./current-native-guard-03.cjs');
let script=fs.readFileSync(own('finalize-acceptance-01.cjs'),'utf8');for(const [a,b]of [['extra06-consumption-01.json','extra07-consumption-01.json'],['extra06-approval-01.json','extra07-approval-01.json'],['PROPOSAL06.md','PROPOSAL07.md'],['f29-native-chain-result-06.json','f29-native-chain-result-07.json'],['native-run-06','native-run-07'],['proposal06-preparation-01.json','proposal07-preparation-01.json']]){assert(script.includes(a));script=script.split(a).join(b);}
script=script.replace("gate('palette-entrypoints-component-07');","gate('palette-entrypoints-component-07');gate('streamed-pin-component-08');gate('streamed-admission-08');");
fs.writeFileSync(own('finalize-acceptance-02.cjs'),script,{flag:'wx'});console.log('FINALIZATION02_PREPARED_NOT_EXECUTED_REQUIRES_ACTUAL_EXTRA07_PASS');
