import * as vscode from "vscode";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import nativeFs from "node:fs";
import * as path from "node:path";
import {createHash} from "node:crypto";
import type {ChildProcess} from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import * as center from "../20261028-f29-protection-center-6c93e15a/f29-native04.host";

const FLAG="lite.setupVerification",KEY="soterai.lite.setupVerification.v1",POLICY="soterai.aiForbidden.v1",PROFILE="soterai.lite.ps51.profile.v1";
const PRIVATE="FAKE_ONLY_F30_NATIVE_PRIVATE_9057e2b1",sha=(b:string|Buffer)=>createHash("sha256").update(b).digest("hex"),pause=(ms:number)=>new Promise(done=>setTimeout(done,ms));
interface Report {schemaVersion:number;binding:string;extensionSha256:string;brokerSha256:string;verifiedAt:string;checks:Array<{id:string;status:string;passed:number;total:number}>}
interface VerifyResult {status?:string;report?:{state?:string;report?:Report}}
interface Child {pid:number|undefined;closed:boolean;code:number|null;signal:string|null;stdoutEOF:boolean;stderrEOF:boolean;stdout:string;stderr:string}
const views=new Map<string,vscode.TreeDataProvider<any>>(),calls:Array<{argc:number;status:string;report?:Report}>=[],children:Child[]=[],restores:Array<()=>void>=[];
let context:vscode.ExtensionContext,output:string,phase:"primary"|"restart",storeFailure=false,storeWrites=0,diagnosticStage="before-activate";
export function patchFixtureMethod(target:object,key:string,value:unknown):()=>void {const d=Object.getOwnPropertyDescriptor(target,key);assert(!d||d.configurable===true);Object.defineProperty(target,key,{configurable:true,writable:true,enumerable:d?.enumerable??true,value});let active=true;return()=>{if(!active)return;active=false;if(Object.getOwnPropertyDescriptor(target,key)?.value!==value)return;if(d)Object.defineProperty(target,key,d);else Reflect.deleteProperty(target,key);};}
const patch=patchFixtureMethod;
export async function withRetainedRuntimeMutation(file:string,body:()=>Promise<void>):Promise<void>{
    const before=await fs.lstat(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=8*1024*1024);
    const original=file+".f30-original-retained",mutated=file+".f30-mutated-retained",raw=await fs.readFile(file);
    for(const target of [original,mutated])await assert.rejects(fs.lstat(target),(e:NodeJS.ErrnoException)=>e.code==="ENOENT");
    await fs.rename(file,original);
    try{await fs.writeFile(file,Buffer.concat([raw,Buffer.from("\n// synthetic F30 identity mismatch\n")]),{flag:"wx"});await body();}
    finally{
        let present=false;try{const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);present=true;}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
        if(present)await fs.rename(file,mutated);await fs.rename(original,file);assert.equal(sha(await fs.readFile(file)),sha(raw));
    }
}
async function until(check:()=>boolean|Promise<boolean>,label:string):Promise<void>{const end=Date.now()+15000;while(Date.now()<end){if(await check())return;await pause(30);}throw Error("F30 native observation deadline: "+label);}
const execute=<T=unknown>(name:string,...args:unknown[])=>Promise.resolve(vscode.commands.executeCommand<T>(name,...args));
const policyDigest=()=>sha(JSON.stringify(context.workspaceState.get(POLICY))),profileDigest=()=>sha(JSON.stringify(context.workspaceState.get(PROFILE)??null));
function report(value:unknown):Report {assert(value&&typeof value==="object");const r=value as Report;assert.equal(r.schemaVersion,1);for(const s of [r.binding,r.extensionSha256,r.brokerSha256])assert(/^[a-f0-9]{64}$/.test(s));assert.equal(r.checks.length,3);assert(Buffer.byteLength(JSON.stringify(r))<=8192);assert(!JSON.stringify(r).includes(PRIVATE));assert(!JSON.stringify(r).includes(context.extensionPath));assert(!JSON.stringify(r).includes(process.env.USERPROFILE!));return r;}
function passing(value:VerifyResult):Report {assert.equal(value.status,"OPENED");assert.equal(value.report?.state,"CURRENT");const r=report(value.report?.report);assert.deepEqual(r.checks.map(c=>[c.id,c.status,c.passed,c.total]),[["secret-matching","PASS",3,3],["output-redactor","PASS",10,10],["gateway-loopback","PASS",6,6]]);return r;}
async function labels():Promise<string>{await execute("soterai.refreshProtectionCenter");const provider=views.get("soterai-protection-coverage");assert(provider);const rows=await provider.getChildren();const items=await Promise.all((rows??[]).map(row=>provider.getTreeItem(row)));return items.map(item=>typeof item.label==="string"?item.label:item.label?.label??"").join("\n");}
async function flag(name:string,value:unknown):Promise<void>{await vscode.workspace.getConfiguration("soterai").update(name,value,vscode.ConfigurationTarget.Global);await until(()=>vscode.workspace.getConfiguration("soterai").inspect(name)?.globalValue===value,"native configuration echo");await pause(80);}
async function stopped():Promise<void>{const result=await execute<{state:string}>("soterai.stopLocalAIBroker");assert.equal(result.state,"stopped");await until(()=>children.every(c=>c.closed&&c.code===0&&c.signal===null&&c.stdoutEOF&&c.stderrEOF),"actual broker close and both EOF");}
async function started():Promise<void>{const result=await execute<{running:boolean;state:string}>("soterai.startLocalAIBroker");assert.equal(result.running,true);assert.equal(result.state,"healthy");}

