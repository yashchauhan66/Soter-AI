import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
const key=generateKeyPairSync("ed25519").publicKey.export({format:"der",type:"spki"}).toString("base64");
const raw=()=>Buffer.from(JSON.stringify({version:1,root:"C:\\Synthetic Repo",generation:"a1234567-1234-4567-8123-123456789abc",publicKey:key,worker:"C:\\Synthetic Extension\\pre-commit-client.js",workerSha256:"a".repeat(64),runtime:"C:\\Synthetic Code\\Code.exe",runtimeSha256:"b".repeat(64),descriptor:"C:\\Synthetic Profile\\pre-push\\endpoint.json",systemRoot:"C:\\Windows"}));
const api=()=>import("../history-hooks/PrePushHookText");
test("F26b absent-hook wrapper uses fixed scrubbed worker grammar and separate ownership marker",async()=>{
 const {buildPrePushHookText:b}=await api(),out=b(undefined,raw());assert(out);const s=out.toString();assert(s.startsWith("#!/bin/sh\n# SoterAI Lite pre-push v1 "));assert(s.includes("'C:/Program Files/Git/usr/bin/env.exe' -i"));assert(s.includes("--pre-push --pin"));assert(s.includes("'ELECTRON_RUN_AS_NODE=1'"));assert(s.includes("'C:/Synthetic Code/Code.exe'"));assert(!s.includes("--index"));
});
test("F26b replays bounded input with a sentinel instead of unbounded shell reads",async()=>{
 const {buildPrePushHookText:b}=await api(),s=b(undefined,raw())!.toString();assert(s.includes("${SOTERAI_PRE_PUSH_REPLAY%.}"));assert(s.includes("command printf '%s'"));assert(s.includes("--replay"));assert(!/\b(?:cat|mktemp|tee)\b|eval |exec |\/tmp\//.test(s));
});
test("F26b preserves reviewed shell body once and isolates wrapper variables",async()=>{
 const {buildPrePushHookText:b}=await api(),body='command printf "%s" "$1"\nexit 7\n',out=b(Buffer.from("#!/bin/sh\n"+body),raw())!.toString();assert(out.endsWith(body+")\n"));assert.equal(out.split(body).length,2);assert(out.includes("unset SOTERAI_PRE_PUSH_REPLAY SOTERAI_PRE_PUSH_STATUS"));assert(out.includes('${SOTERAI_PRE_PUSH_REPLAY+x}'));
});
test("F26b refuses unknown shebang, BOM, binary and malformed UTF8 originals",async()=>{
 const {buildPrePushHookText:b}=await api();for(const before of [Buffer.from(""),Buffer.from("#!/bin/bash\n"),Buffer.from("#!/bin/sh\r\n"),Buffer.from("\uFEFF#!/bin/sh\n"),Buffer.from("#!/bin/sh\n\0"),Buffer.concat([Buffer.from("#!/bin/sh\n"),Buffer.from([255])])])assert.equal(b(before,raw()),undefined);
});
test("F26b refuses recursively owned, pre-commit-owned and oversized originals",async()=>{
 const {buildPrePushHookText:b}=await api();for(const before of [b(undefined,raw())!,Buffer.from("#!/bin/sh\n# SoterAI Lite pre-commit v1 x\n"),Buffer.from("#!/bin/sh\n"+"#".repeat(65536))])assert.equal(b(before,raw()),undefined);
});
test("F26b public pin validation never accepts a partial or noncanonical pin",async()=>{
 const {buildPrePushHookText:b}=await api();for(const pin of [Buffer.from("{}"),Buffer.concat([raw(),Buffer.from("\n")]),Buffer.from([255]),Buffer.alloc(12289)])assert.equal(b(undefined,pin),undefined);
});
test("F26b owned wrapper emits only a fixed refusal and retains original buffer",async()=>{
 const {buildPrePushHookText:b}=await api(),before=Buffer.from("#!/bin/sh\nexit 0\n"),copy=Buffer.from(before);const out=b(before,raw())!;assert.deepEqual(before,copy);assert(out.toString().includes("SoterAI: Push withheld. Open the owning editor or review pre-push status."));assert(!out.toString().includes("process.env"));
});
test("F26b wrapper quotes apostrophes in validated native pin paths",async()=>{
 const {buildPrePushHookText:b}=await api(),pin=JSON.parse(raw().toString());pin.runtime="C:\\Synthetic O'wner\\Code.exe";const out=b(undefined,Buffer.from(JSON.stringify(pin)));assert(out);assert(out.toString().includes("O'\"'\"'wner"));
});
