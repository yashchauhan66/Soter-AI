import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { beforeEach,test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import * as stub from "./phase2/vscode-stub";
import { BrokerManager } from "../broker/BrokerManager";
beforeEach(()=>stub.resetState("D:/SoterAI-Lite-test-profiles/f16-manager-memory-only"));
function fixture(extra:{forcedLevel?:string;wrongAck?:boolean;registryFailure?:boolean;version?:number;clineAck?:unknown}={}){
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
        if(route==="/v1/gateway/status")return Response.json({version:extra.version??1,enabled:envs.at(-1)?.SOTERAI_GATEWAY_POLICY!=="0",ready:true,generation,claudeToolSchemas:envs.at(-1)?.SOTERAI_CLAUDE_TOOL_SCHEMAS==="1",clineToolSchemas:Object.hasOwn(extra,"clineAck")?extra.clineAck:envs.at(-1)?.SOTERAI_CLINE_TOOL_SCHEMAS==="1"});
        return Response.json({version:"0.2.0"});
    }};
    const manager=new BrokerManager(context as never,transport as never,source as never);
    return{manager,context,envs,routes,source,setMode:(value:typeof mode)=>{mode=value;},stale:()=>{registryAlive=false;},syncCount:()=>syncCount};
}
test("F16-M01 valid but wrong enterprise startup policy cannot be healthy",async()=>{const f=fixture({forcedLevel:"strict"});f.context._inspect.globalStore.set("soterai.safeMode",{enabled:true,level:"enterprise"});try{await assert.rejects(f.manager.start());assert.notEqual(f.manager.ownedSnapshot().state,"healthy");}finally{await f.manager.stop();}});
test("F16-M02 valid runtime policy downgrade withdraws owner",async()=>{const f=fixture();try{await f.manager.start();f.setMode({enabled:false,level:"developer"});assert.equal((await f.manager.status()).running,false);assert.notEqual(f.manager.ownedSnapshot().state,"healthy");}finally{await f.manager.stop();}});
test("F16-M03 saved mode drift revokes prior generation",async()=>{const f=fixture();try{await f.manager.start();f.context._inspect.globalStore.set("soterai.safeMode",{enabled:true,level:"enterprise"});await assert.rejects(f.manager.request("/version"));}finally{await f.manager.stop();}});
test("F16-M04 wrong mode enable acknowledgment is not ignored",async()=>{const f=fixture({wrongAck:true});try{await assert.rejects(f.manager.start());}finally{await f.manager.stop();}});
test("F16-M05 default machine flag reaches child and complete registry sync",async()=>{const f=fixture();try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_GATEWAY_POLICY,"1");assert.equal(f.syncCount(),1);assert.ok(f.routes.indexOf("/v1/safe-mode/enable")<f.routes.indexOf("/v1/gateway/sync"));}finally{await f.manager.stop();}});
test("F16-M06 unavailable private registry fails before child launch",async()=>{const f=fixture({registryFailure:true});try{await assert.rejects(f.manager.start());assert.equal(f.envs.length,0);}finally{await f.manager.stop();}});
test("F16-M07 stale registry source cannot retain request authority",async()=>{const f=fixture();try{await f.manager.start();f.stale();await assert.rejects(f.manager.request("/version"));}finally{await f.manager.stop();}});
test("F16-M08 unknown gateway policy version never becomes healthy",async()=>{const f=fixture({version:2});try{await assert.rejects(f.manager.start());}finally{await f.manager.stop();}});
test("F16-M09 machine disable ignores repository override",async()=>{const f=fixture();stub.state.configInspect.set("soterai.lite.gatewayPolicy",{defaultValue:true,globalValue:false,workspaceValue:true});try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_GATEWAY_POLICY,"0");}finally{await f.manager.stop();}});

test("F18 rich tool-schema profile is bound to the owned child and machine setting",async()=>{const f=fixture();try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_CLINE_TOOL_SCHEMAS,"1");assert.equal((await f.manager.status()).running,true);}finally{await f.manager.stop();}});
test("F18 disabling the machine adapter withdraws the schema profile despite a workspace override",async()=>{const f=fixture();stub.state.configInspect.set("soterai.lite.clineAdapter",{defaultValue:true,globalValue:false,workspaceValue:true});try{await f.manager.start();assert.equal(f.envs[0].SOTERAI_CLINE_TOOL_SCHEMAS,"0");}finally{await f.manager.stop();}});
for(const clineAck of [false,"true"])test("F18 missing or mismatched schema capability acknowledgment is unavailable "+String(clineAck),async()=>{const f=fixture({clineAck});try{await assert.rejects(f.manager.start());assert.notEqual(f.manager.ownedSnapshot().state,"healthy");}finally{await f.manager.stop();}});