export async function beforeActivate(actual:vscode.ExtensionContext):Promise<void>{
    context=actual;await center.beforeActivate(actual);output=process.env.SOTERAI_LITE_F17_EVIDENCE!;assert(path.isAbsolute(output));assert.match(output,/^D:\\SoterAI-Lite-test-profiles\\/i);assert.match(actual.extensionPath,/^D:\\SoterAI-Lite-test-profiles\\/i);
    const selected=process.env.SOTERAI_LITE_F17_PHASE;assert(selected==="primary"||selected==="restart");phase=selected;
    const create=vscode.window.createTreeView;restores.push(patch(vscode.window,"createTreeView",(id:string,options:vscode.TreeViewOptions<any>)=>{if(id.startsWith("soterai-protection-")||id==="soterai-protected-items")views.set(id,options.treeDataProvider);return Reflect.apply(create,vscode.window,[id,options]);}));
    const register=vscode.commands.registerCommand;restores.push(patch(vscode.commands,"registerCommand",(id:string,callback:(...args:unknown[])=>unknown,thisArg?:unknown)=>{
        if(id!=="soterai.verifySetup")return Reflect.apply(register,vscode.commands,[id,callback,thisArg]);
        return Reflect.apply(register,vscode.commands,[id,async(...args:unknown[])=>{const result=await Reflect.apply(callback,thisArg,args) as VerifyResult;const r=result?.report?.report;calls.push({argc:args.length,status:result?.status??"MISSING",...(r?{report:r}:{})});return result;},thisArg]);
    }));
    const cp=require("node:child_process"),spawn=cp.spawn;restores.push(patch(cp,"spawn",(...args:unknown[])=>{
        const child=Reflect.apply(spawn,cp,args) as ChildProcess,list=Array.isArray(args[1])?args[1]:[];
        if(typeof list[0]==="string"&&path.resolve(list[0]).toLowerCase()===path.resolve(actual.asAbsolutePath("dist/local-ai-broker.js")).toLowerCase()){
            assert(children.length<8,"Unexpected additional owned broker child");const ordinal=children.length+1,record:Child={pid:child.pid,closed:false,code:null,signal:null,stdoutEOF:false,stderrEOF:false,stdout:path.join(path.dirname(output),`${phase}-f30-broker-${ordinal}-stdout.bin`),stderr:path.join(path.dirname(output),`${phase}-f30-broker-${ordinal}-stderr.bin`)};
            for(const channel of ["stdout","stderr"] as const){const stream=child[channel];assert(stream);nativeFs.writeFileSync(record[channel],Buffer.alloc(0),{flag:"wx"});stream.on("data",(raw:Buffer)=>nativeFs.appendFileSync(record[channel],raw));stream.once("end",()=>{record[channel==="stdout"?"stdoutEOF":"stderrEOF"]=true;});}
            child.once("close",(code,signal)=>{record.closed=true;record.code=code;record.signal=signal;});children.push(record);
        }
        return child;
    }));syncBuiltinESMExports();
}
export function setupDiagnostic():object{return{phase,stage:diagnosticStage,views:[...views.keys()],verifyCalls:calls.map(c=>({argc:c.argc,status:c.status})),brokerChildren:children.map(c=>({pid:c.pid,closed:c.closed,code:c.code,signal:c.signal,stdoutEOF:c.stdoutEOF,stderrEOF:c.stderrEOF})),originalCenter:center.setupDiagnostic(),productImports:false,signalsRequested:0};}

