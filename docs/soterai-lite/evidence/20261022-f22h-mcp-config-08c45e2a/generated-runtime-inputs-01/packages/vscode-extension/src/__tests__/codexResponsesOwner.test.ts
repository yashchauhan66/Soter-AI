import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { CodexCliAdapter } from "../adapters/CodexCliAdapter";
import { renderCodexCliProfile } from "../adapters/CodexCliAdapterPolicy";
const session="c9999999-9999-4999-8999-999999999999",credential="d".repeat(64),endpoint="http://127.0.0.1:49155/codex";
const connection={endpoint:"http://127.0.0.1:49156/codex/mcp",token:"e".repeat(64),session};
test("F20A owner renderer routes the new dedicated home through its exact local Responses capability",()=>{
 const config=(renderCodexCliProfile as any)(connection,{endpoint,token:credential,session});
 assert.match(config,/model_provider = "soterai_gateway"/);assert.ok(config.includes('base_url = "'+endpoint+'"'));assert.ok(config.includes('Bearer '+credential));
 assert.match(config,/supports_websockets = false/);assert.match(config,/request_max_retries = 0/);assert.match(config,/wire_api = "responses"/);assert.match(config,/shell_tool = false/);
});
test("F20A owner renderer rejects remote/malformed provider capabilities",()=>{
 for(const gateway of[{endpoint:"https://example.invalid/v1",token:credential,session},{endpoint:endpoint+"?raw=1",token:credential,session},{endpoint,token:"bad",session},{endpoint,token:credential,session:"other"},{endpoint,token:credential,session,extra:true}])assert.throws(()=>(renderCodexCliProfile as any)(connection,gateway));
});
async function fixture(t:import("node:test").TestContext,ack=true,running=true){
 const root=await mkdtemp(join(tmpdir(),"soterai-f20a-gateway-owner-")),project=join(root,"project"),profile=join(root,"profile");await mkdir(project);await mkdir(profile);stub.resetState(project);
 const context=stub.makeExtensionContext(profile);let current=session,starts=0,reads=0;
 const manager={async start(){starts++;return{running,state:running?"healthy":"stopped",url:"http://127.0.0.1:49155"};},ownedSnapshot(){return{state:"healthy",session:current,port:49155};},async getClientToken(){return credential;},async status(){return{running,state:"healthy"};},async request(){return{version:1,enabled:true,ready:true,codexResponses:ack};}};
 const adapter=new (CodexCliAdapter as any)(context,{isEnabled:()=>true,async readIntegration(){reads++;return{status:"ALLOWED_ONCE",text:"Public"};}},manager) as CodexCliAdapter;
 t.after(()=>adapter.dispose());t.mock.method(adapter as any,"artifact",async()=>undefined);t.mock.method(adapter as any,"artifactCurrent",async()=>true);
 t.mock.method(stub.window,"showWarningMessage",async(_m:string,_o:unknown,action:string)=>action);
 return{adapter,context,starts:()=>starts,reads:()=>reads,drift(){current="b9999999-9999-4999-8999-999999999999";}};
}
test("F20A owner configure requires exact current broker capability and masks both credentials",async t=>{
 const f=await fixture(t);const details:string[]=[];t.mock.method(stub.window,"showWarningMessage",async(_m:string,o:any,action:string)=>{details.push(o.detail);return action;});
 const result=await f.adapter.configure() as any;assert.equal(result.status,"APPLIED");assert.equal(f.starts(),1);assert.equal(f.reads(),0);assert.equal(result.badge,"Uncovered");
 const config=await readFile(join(result.profileDirectory,"config.toml"),"utf8");assert.match(config,/base_url = "http:\/\/127\.0\.0\.1:\d+\/codex"/);assert.ok(!config.includes(credential));assert.ok(!details.join().includes(credential));
 assert.equal((await f.adapter.undo() as any).status,"RESTORED");
});
for(const[ack,running]of[[false,true],[true,false]])test("F20A owner unavailable broker/schema refuses configuration "+ack+"/"+running,async t=>{
 const f=await fixture(t,ack,running);assert.equal((await f.adapter.configure() as any).status,"UNAVAILABLE");assert.equal(f.reads(),0);
});
test("F20A owner broker replacement withdraws live profile without deleting it",async t=>{
 const f=await fixture(t),result=await f.adapter.configure() as any;assert.equal(result.status,"APPLIED");const file=join(result.profileDirectory,"config.toml"),before=await readFile(file,"utf8");
 f.drift();assert.equal((f.adapter.status() as any).status,"UNAVAILABLE");assert.equal(await readFile(file,"utf8"),before);assert.equal((await f.adapter.undo() as any).status,"RESTORED");
});
