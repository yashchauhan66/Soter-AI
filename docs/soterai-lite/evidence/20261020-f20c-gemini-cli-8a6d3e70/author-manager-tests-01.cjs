const fs=require('node:fs'), path=require('node:path');
const source='packages/vscode-extension/src/__tests__/claudeGatewayManager.test.ts';
let text=fs.readFileSync(source,'utf8');
text=text.slice(0,text.indexOf('test("F19 default'));
text=text.replace('claudeAck?:unknown','claudeAck?:unknown;geminiAck?:unknown');
text=text.replace('codexResponses:envs.at(-1)?.SOTERAI_CODEX_RESPONSES===','geminiGenerateContent:Object.hasOwn(extra,"geminiAck")?extra.geminiAck:envs.at(-1)?.SOTERAI_GEMINI_GENERATE_CONTENT==="1",codexResponses:envs.at(-1)?.SOTERAI_CODEX_RESPONSES===');
text+=`
test("F20C machine default binds Gemini capability and ignores repository upstream",async()=>{const f=fixture();stub.state.configInspect.set("soterai.broker.geminiProviderUrl",{defaultValue:"",globalValue:"http://127.0.0.1:31400",workspaceValue:"https://foreign.invalid"});try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_GEMINI_GENERATE_CONTENT,"1");assert.equal(f.envs[0].SOTERAI_GEMINI_PROVIDER_URL,"http://127.0.0.1:31400");}finally{await f.manager.stop();}});
test("F20C machine disable ignores repository enabling",async()=>{const f=fixture();stub.state.configInspect.set("soterai.lite.geminiCliAdapter",{defaultValue:true,globalValue:false,workspaceValue:true});try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_GEMINI_GENERATE_CONTENT,"0");}finally{await f.manager.stop();}});
for(const geminiAck of [false,"true",undefined])test("F20C absent/wrong Gemini acknowledgment withholds "+String(geminiAck),async()=>{const f=fixture({geminiAck});try{await assert.rejects(f.manager.start());assert.notEqual(f.manager.ownedSnapshot().state,"healthy");}finally{await f.manager.stop();}});
for(const variant of ["flag","base"])test("F20C "+variant+" drift revokes current broker lease",async()=>{const f=fixture();try{await f.manager.start();if(variant==="flag")stub.state.configInspect.set("soterai.lite.geminiCliAdapter",{defaultValue:true,globalValue:false});else stub.state.configInspect.set("soterai.broker.geminiProviderUrl",{defaultValue:"",globalValue:"http://127.0.0.1:31401"});await assert.rejects(f.manager.request("/version"));}finally{await f.manager.stop();}});
`;
fs.writeFileSync('packages/vscode-extension/src/__tests__/geminiGatewayManager.test.ts',text,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'owner-fixture-correction-01.md'),'Registration fixture corrected to the established soterai.advancedCommands menu gate after inspecting both current manifests. Original missing-owner/manifest baseline14FAIL remains unchanged. New restore regression covers a resolving partial write retaining recovery receipt. Manager tests reuse only synthetic IPC plumbing; no native protection claim.\n',{flag:'wx'});