export async function run(actual:vscode.ExtensionContext):Promise<void>{
    assert.equal(actual,context);const rows=Array.from({length:phase==="primary"?15:5},(_,i)=>({id:`F30-${phase==="primary"?"N":"R"}${String(i+1).padStart(2,"0")}`,status:"NOT_RUN"}));let failure:unknown,cleanupFailure:unknown;
    const check=async(index:number,fn:()=>Promise<void>)=>{diagnosticStage=rows[index-1].id;try{await fn();rows[index-1].status="PASS";}catch(e){rows[index-1].status="FAIL";throw e;}};
    const custody=path.join(path.dirname(output),"f30-restart-custody.json"),originalFlag=vscode.workspace.getConfiguration("soterai").inspect(FLAG)?.globalValue,originalOutput=vscode.workspace.getConfiguration("soterai").inspect("lite.outputRedactor")?.globalValue;
    let restoreStore:(()=>void)|undefined;const beforePolicy=()=>({policy:policyDigest(),profile:profileDigest()});let baseline:{policy:string;profile:string}|undefined;
    try{
        if(phase==="primary"){
            diagnosticStage="start-synthetic-owned-broker-before-real-renderer";await started();await center.run(actual);
            const old=JSON.parse(await fs.readFile(output,"utf8"));assert.equal(old.passed,25);assert.equal(old.failed,0);assert.equal(old.notRun,0);assert(!old.driverFailure&&!old.cleanupFailure);baseline=beforePolicy();
            await check(1,async()=>{const p=JSON.parse(await fs.readFile(actual.asAbsolutePath("package.json"),"utf8")),key="soterai."+FLAG;assert.deepEqual(p.contributes.configuration.properties[key].default,true);assert.equal(p.contributes.configuration.properties[key].scope,"machine");assert(p.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(key));assert((await vscode.commands.getCommands(true)).includes("soterai.verifySetup"));});
            await check(2,async()=>{const text=await labels();assert(text.includes("Verify my setup"));for(const id of ["managed-reader","public-workspace","cline-tools","ordinary-terminal","buffers-clipboard","independent-network","os-isolation","trusted-runtime"])assert(text.includes("Live "+id+": NOT_TESTED"));assert(!text.includes("100%"));});
            await check(3,async()=>{assert(children.length>=1,"Actual broker spawn observation missing");assert(calls.length>=1,"Real renderer did not reach verify owner before supplemental API checks");assert.equal(calls[0].argc,0);assert.equal(calls[0].status,"OPENED");const r=report(calls[0].report);assert(r.checks.every(c=>c.status==="PASS"));assert.equal(r.checks.reduce((n,c)=>n+c.passed,0),19);});
            await check(4,async()=>{const stored=report(actual.workspaceState.get(KEY));assert.equal(stored.extensionSha256,sha(await fs.readFile(actual.asAbsolutePath("dist/extension.js"))));assert.equal(stored.brokerSha256,sha(await fs.readFile(actual.asAbsolutePath("dist/local-ai-broker.js"))));assert(Number.isFinite(Date.parse(stored.verifiedAt)));});
            await check(5,async()=>{const text=await labels();assert(!text.includes("Synthetic checks: CURRENT"));assert(!text.includes("output-redactor: PASS"));});
            await check(6,async()=>{const before=calls.length,count=children.length,stored=sha(JSON.stringify(actual.workspaceState.get(KEY)));assert.deepEqual(await execute("soterai.verifySetup",{path:PRIVATE,command:"workbench.action.terminal.sendSequence"}),{status:"UNAVAILABLE"});assert.equal(calls.length,before+1);assert.equal(children.length,count);assert.equal(sha(JSON.stringify(actual.workspaceState.get(KEY))),stored);});
            let fresh:Report|undefined;
            await check(7,async()=>{await stopped();await started();fresh=passing(await execute<VerifyResult>("soterai.verifySetup"));assert.notEqual(fresh.binding,calls[0].report?.binding);});
            await check(8,async()=>{
                const count=children.length,fetchNative=globalThis.fetch;let intercepted=false,release!:()=>void;
                const gate=new Promise<void>(done=>{release=done;}),undo=patch(globalThis,"fetch",async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
                    const response=await fetchNative(input,init),url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
                    if(!intercepted&&url.hostname==="127.0.0.1"&&url.pathname==="/v1/gateway/self-test"){intercepted=true;await gate;}return response;
                });
                let first:Promise<VerifyResult>|undefined;
                try{first=execute<VerifyResult>("soterai.verifySetup");await until(()=>intercepted,"first actual response held for genuine overlap");assert.deepEqual(await execute("soterai.verifySetup"),{status:"UNAVAILABLE"});release();assert.equal((await first).status,"OPENED");assert.equal(children.length,count);}
                finally{release();undo();if(first)await first;}
            });
            const update=actual.workspaceState.update;restoreStore=patch(actual.workspaceState,"update",async(key:string,value:unknown)=>{if(key===KEY){storeWrites++;if(storeFailure)throw Error(PRIVATE);}return update.call(actual.workspaceState,key,value);});
            await check(9,async()=>{storeFailure=true;try{assert.deepEqual(await execute("soterai.verifySetup"),{status:"FAILED"});}finally{storeFailure=false;}assert(!(await labels()).includes("Synthetic checks: CURRENT"));assert.deepEqual(beforePolicy(),baseline);});
            await check(10,async()=>{await flag(FLAG,false);await stopped();assert.deepEqual(await execute("soterai.verifySetup"),{status:"UNAVAILABLE"});const text=await labels();assert(!text.includes("Verify my setup"));assert(!text.includes("output-redactor: PASS"));assert.deepEqual(beforePolicy(),baseline);});
            await check(11,async()=>{await flag(FLAG,originalFlag);assert(!(await labels()).includes("Synthetic checks: CURRENT"));const count=children.length,r=await execute<VerifyResult>("soterai.verifySetup");assert.equal(r.status,"OPENED");assert.equal(report(r.report?.report).checks.find(c=>c.id==="gateway-loopback")?.status,"NOT_TESTED");assert.equal(children.length,count);});
            await check(12,async()=>{await withRetainedRuntimeMutation(actual.asAbsolutePath("dist/pre-commit-client.js"),async()=>{assert.deepEqual(await execute("soterai.verifySetup"),{status:"UNAVAILABLE"});});});
            await check(13,async()=>{const previous=vscode.window.withProgress,emitter=new vscode.EventEmitter<void>(),writes=storeWrites,undo=patch(vscode.window,"withProgress",(options:unknown,task:(p:unknown,t:vscode.CancellationToken)=>Promise<unknown>)=>Reflect.apply(previous,vscode.window,[options,(p:unknown)=>task(p,{isCancellationRequested:true,onCancellationRequested:emitter.event})]));try{assert.deepEqual(await execute("soterai.verifySetup"),{status:"CANCELLED"});assert.equal(storeWrites,writes);}finally{undo();emitter.dispose();}});
            await check(14,async()=>{await flag("lite.outputRedactor",false);const r=await execute<VerifyResult>("soterai.verifySetup");assert.equal(r.status,"OPENED");assert(report(r.report?.report).checks.every(c=>c.status==="NOT_TESTED"));await flag("lite.outputRedactor",originalOutput);});
            await check(15,async()=>{await stopped();await execute("soterai.verifySetup");assert.deepEqual(beforePolicy(),baseline);const stored=report(actual.workspaceState.get(KEY));await fs.writeFile(custody,JSON.stringify({policy:baseline!.policy,profile:baseline!.profile,storedSha256:sha(JSON.stringify(stored)),report:stored,syntheticOnly:true})+"\n",{flag:"wx"});});
        }else{
            const saved=JSON.parse(await fs.readFile(custody,"utf8"));baseline=beforePolicy();
            await check(1,async()=>{assert.equal(policyDigest(),saved.policy);assert.equal(profileDigest(),saved.profile);assert.equal(sha(JSON.stringify(actual.workspaceState.get(KEY))),saved.storedSha256);assert(!(await labels()).includes("Synthetic checks: CURRENT"));});
            await check(2,async()=>{await started();const fresh=passing(await execute<VerifyResult>("soterai.verifySetup"));assert.notEqual(fresh.binding,saved.report.binding);assert(Date.parse(fresh.verifiedAt)>=Date.parse(saved.report.verifiedAt));});
            await center.run(actual);
            await check(3,async()=>{const old=JSON.parse(await fs.readFile(output,"utf8"));assert.equal(old.passed,5);assert.equal(old.failed,0);assert.equal(old.notRun,0);assert(!old.driverFailure&&!old.cleanupFailure);assert.deepEqual(beforePolicy(),baseline);});
            await check(4,async()=>{await flag(FLAG,false);assert.deepEqual(await execute("soterai.verifySetup"),{status:"UNAVAILABLE"});report(actual.workspaceState.get(KEY));});
            await check(5,async()=>{await stopped();assert(children.length>=1,"Actual restart broker spawn observation missing");assert.deepEqual(beforePolicy(),baseline);assert.equal(sha(await fs.readFile(actual.asAbsolutePath("dist/extension.js"))),process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);});
        }
    }catch(e){failure=e;}
    finally{
        storeFailure=false;try{await stopped();if(phase==="primary"){await flag(FLAG,originalFlag);await flag("lite.outputRedactor",originalOutput);}}catch(e){cleanupFailure=e;}
        restoreStore?.();for(const restore of restores.reverse())restore();syncBuiltinESMExports();
        await fs.writeFile(output+".f30-results.json",JSON.stringify({feature:"F30",phase,extensionBundleSha256:process.env.SOTERAI_LITE_F17_BUNDLE_SHA256,observations:rows,passed:rows.filter(r=>r.status==="PASS").length,failed:rows.filter(r=>r.status==="FAIL").length,notRun:rows.filter(r=>r.status==="NOT_RUN").length,driverFailure:failure instanceof Error?failure.name:failure?"UnknownFailure":undefined,cleanupFailure:cleanupFailure instanceof Error?cleanupFailure.name:cleanupFailure?"UnknownCleanupFailure":undefined,diagnostics:setupDiagnostic(),verifyCalls:calls,brokerChildren:children,cancellation:"INJECTED_PRE_CANCELLED_NATIVE_PROGRESS_TOKEN_NOT_PHYSICAL_CANCEL_CLICK",independence:"LOW_ACTUAL_NATIVE_AND_RENDERER_SEPARATE",signalsRequested:0},null,2)+"\n",{flag:"wx"});
    }
    if(failure||cleanupFailure)throw Error("F30 native verification incomplete; exact synthetic evidence retained");
}
