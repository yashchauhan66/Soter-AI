import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { beforeEach,test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import * as stub from "./phase2/vscode-stub";
import { BrokerManager } from "../broker/BrokerManager";
beforeEach(()=>stub.resetState("D:/SoterAI-Lite-test-profiles/f16-manager-memory-only"));
function fixture(extra:{forcedLevel?:string;wrongAck?:boolean;registryFailure?:boolean;version?:number;clineAck?:unknown;claudeAck?:unknown;geminiAck?:unknown}={}){
    const context=stub.makeExtensionContext("D:/SoterAI-Lite-test-profiles/f16-manager-memory-only/storage"),envs:NodeJS.ProcessEnv[]=[],routes:string[]=[];
    let mode={enabled:true,level:"strict"},registryAlive=true,generation="",syncCount=0;
    const source={async createGatewayRegistry(enabled:()=>boolean){if(extra.registryFailure)throw Error("Synthetic registry unavailable");return{available:()=>registryAlive&&enabled(),async use<T>(consume:(values:readonly string[])=>Promise<T>){assert.ok(registryAlive&&enabled());return consume([]);},dispose(){registryAlive=false;}};}};
    const transport={stopMs:40,launch:((_exe:string,_argv:string[],options:{env:NodeJS.ProcessEnv})=>{
        envs.push(options.env);const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),connected:true,send(value:unknown,cb?:(error:Error|null)=>void){cb?.(null);if((value as {type:string}).type==="SOTERAI_BROKER_STOP")setImmediate(()=>{child.stdout.end();child.stderr.end();child.emit("close",0);});return true;},kill(){assert.fail("No process signaling.");}});
        setImmediate(()=>child.emit("message",{type:"SOTERAI_BROKER_READY",version:1,session:options.env.SOTERAI_BROKER_SESSION,port:49154}));return child;
    }) as never,fetchImpl:async(input:unknown,init?:RequestInit)=>{
        const route=new URL(String(input)).pathname;routes.push(route);const body=init?.body?JSON.parse(String(init.body)):{};
        if(route==="/v1/lifecycle/status")return Response.json({session:new Headers(init?.headers).get("x-soterai-session"),version:"0.2.0",ready:true});
        if(route==="/v1/canaries/sync")return Response.json({synchronized:true,count:body.canaries.length});
        if(route==="/v1/safe-mode/enable"){mode={enabled:true,level:body.level};return Response.json(extra.wrongAck?{enabled:true,level:"developer"}:mode);}
        if(route==="/v1/safe-mode/disable"){mode={...mode,enabled:false};return Response.json(mode);}
        if(route==="/v1/safe-mode/status")return Response.json({...mode,...(extra.forcedLevel?{level:extra.forcedLevel}:{})});
        if(route==="/v1/gateway/sync"){generation=body.generation;syncCount++;return Response.json({version:1,synchronized:true,generation});}
        if(route==="/v1/gateway/status")return Response.json({version:extra.version??1,enabled:envs.at(-1)?.SOTERAI_GATEWAY_POLICY!=="0",ready:true,generation,geminiGenerateContent:Object.hasOwn(extra,"geminiAck")?extra.geminiAck:envs.at(-1)?.SOTERAI_GEMINI_GENERATE_CONTENT==="1",codexResponses:envs.at(-1)?.SOTERAI_CODEX_RESPONSES==="1",claudeToolSchemas:Object.hasOwn(extra,"claudeAck")?extra.claudeAck:envs.at(-1)?.SOTERAI_CLAUDE_TOOL_SCHEMAS==="1",clineToolSchemas:Object.hasOwn(extra,"clineAck")?extra.clineAck:envs.at(-1)?.SOTERAI_CLINE_TOOL_SCHEMAS==="1"});
        return Response.json({version:"0.2.0"});
    }};
    const manager=new BrokerManager(context as never,transport as never,source as never);
    return{manager,context,envs,routes,source,setMode:(value:typeof mode)=>{mode=value;},stale:()=>{registryAlive=false;},syncCount:()=>syncCount};
}

test("F20C machine default binds Gemini capability and ignores repository upstream",async()=>{const f=fixture();stub.state.configInspect.set("soterai.broker.geminiProviderUrl",{defaultValue:"",globalValue:"http://127.0.0.1:31400",workspaceValue:"https://foreign.invalid"});try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_GEMINI_GENERATE_CONTENT,"1");assert.equal(f.envs[0].SOTERAI_GEMINI_PROVIDER_URL,"http://127.0.0.1:31400");}finally{await f.manager.stop();}});
test("F20C machine disable ignores repository enabling",async()=>{const f=fixture();stub.state.configInspect.set("soterai.lite.geminiCliAdapter",{defaultValue:true,globalValue:false,workspaceValue:true});try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_GEMINI_GENERATE_CONTENT,"0");}finally{await f.manager.stop();}});
for(const geminiAck of [false,"true",undefined])test("F20C absent/wrong Gemini acknowledgment withholds "+String(geminiAck),async()=>{const f=fixture({geminiAck});try{await assert.rejects(f.manager.start());assert.notEqual(f.manager.ownedSnapshot().state,"healthy");}finally{await f.manager.stop();}});
for(const variant of ["flag","base"])test("F20C "+variant+" drift revokes current broker lease",async()=>{const f=fixture();try{await f.manager.start();if(variant==="flag")stub.state.configInspect.set("soterai.lite.geminiCliAdapter",{defaultValue:true,globalValue:false});else stub.state.configInspect.set("soterai.broker.geminiProviderUrl",{defaultValue:"",globalValue:"http://127.0.0.1:31401"});await assert.rejects(f.manager.request("/version"));}finally{await f.manager.stop();}});
