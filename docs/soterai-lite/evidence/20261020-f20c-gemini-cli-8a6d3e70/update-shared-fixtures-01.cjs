const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const changed=[];
for(const name of ['claudeGatewayManager.test.ts','codexResponsesManager.test.ts','gatewayPolicyManager.test.ts','ownedBrokerManager.test.ts','mcp-canary-boundary.test.ts']){
 const file='packages/vscode-extension/src/__tests__/'+name,before=fs.readFileSync(file,'utf8');
 const needle=name==='mcp-canary-boundary.test.ts'?'generation,codexResponses:true':'generation,codexResponses:';
 const replacement=name==='mcp-canary-boundary.test.ts'?'generation,geminiGenerateContent:true,codexResponses:true':'generation,geminiGenerateContent:envs.at(-1)?.SOTERAI_GEMINI_GENERATE_CONTENT==="1",codexResponses:';
 if(!before.includes(needle))throw Error('Fixture anchor '+name);
 const after=before.replace(needle,replacement);fs.writeFileSync(file,after);
 changed.push({file,beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(after).digest('hex')});
}
fs.writeFileSync(path.join(__dirname,'shared-fixture-update-01.json'),JSON.stringify({reason:'Strict new Gemini capability health acknowledgment requires synthetic IPC peers to advertise their actual child launch flag. Production acknowledgment remains strict; original affected59PASS45FAIL retained.',changed},null,2)+'\n',{flag:'wx'});
