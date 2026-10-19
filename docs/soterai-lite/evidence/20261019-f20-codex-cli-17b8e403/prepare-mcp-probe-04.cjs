'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let s=fs.readFileSync(path.join(__dirname,'probe-cli-03.cjs'),'utf8').replaceAll('probe-cli-03','probe-cli-04').replaceAll('native-feasibility-profile-03','native-feasibility-profile-04').replaceAll('native-cli-feasibility-03','native-cli-feasibility-04');
function replace(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
replace('let server,current,turn,mcpName;','let server,current,turn,mcpName,mcpNamespace;');
replace('name:mcpName,call_id:', 'name:mcpName,namespace:mcpNamespace,call_id:');
replace("mcpName=(body.tools??[]).find(t=>t.name?.includes('soterai_read_project_file_safely'))?.name;", "const ns=(body.tools??[]).find(t=>t.type==='namespace'&&t.name==='mcp__soterai_safe_read');mcpNamespace=ns?.name;mcpName=ns?.tools?.find(t=>t.name==='soterai_read_project_file_safely')?.name;report.namespaceTools=ns?.tools?.map(t=>({name:t.name,type:t.type}));");
replace("&&report.requests.some(r=>r.phase==='disabled-command-tools')?", "&&report.requests.some(r=>r.phase==='disabled-command-tools'&&r.maskedResult)&&report.mcp.some(r=>r.method==='tools/call')?");
replace("protocol:body.params?.protocolVersion", "protocol:body.params?.protocolVersion,metadataKeys:Object.keys(body.params?._meta??{})");
fs.writeFileSync(path.join(__dirname,'probe-cli-04.cjs'),s,{flag:'wx'});console.log('PREPARED_NATIVE_MCP_PROBE_04');
