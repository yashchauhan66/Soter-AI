import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
const options={skip:process.platform!=="win32",timeout:15000},id=(n=1)=>n.toString(16).padStart(40,"0"),zero="0".repeat(40);
const secret="sk-proj-"+"SYNTHETIC_F07_PROVIDER_ONLY_VALUE".repeat(2);
type Row={source:string;oid:string;size:number;raw:Buffer};
const file=(source:string,text:string|Buffer):Row=>{const raw=Buffer.from(text),oid=createHash("sha1").update("blob "+raw.length+"\0").update(raw).digest("hex");return {source,oid,size:raw.length,raw};};
type Op={kind:string;oid?:string;objects?:readonly {oid:string;size:number}[]};
type Outcome={status:"COMPLETE";bytes:Buffer}|{status:"UNAVAILABLE"|"STOP_UNCONFIRMED"};
class Fake {
 readonly closed:Promise<void>;private done!:()=>void;private reply!:(x:Outcome)=>void;private outcome:Promise<Outcome>;busy=false;withdrawals=0;
 constructor(readonly operation:Op,readonly raw:Buffer,readonly hold:boolean){this.closed=new Promise(r=>this.done=r);this.outcome=new Promise(r=>this.reply=r);}
 start(){this.busy=true;if(!this.hold)queueMicrotask(()=>this.finish());return this.outcome;}
 early(){this.reply({status:"COMPLETE",bytes:Buffer.from(this.raw)});}
 finish(){this.busy=false;this.reply({status:"COMPLETE",bytes:Buffer.from(this.raw)});this.done();}
 withdraw(){this.withdrawals++;this.reply({status:"STOP_UNCONFIRMED"});}
}
interface Settings {commits?:string[];trees?:Map<string,Row[]>;raw?:Buffer;hold?:string;response?:(op:Op,raw:Buffer)=>Buffer;valid?:()=>boolean;now?:()=>number;deadline?:number;refs?:unknown}
async function fixture(rows:Row[]=[file("public.txt","Useful public example.\n")],settings:Settings={}){
 const api=await import("../history-hooks/PrePushScan"),caps=await import("../history-hooks/CheckedPushRefs");
 const root=await mkdtemp(join(tmpdir(),"soter-f26b-scan-"));for(const p of ["objects/info","objects/pack","refs/heads"])await mkdir(join(root,".git",p),{recursive:true});
 await writeFile(join(root,".git/config"),"[core]\n repositoryformatversion = 0\n bare = false\n",{flag:"wx"});await writeFile(join(root,".git/HEAD"),"ref: refs/heads/main\n",{flag:"wx"});
 const raw=settings.raw??Buffer.from(`refs/heads/main ${id()} refs/heads/main ${zero}\n`);
 const genuine=await caps.prepareCheckedPushRefs(root,raw,{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMSPEC:process.env.COMSPEC},()=>true);assert(genuine);
 const commits=settings.commits??[id()],trees=settings.trees??new Map([[id(),rows]]),all=new Map<string,Row>();for(const entries of trees.values())for(const row of entries)all.set(row.oid,row);
 const calls:Fake[]=[];
 const scan=new api.PrePushScan({refs:(settings.refs??genuine) as any,valid:settings.valid??(()=>true),now:settings.now??(()=>1000),deadline:settings.deadline??61000,
 createProcess:({operation}:any)=>{const op=operation as Op;let result:Buffer;
 if(op.kind==="version")result=Buffer.from("git version 2.53.0.windows.1\n");
 else if(op.kind==="commits")result=Buffer.from(commits.length?commits.join("\n")+"\n":"");
 else if(op.kind==="tree")result=Buffer.from((trees.get(op.oid!)??[]).map(r=>`100644 blob ${r.oid} ${r.size}\t${r.source}\0`).join(""));
 else {assert.equal(op.kind,"batch");result=Buffer.concat(op.objects!.flatMap(o=>{const row=all.get(o.oid);assert(row);return[Buffer.from(`${o.oid} blob ${row.size}\n`),row.raw,Buffer.from("\n")];}));}
 const child=new Fake(op,settings.response?.(op,result)??result,op.kind===settings.hold);calls.push(child);return child;}});
 return{scan,calls,root,genuine};
}
async function result(f:Awaited<ReturnType<typeof fixture>>){const r=await f.scan.start();await f.scan.closed;assert.equal(f.scan.busy,false);return r;}
const tick=()=>new Promise<void>(r=>setImmediate(r));
test("F26b complete public proposed history permits only its held completed result",options,async()=>{const f=await fixture(),r=await result(f);assert.deepEqual(r,{status:"ALLOW"});assert(f.scan.canRelease(r));assert(!f.scan.canRelease({status:"ALLOW"}));assert.deepEqual(f.calls.map(c=>c.operation.kind),["version","commits","tree","batch"]);});
test("F26b historical secret remains blocked after the proposed tip was sanitized",options,async()=>{const old=file("old.txt",secret),pub=file("public.txt","Useful public example.");const f=await fixture([],{commits:[id(),id(2)],trees:new Map([[id(),[pub]],[id(2),[old]]])});assert.deepEqual(await result(f),{status:"BLOCK"});});
test("F26b merge-parent history cannot be omitted from the bounded scan",options,async()=>{const f=await fixture([],{commits:[id(),id(2),id(3)],trees:new Map([[id(),[file("main.txt","public")]],[id(2),[file("parent.txt","public")]],[id(3),[file("side.txt",secret)]]])});assert.equal((await result(f)).status,"BLOCK");assert.equal(f.calls.filter(c=>c.operation.kind==="tree").length,3);});
test("F26b unknown suffix or unsupported blob never yields a clean-prefix ALLOW",options,async()=>{const f=await fixture([file("public.txt","public"),file("unknown.xyz","ordinary")]);assert.equal((await result(f)).status,"UNAVAILABLE");});
test("F26b binary and malformed config withhold the whole proposed history",options,async()=>{for(const row of [file("public.txt",Buffer.from([0,1,2])),file("config.json",'{"secret":')])assert.equal((await result(await fixture([row]))).status,"UNAVAILABLE");});
test("F26b33-commit sentinel withholds instead of accepting the first32",options,async()=>{const f=await fixture([],{commits:Array.from({length:33},(_,i)=>id(i+1))});assert.equal((await result(f)).status,"UNAVAILABLE");assert(!f.calls.some(c=>c.operation.kind==="tree"));});
test("F26b traversal must contain every proposed nondeleted tip",options,async()=>{const f=await fixture([],{commits:[id(2)]});assert.equal((await result(f)).status,"UNAVAILABLE");});
test("F26b delete-only and empty transcripts avoid a fabricated object traversal",options,async()=>{for(const raw of [Buffer.alloc(0),Buffer.from(`(delete) ${zero} refs/heads/main ${id()}\n`)]){const f=await fixture([],{raw});assert.equal((await result(f)).status,"ALLOW");assert.deepEqual(f.calls.map(c=>c.operation.kind),["version"]);}});
test("F26b public history honors every separate path context of a shared object",options,async()=>{const raw="A harmless public value.\n",a=file("public.txt",raw),b=file("unsupported.xyz",raw);const f=await fixture([a,b]);assert.equal((await result(f)).status,"UNAVAILABLE");});
test("F26b oversized blob and total data budgets withhold without a batch read",options,async()=>{const f=await fixture([file("public.txt",Buffer.alloc(65537,65))]);assert.equal((await result(f)).status,"UNAVAILABLE");assert(!f.calls.some(c=>c.operation.kind==="batch"));});
test("F26b unknown tree modes and missing objects cannot be skipped",options,async()=>{const f=await fixture([],{response:(o,b)=>o.kind==="tree"?Buffer.from(`160000 commit ${id(4)} -\tsubmodule\0`):b});assert.equal((await result(f)).status,"UNAVAILABLE");});
test("F26b exact batch object SHA1 is verified before detector use",options,async()=>{const f=await fixture([file("public.txt","public")],{response:(o,b)=>o.kind==="batch"?Buffer.from(b.toString().replace("public","publiX")):b});assert.equal((await result(f)).status,"UNAVAILABLE");});
test("F26b unsupported Git version and malformed traversal framing fail closed",options,async()=>{for(const which of ["version","commits"]){const f=await fixture([],{response:(o,b)=>o.kind===which?Buffer.from(which==="version"?"git version 9.0.0\n":"truncated"):b});assert.equal((await result(f)).status,"UNAVAILABLE");}});
test("F26b caller-created capability objects launch no child",options,async()=>{const f=await fixture([],{refs:{available:()=>true}});assert.equal((await result(f)).status,"UNAVAILABLE");assert.equal(f.calls.length,0);});
test("F26b withdrawal retains pending ownership and prevents the next child",options,async()=>{const f=await fixture([],{hold:"commits"}),out=f.scan.start();for(let i=0;i<100&&!f.calls.some(c=>c.operation.kind==="commits");i++)await tick();const child=f.calls.at(-1)!;assert.equal(child.operation.kind,"commits");f.scan.withdraw();assert.equal((await out).status,"STOP_UNCONFIRMED");assert(f.scan.busy);let closed=false;void f.scan.closed.then(()=>closed=true);await tick();assert(!closed);child.finish();await f.scan.closed;assert.equal(f.calls.length,2);assert(!f.scan.busy);});
test("F26b premature COMPLETE cannot replace actual child closure",options,async()=>{const f=await fixture([],{hold:"commits"}),out=f.scan.start();for(let i=0;i<100&&f.calls.length<2;i++)await tick();const child=f.calls.at(-1)!;child.early();await tick();assert(f.scan.busy);assert.equal(f.calls.length,2);child.finish();assert.equal((await out).status,"ALLOW");await f.scan.closed;});
test("F26b post-result drift revokes held ALLOW and one-shot start cannot repeat",options,async()=>{let valid=true;const f=await fixture([],{valid:()=>valid}),r=await result(f);assert(f.scan.canRelease(r));valid=false;assert(!f.scan.canRelease(r));assert.equal((await f.scan.start()).status,"UNAVAILABLE");});
test("F26b scanner output contains status only, never original paths or values",options,async()=>{const f=await fixture([file("private-name.txt",secret)]),r=await result(f);assert.deepEqual(Object.keys(r),["status"]);assert(!JSON.stringify(r).includes(secret));assert(!JSON.stringify(r).includes("private-name"));});
