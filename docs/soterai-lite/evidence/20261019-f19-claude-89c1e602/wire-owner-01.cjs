'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),repo=path.resolve(__dirname,'../../../..'),changes=[];
function edit(name,pairs){const file=path.join(repo,name),before=fs.readFileSync(file,'utf8');let after=before;for(const[a,b]of pairs){assert.equal(after.split(a).length-1,1,'Unique source anchor '+name);after=after.replace(a,b);}assert.notEqual(after,before);fs.writeFileSync(file,after);changes.push({path:name,beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(after).digest('hex')});}
edit('packages/vscode-extension/src/broker/BrokerManager.ts',[
 ['SOTERAI_CLINE_TOOL_SCHEMAS: this.clineSchemasEnabled() ? "1" : "0", SOTERAI_REQUIRE','SOTERAI_CLINE_TOOL_SCHEMAS: this.clineSchemasEnabled() ? "1" : "0", SOTERAI_CLAUDE_TOOL_SCHEMAS: this.claudeSchemasEnabled() ? "1" : "0", SOTERAI_REQUIRE']
]);
const serverFile=path.join(repo,'apps/local-ai-broker/src/BrokerServer.ts'),serverBefore=fs.readFileSync(serverFile,'utf8'),old='["/v1/ai/openai-compatible/chat/completions", "/v1/ai/anthropic-compatible/messages"]';
assert.equal(serverBefore.split(old).length-1,2);const serverAfter=serverBefore.split(old).join('["/v1/ai/openai-compatible/chat/completions", "/v1/ai/anthropic-compatible/messages", ...(this.options.claudeToolSchemas === true ? ["/v1/ai/anthropic-compatible/v1/messages"] : [])]');fs.writeFileSync(serverFile,serverAfter);changes.push({path:'apps/local-ai-broker/src/BrokerServer.ts',scope:'Both framed-route allowlists add only the flagged exact alias'});
for(const name of['gatewayPolicyManager','ownedBrokerManager'])edit('packages/vscode-extension/src/__tests__/'+name+'.test.ts',[
 ['ready:true,generation,clineToolSchemas:','ready:true,generation,claudeToolSchemas:envs.at(-1)?.SOTERAI_CLAUDE_TOOL_SCHEMAS==="1",clineToolSchemas:']
]);
edit('packages/vscode-extension/src/__tests__/mcp-canary-boundary.test.ts',[
 ['ready:true,generation,clineToolSchemas:true','ready:true,generation,claudeToolSchemas:true,clineToolSchemas:true']
]);
const genericFile=path.join(repo,'packages/vscode-extension/src/broker/AutoSecureEngine.ts'),genericBefore=fs.readFileSync(genericFile,'utf8'),start=genericBefore.indexOf('id: "claude-code"'),end=genericBefore.indexOf('id: "continue"',start);assert.ok(start>0&&end>start);const block=genericBefore.slice(start,end),next=block.replace(/coverageNote: "[^\r\n]*"/,'coverageNote: "Requires the separately verified pinned Claude Code adapter; generic environment rewriting does not establish routing."');assert.notEqual(next,block);fs.writeFileSync(genericFile,genericBefore.slice(0,start)+next+genericBefore.slice(end));changes.push({path:'packages/vscode-extension/src/broker/AutoSecureEngine.ts',scope:'Withdraw unverified full-redaction claim'});
const definition={type:'boolean',default:true,scope:'machine',description:'Enable reviewed setup for the pinned Windows Claude Code manual text mode with an owned gateway and approved HTTP MCP reader. Unverified current instances remain Uncovered. Disabling withdraws managed sessions while saved project denies remain; direct context, unsupported attachments and independent traffic are outside verified routes.'};
for(const name of['packages/vscode-extension/package.json','packages/soterai-lite/package.json']){
 const file=path.join(repo,name),before=fs.readFileSync(file,'utf8'),eol=before.includes('\r\n')?'\r\n':'\n';let text=before;
 assert.equal((text.match(/^[ \t]*"soterai[.]lite[.]clineAdapter"\r?$/gm)||[]).length,1);text=text.replace(/^([ \t]*)"soterai[.]lite[.]clineAdapter"(\r?\n)/m,(_all,indent,line)=>indent+'"soterai.lite.claudeAdapter",'+line+indent+'"soterai.lite.clineAdapter"'+line);
 assert.equal((text.match(/^[ \t]*"soterai[.]lite[.]clineAdapter": \{/gm)||[]).length,1);text=text.replace(/^([ \t]*)"soterai[.]lite[.]clineAdapter": \{/m,(all,indent)=>indent+'"soterai.lite.claudeAdapter": '+JSON.stringify(definition,null,2).split('\n').join(eol+indent)+','+eol+all);JSON.parse(text);fs.writeFileSync(file,text);changes.push({path:name,scope:'One new machine/restricted/defaulttrue flag; preserve other bytes'});
}
const native=JSON.parse(fs.readFileSync(path.join(__dirname,'vendor-feasibility-08.json'),'utf8')),protocol=native.requests[0].publicHeaders;assert.equal(protocol.version,'2023-06-01');fs.writeFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/fixtures/claude-protocol-2.1.301-01.json'),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
edit('packages/vscode-extension/src/__tests__/claudeGatewayWire.test.ts',[
 ['import { test } from "node:test";','import { test } from "node:test";\nimport { readFileSync } from "node:fs";\nimport { join } from "node:path";'],
 ['const SDK =','const protocol = JSON.parse(readFileSync(join(__dirname, "fixtures/claude-protocol-2.1.301-01.json"), "utf8"));\nconst SDK ='],
 ['"x-ignored-client": VALUE','"x-ignored-client": VALUE, "anthropic-beta": VALUE'],
 ['assert.equal(wires[0].headers["x-api-key"], KEY);','assert.equal(wires[0].headers["anthropic-beta"], protocol.beta); assert.equal(wires[0].headers["x-api-key"], KEY);']
]);
fs.copyFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/claudeGatewayWire.test.ts'),path.join(__dirname,'claudeGatewayWire-frozen-02.ts.txt'),fs.constants.COPYFILE_EXCL);
fs.writeFileSync(path.join(__dirname,'owner-wiring-changes-01.json'),JSON.stringify({status:'IMPLEMENTED_NOT_TESTED',changes,scope:'Current flags/capability/exact alias and fixed public SDK beta metadata. Raw failures/frozen01 retained; frozen02 adds observed beta replacement control.'},null,2)+'\n',{flag:'wx'});console.log('Applied scoped owner/profile/alias/manifest wiring; tests pending.');
