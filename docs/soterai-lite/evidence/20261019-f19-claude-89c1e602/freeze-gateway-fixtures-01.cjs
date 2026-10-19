'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../../packages/vscode-extension/src/__tests__/fixtures'),tools=fs.readFileSync(path.join(__dirname,'native-tool-schemas-06.json')),parsed=JSON.parse(tools);assert.equal(parsed.length,26);assert.ok(parsed.every(v=>Object.keys(v).sort().join(',')==='description,input_schema,name'));fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'claude-tools-2.1.301-01.json'),tools,{flag:'wx'});
console.log(JSON.stringify({status:'FROZEN_ACTUAL_PUBLIC_NATIVE_TOOL_SCHEMA',tools:parsed.length,bytes:tools.length}));
