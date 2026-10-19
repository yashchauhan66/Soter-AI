import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GatewayBoundary } from "../../../../apps/local-ai-broker/src/GatewayBoundary";
const body=JSON.parse(readFileSync(resolve(__dirname,"native-request-1.json"),"utf8"));
const variants=[{previous_response_id:"resp_public"},{background:true},{store:true},{stream:false},{include:["unknown"]},{input:[{type:"message",role:"user",content:[{type:"input_image",image_url:"http://127.0.0.1/image"}]}]},{input:[{type:"reasoning",encrypted_content:"opaque"}]},{tools:[{type:"web_search"}]},{tools:[{type:"function",name:"public",parameters:{},unknown:true}]},{client_metadata:{raw:{}}},{reasoning:{effort:"high",unknown:true}},{tool_choice:{type:"function",name:"other"}}];
for(let i=0;i<variants.length;i++){try{new GatewayBoundary({version:1,values:["TEST_ONLY_F20A_RESPONSES_REGISTERED_VALUE"],codexResponses:true}).prepareRequest("codex",{...body,...variants[i]});console.log(JSON.stringify({i,status:"ACCEPTED"}));}catch(e){console.log(JSON.stringify({i,code:(e as any).code,name:(e as any).constructor.name}));}}
