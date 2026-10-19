const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
let text=fs.readFileSync(path.join(base,"probe-vendor-09.cjs"),"utf8");
for(const name of["native-tool-schemas","native-controls","vendor-feasibility"])text=text.split(name+"-09.json").join(name+"-10.json");
const anchor="const text=body.toString('utf8'),parsed=JSON.parse(text);";assert.equal(text.split(anchor).length,2);
text=text.replace(anchor,anchor+[
 'let ordinaryStrings=0;const count=value=>{if(typeof value==="string")ordinaryStrings++;else if(Array.isArray(value))value.forEach(count);else if(value&&typeof value==="object")Object.values(value).forEach(count);};',
 'for(const[key,value]of Object.entries(parsed))if(key!=="tools")count(value);',
 'const conversationShape=(parsed.messages||[]).map(message=>({fields:Object.keys(message).sort(),role:["user","assistant"].includes(message.role)?message.role:"OTHER",contentType:typeof message.content,parts:Array.isArray(message.content)?message.content.map(part=>({type:["text","tool_use","tool_result"].includes(part.type)?part.type:"OTHER",fields:Object.keys(part).sort(),inputFields:part.input&&typeof part.input==="object"?Object.keys(part.input).sort():undefined,nestedParts:Array.isArray(part.content)?part.content.map(p=>({type:["text","tool_use","tool_result"].includes(p.type)?p.type:"OTHER",fields:Object.keys(p).sort()})):undefined})):undefined}));'
].join("\n"));
const fields="fields:Object.keys(parsed).sort(),publicHeaders:";assert.equal(text.split(fields).length,2);text=text.replace(fields,"ordinaryStrings,conversationShape,"+fields);
text=text.split("PASS_SCOPED_NATIVE_EFFORT_METADATA").join("PASS_SCOPED_NATIVE_CONVERSATION_METADATA");
fs.writeFileSync(path.join(base,"probe-vendor-10.cjs"),text,{flag:"wx"});
console.log("Prepared one actual native public Read conversation metadata probe; no prompt/source dump.");
