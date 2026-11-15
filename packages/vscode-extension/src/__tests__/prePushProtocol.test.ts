import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
const id = (n = 1) => n.toString(16).padStart(40, "0"), zero = "0".repeat(40);
const line = (local = "refs/heads/main", oid = id(), remote = "refs/heads/main", old = zero) => Buffer.from(`${local} ${oid} ${remote} ${old}\n`);
const api = () => import("../history-hooks/PrePushProtocol");
test("F26b accepts complete public creation and update metadata with frozen copies", async () => {
    const { parsePrePushTranscript } = await api(), raw = Buffer.concat([line(), line("HEAD~1", id(2), "refs/heads/other", id(3))]);
    const value = parsePrePushTranscript(raw); assert(value); assert.equal(value.length, 2); assert.equal(value[0].localOid, id());
    assert.equal(value[1].localRef, "HEAD~1"); assert.equal(value[0].deletion, false); assert(Object.isFrozen(value) && Object.isFrozen(value[0])); raw.fill(0); assert.equal(value[0].localOid, id());
});
test("F26b accepts empty and exact deletion transcripts without granting authority", async () => {
    const { parsePrePushTranscript } = await api(); assert.deepEqual(parsePrePushTranscript(Buffer.alloc(0)), []);
    assert.equal(parsePrePushTranscript(line("(delete)", zero, "refs/heads/main", id()))?.[0].deletion, true);
});
test("F26b enforces coherent deletion semantics", async () => {
    const { parsePrePushTranscript: p } = await api(); for (const x of [line("(delete)"), line("main", zero, "refs/heads/main", id()), line("(delete)", zero), line("(delete)", id(), "refs/heads/main", id())]) assert.equal(p(x), undefined);
});
test("F26b requires exact complete LF framing and four single-space fields", async () => {
    const { parsePrePushTranscript: p } = await api(), raw = line(); for (const x of [raw.subarray(0,-1),Buffer.concat([raw,Buffer.from("\n")]),Buffer.concat([raw,Buffer.from("partial")]),Buffer.from(raw.toString().replace(" ","  ")),Buffer.from(raw.toString().replace(" ","\t")),Buffer.from(raw.toString().replace("\n","\r\n")),Buffer.concat([raw,Buffer.from([0])])]) assert.equal(p(x),undefined);
});
test("F26b rejects noncanonical SHA1, SHA256 and invalid object fields", async () => {
    const { parsePrePushTranscript:p }=await api();for(const x of [id().toUpperCase().replace(/1$/,"A"),"a".repeat(64),"a".repeat(39),"z".repeat(40),"-".repeat(40)]){assert.equal(p(line("HEAD",x)),undefined);assert.equal(p(line("HEAD",id(),"refs/heads/main",x)),undefined);}
});
test("F26b permits inert detached source expressions and Unicode branch metadata", async () => {
    const {parsePrePushTranscript:p}=await api();for(const source of ["HEAD","HEAD~2",id(),"refs/heads/हिन्दी","@{1}"]){assert.equal(p(line(source,id(),"refs/heads/public-é"))?.[0].localRef,source);}
});
test("F26b refuses invalid or unsupported destination refs",async()=>{
    const {parsePrePushTranscript:p}=await api();for(const dest of ["main","HEAD","refs/tags/v1","refs/heads/","refs/heads/a..b","refs/heads/.hidden","refs/heads/a.lock","refs/heads/a/","refs/heads/a//b","refs/heads/a@{1}","refs/heads/a~1","refs/heads/a?b","refs/heads/a\\b","refs/heads/a:b","refs/heads/a.","refs/heads/-a"])assert.equal(p(line("HEAD",id(),dest)),undefined,dest);
});
test("F26b refuses duplicate, case and normalization destination aliases as a whole",async()=>{
    const {parsePrePushTranscript:p}=await api();for(const dest of ["refs/heads/main","refs/heads/MAIN"]){assert.equal(p(Buffer.concat([line(),line("HEAD",id(2),dest)])),undefined);}
    assert.equal(p(Buffer.concat([line("HEAD",id(),"refs/heads/é"),line("HEAD",id(2),"refs/heads/e\u0301")])),undefined);
});
test("F26b accepts exactly32 updates and rejects the33rd sentinel",async()=>{
    const {parsePrePushTranscript:p}=await api();const rows=Array.from({length:33},(_,i)=>line("HEAD",id(i+1),"refs/heads/b"+i));assert.equal(p(Buffer.concat(rows.slice(0,32)))?.length,32);assert.equal(p(Buffer.concat(rows)),undefined);
});
test("F26b refuses overlong source/ref fields and input budgets",async()=>{
    const {parsePrePushTranscript:p}=await api();assert.equal(p(line("a".repeat(1025))),undefined);assert.equal(p(line("HEAD",id(),"refs/heads/"+"a".repeat(1025))),undefined);assert.equal(p(Buffer.alloc(32769,32)),undefined);
});
test("F26b rejects malformed UTF8, BOM, control and invisible fields",async()=>{
    const {parsePrePushTranscript:p}=await api();for(const x of [Buffer.from([255]),Buffer.concat([Buffer.from("\uFEFF"),line()]),line("HEAD\u202e"),line("HEAD\0"),line("HEAD",id(),"refs/heads/a\u200b"),line("HEAD",id(),"refs/heads/a b")])assert.equal(p(x),undefined);
});
test("F26b cannot release a valid prefix before a later malformed update",async()=>{
    const {parsePrePushTranscript:p}=await api();for(const tail of ["x\n","HEAD "+id()+" refs/heads/evil "+zero+" EXTRA\n","(delete) "+zero+" refs/heads/main "+zero+"\n"])assert.equal(p(Buffer.concat([line(),Buffer.from(tail)])),undefined);
});
test("F26b rejects proxies and lookalikes without executing coercion or property traps",async()=>{
    const {parsePrePushTranscript:p}=await api();let traps=0;const proxy=new Proxy(line(),{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});for(const x of [proxy,new Uint8Array(line()),{toString(){traps++;throw Error();}},null,undefined])assert.equal(p(x as Buffer),undefined);assert.equal(traps,0);
});
test("F26b copies native Buffer bytes without invoking overridden instance methods",async()=>{
    const {parsePrePushTranscript:p}=await api(),raw=line();let traps=0;Object.defineProperty(raw,"toString",{value(){traps++;throw Error();}});Object.defineProperty(raw,"length",{get(){traps++;throw Error();}});assert.equal(p(raw)?.length,1);assert.equal(traps,0);
});
test("F26b transcript digest binds exact admitted bytes and rejects malformed input",async()=>{
    const {prePushTranscriptDigest:d}=await api();assert.equal(d(line()),createHash("sha256").update(line()).digest("hex"));assert.notEqual(d(line()),d(line("HEAD")));assert.equal(d(Buffer.from("invalid")),undefined);
});
test("F26b bounded arbitrary framing never throws or admits an invalid suffix",async()=>{
    const {parsePrePushTranscript:p}=await api();let state=0x12345678;for(let i=0;i<128;i++){const raw=Buffer.alloc(i);for(let j=0;j<raw.length;j++){state=(Math.imul(state,1664525)+1013904223)>>>0;raw[j]=state&255;}assert.doesNotThrow(()=>p(raw));if(i)assert.equal(p(Buffer.concat([line(),raw])),undefined);}
});
