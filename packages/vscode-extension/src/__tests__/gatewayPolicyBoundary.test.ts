import assert from "node:assert/strict";
import { test } from "node:test";
import { GatewayBoundary } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const VALUE="synthetic_registry_f16_token_value", chat=(content:unknown="Public arithmetic")=>({model:"synthetic",messages:[{role:"user",content}]}),json=(value:unknown)=>Buffer.from(JSON.stringify(value));
const boundary=(values=[VALUE],extra={})=>new GatewayBoundary({values,version:1,enabled:true,...extra});
test("F16-P01 public immutable request preserves supported options",()=>{
    const body={...chat(),temperature:0.2,tools:[{type:"function",function:{name:"sum",parameters:{type:"object"}}}]};
    const result=boundary().prepareRequest("openai",body);assert.deepEqual(JSON.parse(result.canonical),body);assert.ok(Object.isFrozen(result.body.messages));assert.equal(JSON.stringify(boundary()),"{}");
});
for(const value of [VALUE,Buffer.from(VALUE).toString("base64"),Buffer.from(VALUE).toString("base64url"),Buffer.from(VALUE).toString("hex"),encodeURIComponent(VALUE),JSON.stringify(VALUE)])test("F16-P02 registered representation refuses "+value.length,()=>assert.throws(()=>boundary().prepareRequest("openai",chat(value))));
test("F16-P03 ordered content joins detect registered fragments across roles/messages",()=>{
    const body={model:"synthetic",messages:[{role:"user",content:VALUE.slice(0,9)},{role:"assistant",content:VALUE.slice(9,19)},{role:"user",content:VALUE.slice(19)}]};assert.throws(()=>boundary().prepareRequest("openai",body));
});
test("F16-P04 provider patterns and fixed entropy controls with public negatives",()=>{
    const high="Aa0Bb1Cc2Dd3Ee4Ff5Gg6Hh7Ii8Jj9Kk";
    for(const content of ["sk-proj-"+"SYNTHETIC_F16_PROVIDER".repeat(5),"service_token="+high])assert.throws(()=>boundary([]).prepareRequest("openai",chat(content)));
    for(const content of [high,"public_url=https://public.invalid/"+high])assert.ok(boundary([]).prepareRequest("openai",chat(content)).body);
    assert.ok(boundary([]).prepareRequest("openai",chat("a".repeat(100))).body);
});
test("F16-P05 unknown schemas and auth/URL overrides refuse",()=>{
    for(const body of [{...chat(),api_key:"public-override"},{...chat(),url:"https://public.invalid"},{...chat(),unknown:true},chat([{type:"image_url",image_url:{url:"https://public.invalid/image"}}]),{messages:[{role:"unknown",content:"public"}]}])assert.throws(()=>boundary().prepareRequest("openai",body));
    assert.ok(boundary().prepareRequest("anthropic",{model:"synthetic",max_tokens:100,system:"Public instructions",messages:[{role:"user",content:"Public input"}]}).body);
});
test("F16-P06 unavailable/unknown policy and invalid registry never degrade to empty",()=>{
    for(const extra of [{version:2},{enabled:false}])assert.throws(()=>boundary([VALUE],extra).prepareRequest("openai",chat()));
    for(const values of [[""],Array.from({length:129},(_,i)=>"synthetic_registered_value_"+i),["short"]])assert.throws(()=>boundary(values).prepareRequest("openai",chat()));
});
test("F16-P07 complete semantic/request bounds withhold",()=>{
    const metadata=Object.fromEntries(Array.from({length:33},(_,i)=>["key"+i,"public"]));assert.throws(()=>boundary().prepareRequest("openai",{...chat(),metadata}));
    assert.throws(()=>boundary().prepareRequest("openai",{messages:[{role:"user",content:"P".repeat(65500)},{role:"user",content:"P".repeat(65500)}],metadata:{public:"P".repeat(1000)}}));
});
test("F16-P08 output JSON semantics and raw boundaries withhold complete response",()=>{
    const clean=json({choices:[{message:{content:"Public output"}}]});assert.equal(boundary().inspectResponse("openai",[clean],false).wire,clean.toString());
    for(const body of [{choices:[{message:{content:VALUE}}]},{choices:[{message:{content:VALUE.slice(0,10)}},{message:{content:VALUE.slice(10)}}]},{metadata:{public:VALUE}}])assert.throws(()=>boundary().inspectResponse("openai",[json(body)],false));
});
test("F16-P09 finite SSE output waits for complete inspected stream",()=>{
    const frame=(text:string)=>'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n',clean=frame("Public stream")+'data: [DONE]\n\n';
    assert.equal(boundary().inspectResponse("openai",[Buffer.from(clean.slice(0,13)),Buffer.from(clean.slice(13))],true).wire,clean);
    const secret=frame(VALUE.slice(0,13))+frame(VALUE.slice(13))+'data: [DONE]\n\n';assert.throws(()=>boundary().inspectResponse("openai",[Buffer.from(secret)],true));
});
test("F16-P10 malformed/control/UTF8/output budget failures release nothing",()=>{
    for(const data of [Buffer.from([0xc0,0xaf]),Buffer.from('{"x":1,"x":2}'),Buffer.from('data: {"public":true}'),Buffer.alloc(131073,65),Buffer.from('\u001b[31m{}')])assert.throws(()=>boundary().inspectResponse("openai",[data],true));
    assert.throws(()=>boundary().inspectResponse("openai",Array.from({length:4097},()=>Buffer.from(" ")),false));
});
test("F16-P11 bounded seeded public/fragment controls",()=>{
    for(let i=1;i<=32;i++){const publicText="Public number "+i+" 🙂";assert.equal(JSON.parse(boundary().prepareRequest("openai",chat(publicText)).canonical).messages[0].content,publicText);const at=i%VALUE.length;assert.throws(()=>boundary().prepareRequest("openai",{messages:[{role:"user",content:VALUE.slice(0,at)},{role:"assistant",content:VALUE.slice(at)}]}));}
});
test("F16-P12 errors expose no input or registry contents",()=>{try{boundary().prepareRequest("openai",{...chat(),"synthetic-private-never-echo":VALUE});assert.fail();}catch(error){assert.ok(!String(error).includes(VALUE));assert.ok(!String(error).includes("synthetic-private-never-echo"));}});
test("F16-P13 bounded Anthropic tool use/results preserve public data and refuse unsupported blocks",()=>{
    const body={model:"synthetic",messages:[{role:"assistant",content:[{type:"tool_use",id:"tool_synthetic",name:"read_public",input:{path:"public.ts"}}]},{role:"user",content:[{type:"tool_result",tool_use_id:"tool_synthetic",content:[{type:"text",text:"Public result"}]}]}]};
    assert.deepEqual(JSON.parse(boundary().prepareRequest("anthropic",body).canonical),body);
    for(const part of [{type:"image",source:{url:"https://public.invalid"}},{type:"tool_use",id:"public",name:"public",input:{},unknown:true},{type:"tool_result",tool_use_id:"public",content:[{type:"image"}]}])assert.throws(()=>boundary().prepareRequest("anthropic",{messages:[{role:"assistant",content:[part]}]}));
});
