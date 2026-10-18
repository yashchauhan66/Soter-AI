import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync, deflateRawSync, gzipSync } from "node:zlib";
import { decodeBoundedDeflate } from "../../../../apps/local-ai-broker/src/BoundedDeflate";
const bytes=Buffer.from('{"messages":[{"role":"user","content":"Public br 🙂"}]}'),wire=deflateSync(bytes);
test("F15d-D01 complete zlib deflate returns exact public Unicode bytes",async()=>assert.deepEqual(await decodeBoundedDeflate(wire),bytes));
for(const cut of [0,1,Math.floor(wire.length/2),wire.length-1])test("F15d-D02 truncated stream refuses "+cut,async()=>assert.rejects(decodeBoundedDeflate(wire.subarray(0,cut))));
for(const tail of [Buffer.from([0]),Buffer.from([1,2]),deflateSync(Buffer.alloc(0)),wire])test("F15d-D03 trailing or concatenated streams refuse "+tail.length,async()=>assert.rejects(decodeBoundedDeflate(Buffer.concat([wire,tail]))));
test("F15d-D04 invalid bitstream refuses",async()=>assert.rejects(decodeBoundedDeflate(Buffer.from([255,255,255,255]))));
test("F15d-D05 exact tighter byte budget accepted, overflow refused",async()=>{const size=Math.max(wire.length,bytes.length);assert.deepEqual(await decodeBoundedDeflate(wire,{maxBytes:size}),bytes);await assert.rejects(decodeBoundedDeflate(wire,{maxBytes:wire.length-1}));const data=Buffer.from(Array.from({length:100},(_,i)=>'public-entry-'+i).join(',')),encoded=deflateSync(data);assert.deepEqual(await decodeBoundedDeflate(encoded,{maxBytes:data.length}),data);await assert.rejects(decodeBoundedDeflate(encoded,{maxBytes:data.length-1}));});
test("F15d-D06 high expansion refuses before returning data",async()=>assert.rejects(decodeBoundedDeflate(deflateSync(Buffer.alloc(100000,65)))));
test("F15d-D07 invalid limits and bounded errors",async()=>{for(const maxBytes of [0,-1,NaN,Infinity,1048577])await assert.rejects(decodeBoundedDeflate(wire,{maxBytes}));try{await decodeBoundedDeflate(Buffer.from('synthetic-private-no-echo'));assert.fail();}catch(error){assert.ok(!String(error).includes('synthetic-private-no-echo'));}});

for(const [name,data] of [["raw",deflateRawSync(bytes)],["gzip",gzipSync(bytes)],["dictionary",deflateSync(bytes,{dictionary:Buffer.from("synthetic-public-dictionary")})]] as const)test("F15d-D08 rejects wrong wrapper or preset dictionary "+name,async()=>assert.rejects(decodeBoundedDeflate(data)));
