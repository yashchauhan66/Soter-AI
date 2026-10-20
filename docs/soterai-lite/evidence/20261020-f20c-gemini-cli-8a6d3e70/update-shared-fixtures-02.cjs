const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const changes=[];
for(const name of ['claudeGatewayManager.test.ts','codexResponsesManager.test.ts','gatewayPolicyManager.test.ts','ownedBrokerManager.test.ts','mcp-canary-boundary.test.ts']){
 const file='packages/vscode-extension/src/__tests__/'+name,before=fs.readFileSync(file,'utf8');
 if(before.includes('geminiGenerateContent:')){changes.push({file,status:'ALREADY_UPDATED_BY_HELPER01',beforeSha256:sha(before)});continue;}
 const anchor=name==='mcp-canary-boundary.test.ts'?'if(url.pathname==="/v1/gateway/status")return Response.json({':'if(route==="/v1/gateway/status")return Response.json({';
 if(before.split(anchor).length!==2)throw Error('Fixture anchor '+name);
 const ack=name==='mcp-canary-boundary.test.ts'?'geminiGenerateContent:true,':'geminiGenerateContent:envs.at(-1)?.SOTERAI_GEMINI_GENERATE_CONTENT==="1",';
 const after=before.replace(anchor,anchor+ack);changes.push({file,beforeSha256:sha(before),afterSha256:sha(after),after});
}
// Validate every anchor before mutating any remaining fixture.
for(const entry of changes)if(entry.after)fs.writeFileSync(entry.file,entry.after);
fs.writeFileSync(path.join(__dirname,'shared-fixture-update-02.json'),JSON.stringify({reason:'Helper01 updated Claude then stopped at a differently ordered Codex fixture anchor; incomplete synthetic update retained. Helper02 validates all exact response anchors before writing; strict production acknowledgment unchanged. Pin test now counts file stamps separately from directory stamps, which intentionally detect new entries.',changed:changes.map(({after,...entry})=>entry)},null,2)+'\n',{flag:'wx'});
