import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
const DATA="TEST_ONLY_F20A_RESPONSES_CLIENT",CONTROL="TEST_ONLY_F20A_RESPONSES_CONTROL",KEY="TEST_ONLY_F20A_RESPONSES_PROVIDER",VALUE="TEST_ONLY_F20A_RESPONSES_REGISTERED_VALUE";
const ROUTE="/v1/ai/openai-responses/responses";
const body=()=>JSON.parse(readFileSync(join(__dirname,"fixtures/codex-cli-0.160.1-request-2.json"),"utf8"));
const wire=()=>readFileSync(join(__dirname,"fixtures/codex-cli-0.160.1-output-2.sse.txt"),"utf8");
async function fixture(enabled:boolean,run:(url:string,records:any[],setOutput:(v:string)=>void)=>Promise<void>){
 const records:any[]=[];let output=wire();const provider=createServer((req,res)=>{let data="";req.on("data",b=>data+=b);req.on("end",()=>{records.push({path:req.url,headers:req.headers,body:JSON.parse(data)});res.setHeader("content-type","text/event-stream");res.end(output);});});
 await new Promise<void>(done=>provider.listen(0,"127.0.0.1",done));const address=provider.address();assert.ok(address&&typeof address!=="string");
 const broker=new BrokerServer({token:DATA,controlToken:CONTROL,port:0,providerApiKey:KEY,codexResponsesProviderUrl:"http://127.0.0.1:"+address.port+"/v1/responses",registeredValues:[VALUE],gatewayPolicy:true,codexResponses:enabled} as never);
 // Fixture drain runs only after the broker has finished its decision. It cannot bypass its body reader or scan.
 (broker as any).server.on("request",(req:any,res:any)=>res.once("finish",()=>req.resume()));
 const {url}=await broker.start();try{await run(url,records,v=>output=v);}finally{await broker.stop();await new Promise<void>(done=>{provider.close(()=>done());provider.closeIdleConnections();});}
}
async function post(url:string,value=body(),route=ROUTE,auth=DATA){const r=await fetch(url+route,{method:"POST",headers:{authorization:"Bearer "+auth,"content-type":"application/json",connection:"close","x-client-ignored":VALUE},body:JSON.stringify(value)});return{status:r.status,text:await r.text(),headers:r.headers};}
test("F20A Responses exact owned capability acknowledgment",async()=>fixture(true,async url=>{const r=await fetch(url+"/v1/gateway/status",{headers:{authorization:"Bearer "+CONTROL}});assert.equal((await r.json() as any).codexResponses,true);}));
test("F20A Responses adjacent public request reaches only configured target with upstream-only auth",async()=>fixture(true,async(url,records)=>{const r=await post(url);assert.equal(r.status,200);assert.equal(r.text,wire());assert.equal(r.headers.get("x-soterai-stream-buffered"),"1");assert.equal(records.length,1);assert.equal(records[0].path,"/v1/responses");assert.equal(records[0].headers.authorization,"Bearer "+KEY);assert.equal(records[0].headers["x-client-ignored"],undefined);assert.deepEqual(records[0].body,body());}));
test("F20A Responses registered context and encoded tool output send zero provider requests",async()=>fixture(true,async(url,records)=>{for(const value of[VALUE,Buffer.from(VALUE).toString("base64")]){const b=body();b.input.at(-1).output[0].text=value;const r=await post(url,b);assert.equal(r.status,422);assert.match(r.text,/gateway_sensitive/);}assert.equal(records.length,0);}));
test("F20A Responses protected provider output is withheld completely",async()=>fixture(true,async(url,records,setOutput)=>{setOutput(wire().replaceAll("F20_SYNTHETIC_DONE",VALUE));const r=await post(url);assert.equal(r.status,422);assert.equal(records.length,1);assert.ok(!r.text.includes(VALUE));assert.match(r.text,/gateway_output_withheld/);}));
test("F20A Responses query/unknown route/invalid auth never forward",async()=>fixture(true,async(url,records)=>{for(const route of[ROUTE+"?raw=1",ROUTE+"/other","/v1/ai/openai-responses/models"])assert.ok((await post(url,body(),route)).status>=400);assert.equal((await post(url,body(),ROUTE,"wrong")).status,401);assert.equal(records.length,0);}));
test("F20A Responses disabled adapter never forwards",async()=>fixture(false,async(url,records)=>{assert.ok((await post(url)).status>=400);assert.equal(records.length,0);}));
