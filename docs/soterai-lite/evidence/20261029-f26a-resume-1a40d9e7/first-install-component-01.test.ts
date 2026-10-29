import "../../../../packages/vscode-extension/src/__tests__/phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import * as stub from "../../../../packages/vscode-extension/src/__tests__/phase2/vscode-stub";
import { PreCommitOwnerService } from "../../../../packages/vscode-extension/src/history-hooks/PreCommitOwnerService";
import { hookSnapshotDigest, type HookFileSnapshot } from "../../../../packages/vscode-extension/src/history-hooks/PreCommitHookTransaction";

// Diagnostic component: unchanged production controller, real crypto,
// transaction, descriptor filesystem and owned numeric-loopback service.
// Discovery, root policy, artifact observations, backups and hook file are
// explicit seams. No Code launch, Git child, normal profile or native retry.
for (const present of [false, true]) test(`first install with storage directory ${present ? "present" : "absent"}`, { skip: process.platform !== "win32" }, async t => {
    const container = await mkdtemp(join(tmpdir(), "soter-f26a-first-install-"));
    const root = join(container, "repo"), profile = join(container, "profile");
    await mkdir(root); await mkdir(profile); stub.resetState(root);
    stub.state.configInspect.set("soterai.lite.historyHooks.preCommit", {defaultValue:false,globalValue:true});
    const remote=Object.getOwnPropertyDescriptor(stub.env,"remoteName");
    Object.defineProperty(stub.env,"remoteName",{configurable:true,value:undefined});
    t.after(()=> { if(remote)Object.defineProperty(stub.env,"remoteName",remote);else delete (stub.env as any).remoteName; });
    const context = stub.makeExtensionContext(profile);
    if(present)await mkdir(context.globalStorageUri.fsPath);
    const sourceFile=resolve("packages/vscode-extension/src/history-hooks/PreCommitController.ts"), req=createRequire(sourceFile);
    const ts=req("typescript") as typeof import("typescript");
    const compiled=ts.transpileModule(await readFile(sourceFile,"utf8"),{fileName:sourceFile,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
    const realBinding=req("../terminal/ManagedOutputBinding"), realArtifacts=req("./PreCommitClient"), realFs=req("node:fs");
    const trace:object[]=[]; const hookedFs={...realFs};
    for(const name of ["mkdirSync","openSync","fstatSync","lstatSync","writeFileSync","ftruncateSync","closeSync"])hookedFs[name]=(...args:unknown[])=> {
        try { const value=realFs[name](...args);trace.push({operation:name,status:"RETURNED"});return value; }
        catch(error){trace.push({operation:name,status:"THREW",code:(error as NodeJS.ErrnoException).code});throw error;}
    };
    let state:HookFileSnapshot={identity:"1".repeat(64),bytes:undefined,mode:undefined};
    const file={read:()=>({...state,bytes:state.bytes&&Buffer.from(state.bytes)}),write:(before:HookFileSnapshot,bytes:Buffer|undefined,mode:number|undefined)=> {
        if(before.identity!==state.identity||hookSnapshotDigest(before)!==hookSnapshotDigest(state))return false;
        state={identity:"2".repeat(64),bytes:bytes&&Buffer.from(bytes),mode};return true;
    }};
    const services:PreCommitOwnerService[]=[]; const backup=new Map<string,string>();
    class Service extends PreCommitOwnerService {constructor(input:ConstructorParameters<typeof PreCommitOwnerService>[0]){super(input);services.push(this);}}
    class Discovery {closed=Promise.resolve();value=Object.freeze({status:"COMPLETE",hooksRelative:".git/hooks",fingerprint:"a".repeat(64)});start(){return Promise.resolve(this.value);}canRelease(v:unknown){return v===this.value;}withdraw(){}}
    class Backups {async store(_p:string,body:string){backup.set("b".repeat(32),body);return "b".repeat(32);}async retrieve(id:string){return backup.get(id);}}
    t.mock.method(stub.window,"showWarningMessage",async (_m:unknown,...items:unknown[])=>items.at(-1));
    const local=(id:string):unknown=> {
        if(id==="vscode")return stub;
        if(id==="node:fs")return hookedFs;
        if(id==="../ai-boundary/BoundarySnapshot")return {BoundarySnapshot:{load:async()=>undefined}};
        if(id==="../terminal/ManagedOutputBinding")return {...realBinding,managedRootIdentity:()=>"fixed-root",managedPolicyBinding:()=>"fixed-policy"};
        if(id==="./CheckedOwnerHookContext")return {prepareCheckedOwnerHookContext:async()=>({root,available:()=>true})};
        if(id==="./OwnerHookDiscovery")return {OwnerHookDiscovery:Discovery};
        if(id==="./CheckedHookFile")return {prepareCheckedHookFile:()=>file};
        if(id==="./PreCommitFlags")return {preCommitHooksEnabled:()=>true};
        if(id==="./PreCommitOwnerService")return {PreCommitOwnerService:Service};
        if(id==="../broker/EncryptedBackupSink")return {EncryptedBackupSink:Backups};
        if(id==="./PreCommitClient")return {...realArtifacts,
            observeHookArtifact:(target:string,cap:number,valid:()=>boolean,body=false)=> target.endsWith("pre-commit-client.js")||target===process.execPath
                ? {stamp:target,digest:(target===process.execPath?"c":"d").repeat(64)}:realArtifacts.observeHookArtifact(target,cap,valid,body),
            hookArtifactIdentity:(target:string,cap:number)=>target.endsWith("pre-commit-client.js")||target===process.execPath?target:realArtifacts.hookArtifactIdentity(target,cap)};
        return req(id);
    };
    const mod={exports:{} as {PreCommitController:new(c:unknown)=>any}};
    new Function("require","module","exports","__filename","__dirname",compiled.outputText)(local,mod,mod.exports,sourceFile,dirname(sourceFile));
    const controller=new mod.exports.PreCommitController(context);
    t.after(async()=> {controller.dispose();await Promise.all(services.map(s=>s.close()));});
    const outcome=await controller.install();
    t.diagnostic(JSON.stringify({outcome,services:services.length,backupWrites:backup.size,trace}));
    assert.equal(outcome.status,"APPLIED");assert.equal(controller.status().status,"LIVE");assert.equal(controller.current(outcome),true);
    assert.equal(backup.size,1);assert(state.bytes?.toString("utf8").startsWith("#!/bin/sh\n# SoterAI Lite pre-commit v1 "));
    assert((await lstat(join(context.globalStorageUri.fsPath,"pre-commit"))).isDirectory());
});
