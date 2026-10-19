'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let s=fs.readFileSync(path.join(__dirname,'probe-cli-01.cjs'),'utf8');
function replace(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
s=s.replaceAll('probe-cli-01','probe-cli-02').replaceAll('native-feasibility-profile-01','native-feasibility-profile-02').replaceAll('native-cli-feasibility-01','native-cli-feasibility-02');
replace('let server,current,turn;','let server,current,turn,mcpName;report.mcp=[];');
replace('const output=[{id:', 'const output=current===\'disabled-command-tools\'&&turn===1&&mcpName?[{id:"fc_f20",type:"function_call",status:"completed",name:mcpName,call_id:"call_f20",arguments:JSON.stringify({path:".env"})}]:[{id:');
replace("emit('response.content_part.added'", "if(output[0].type==='message')emit('response.content_part.added'");
replace("emit('response.output_text.delta'", "if(output[0].type==='message')emit('response.output_text.delta'");
replace("emit('response.output_text.done'", "if(output[0].type==='message')emit('response.output_text.done'");
replace("write(path.join(profile,'config.toml'),config);", "const full=config+'\\nproject_unused_placeholder = false\\n';const profileConfig=config.replace('check_for_update_on_startup = false','project_doc_max_bytes = 0\\\\ncheck_for_update_on_startup = false')+'\\n[tools]\\nview_image = false\\n[mcp_servers.soterai_safe_read]\\nurl = '+JSON.stringify(url.replace('/v1','/mcp'))+'\\nhttp_headers = { Authorization = \"Bearer TEST_ONLY_F20_MCP\" }\\n';write(path.join(profile,'config.toml'),profileConfig);");
// Remove the unused no-op variable; keep source transformation explicit.
s=s.replace("const full=config+'\\nproject_unused_placeholder = false\\n';",'');
replace("const body=JSON.parse(Buffer.concat(chunks));report.requests.push", "const body=JSON.parse(Buffer.concat(chunks));if(req.url==='/mcp'){report.mcp.push({phase:current,method:body.method,keys:Object.keys(body.params??{}),protocol:body.params?.protocolVersion});const id=body.id;let result;if(body.method==='initialize')result={protocolVersion:body.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'synthetic-safe-read',version:'1'}};else if(body.method==='tools/list')result={tools:[{name:'soterai_read_project_file_safely',description:'Synthetic safe read',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}]};else if(body.method==='tools/call')result={content:[{type:'text',text:JSON.stringify({status:'ALLOWED_ONCE',kind:'environment-schema',text:'TEST_KEY=[MASKED]'})}]};if(id===undefined){res.writeHead(202);res.end();}else{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id,result}));}return;}mcpName=(body.tools??[]).find(t=>t.name?.includes('soterai_read_project_file_safely'))?.name;report.requests.push");
replace("inputItems:Array.isArray(body.input)?body.input.length:undefined", "inputItems:Array.isArray(body.input)?body.input.length:undefined,maskedResult:JSON.stringify(body.input).includes('TEST_KEY=[MASKED]')");
fs.writeFileSync(path.join(__dirname,'probe-cli-02.cjs'),s,{flag:'wx'});
console.log('PREPARED_NATIVE_MCP_PROBE_02');
