'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const text=fs.readFileSync(path.join(__dirname,'run-current-affected-suite-03.ps1'),'utf8');
assert(text.includes("$taskRows=@(\r\n")||text.includes("$taskRows=@(\n"));
const after=text.replace('$taskRows=@(','$taskRows=@(\n @{name=\'affected-mcp-run-01\';helper=\'run-mcp-native-03.ps1\';driver=\'lite-mcp-host.js\'},').replace('affectedEditor25/CI25/','affectedMCP25/Editor25/CI25/');
fs.writeFileSync(path.join(__dirname,'run-current-affected-suite-04.ps1'),after,{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_NOT_RUN',added:'Actual MCP25 alongside all prior affected hosts; shared ledger default-domain paths reopened'}));
