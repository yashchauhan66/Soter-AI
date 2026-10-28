'use strict';
const fs=require('node:fs'),path=require('node:path');const {own,read,sha}=require('./current-native-guard-03.cjs');
const first=read(own('palette-contract-trace-06.json')),source=fs.readFileSync(first.codeWorkbench.path,'utf8'),term='registerFocusViewAction',rows=[];
let pos=0;while((pos=source.indexOf(term,pos))>=0){rows.push({at:pos,excerpt:source.slice(Math.max(0,pos-1200),pos+250)});pos+=term.length;}
const result={status:'STATIC_FOCUS_COMMAND_CATEGORY_TRACE_NOT_NATIVE_PASS',codeWorkbench:first.codeWorkbench.path,sha256:sha(Buffer.from(source)),rows};fs.writeFileSync(own('focus-category-trace-06.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
