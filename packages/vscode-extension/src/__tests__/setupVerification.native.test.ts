import "./phase2/register.mjs";
import assert from "node:assert/strict";
import {test} from "node:test";
import * as api from "./phase2/vscode-stub";
import type * as vscode from "vscode";
import type {BrokerManager} from "../broker/BrokerManager";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vm from "node:vm";
import * as ts from "typescript";
async function fixture(){api.resetState();api.registeredCommands.clear();api.state.configInspect.set("soterai.lite.setupVerification",{defaultValue:true});let requests=0;const context=api.makeExtensionContext("C:\\f30-synthetic-component"),m=await import("../setup-verification/SetupVerification");const manager={ownedSnapshot:()=>({state:"stopped"}),async request(){requests++;throw Error("FAKE_ONLY_PRIVATE_ERROR");}} as unknown as Pick<BrokerManager,"ownedSnapshot"|"request">;const handle=m.registerSetupVerification(context as unknown as vscode.ExtensionContext,{manager,changed(){}});return{handle,context,get requests(){return requests;}};}
test("F30 machine flag ignores repository values and rejects malformed globals",async()=>{api.resetState();const {setupVerificationEnabled}=await import("../setup-verification/SetupVerificationFlags");for(const globalValue of [false,"true",1,{},null]){api.state.configInspect.set("soterai.lite.setupVerification",{defaultValue:true,globalValue,workspaceValue:true});assert.equal(setupVerificationEnabled(),false);}api.state.configInspect.set("soterai.lite.setupVerification",{defaultValue:true,workspaceValue:false});assert.equal(setupVerificationEnabled(),true);});
test("F30 native command is registered and rejects all forwarded inputs",async()=>{const f=await fixture();try{assert(api.registeredCommands.has("soterai.verifySetup"));assert.deepEqual(await api.commands.executeCommand("soterai.verifySetup",{path:"FAKE_ONLY_PRIVATE",command:"other"}),{status:"UNAVAILABLE"});assert.equal(f.requests,0);}finally{f.handle.dispose();}});
test("F30 missing loaded identity cannot run a gateway test or create green state",async()=>{const f=await fixture();try{assert.deepEqual(await api.commands.executeCommand("soterai.verifySetup"),{status:"UNAVAILABLE"});assert.notEqual(f.handle.current().state,"CURRENT");assert.equal(f.requests,0);}finally{f.handle.dispose();}});
test("F30 flag-off and untrusted contexts preserve stored policy without requests",async()=>{const f=await fixture();try{await f.context.workspaceState.update("soterai.aiForbidden.v1",{fixture:"saved-deny"});api.state.configInspect.set("soterai.lite.setupVerification",{defaultValue:true,globalValue:false});assert.deepEqual(await api.commands.executeCommand("soterai.verifySetup"),{status:"UNAVAILABLE"});api.state.isTrusted=false;assert.deepEqual(await api.commands.executeCommand("soterai.verifySetup"),{status:"UNAVAILABLE"});assert.deepEqual(f.context.workspaceState.get("soterai.aiForbidden.v1"),{fixture:"saved-deny"});assert.equal(f.requests,0);}finally{f.handle.dispose();}});
test("F30 disposal removes its command and invalidates cached presentation",async()=>{const f=await fixture();f.handle.dispose();assert(!api.registeredCommands.has("soterai.verifySetup"));assert.notEqual(f.handle.current().state,"CURRENT");});

// Exercise the exact registered production callback with native-style notification
// promises. Validation/canary behavior is tested separately; no production test hook.
function completionHandler(notify:()=>Promise<unknown>){
    const file=path.resolve(__dirname,"../setup-verification/SetupVerification.ts"),text=fs.readFileSync(file,"utf8"),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    let callback:ts.Expression|undefined;const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==="registerCommand"&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==="soterai.verifySetup")callback=node.arguments[1];ts.forEachChild(node,visit);};visit(source);assert(callback);
    const report={state:"CURRENT",report:{checks:[{status:"PASS"},{status:"PASS"},{status:"PASS"}]}},scope={module:{exports:undefined as unknown},AbortController,Promise,setupVerificationEnabled:()=>true,binding:()=>({}),session:{run:async()=>({status:"SAVED"}),current:()=>report},vscode:{ProgressLocation:{Notification:15},workspace:{isTrusted:true},l10n:{t:(s:string)=>s},window:{withProgress:async(_options:unknown,task:(p:unknown,t:unknown)=>Promise<unknown>)=>task({}, {isCancellationRequested:false,onCancellationRequested:()=>({dispose(){}})}),showInformationMessage:notify}}};
    const compiled=ts.transpileModule("module.exports="+callback.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(compiled,scope,{timeout:1000});return{invoke:scope.module.exports as()=>Promise<{status:string;report?:unknown}>,report};
}
test("F30 completed command releases its owner before a pending native notification is dismissed",async()=>{
    let release!:()=>void,settled=false;const notification=new Promise<void>(done=>{release=done;}),f=completionHandler(()=>notification),pending=f.invoke().then(value=>{settled=true;return value;});
    try{for(let n=0;n<32&&!settled;n++)await Promise.resolve();assert.equal(settled,true,"Native notification must not keep the reviewed action pending");const result=await pending;assert.equal(result.status,"OPENED");assert.equal(result.report,f.report);}finally{release();await pending;}
});
test("F30 notification rejection does not discard a committed current self-check",async()=>{const f=completionHandler(()=>Promise.reject(Error("FAKE_ONLY_PRIVATE_NOTIFICATION")));assert.equal((await f.invoke()).status,"OPENED");});
test("F30 synchronous notification failure does not discard a committed current self-check",async()=>{const f=completionHandler(()=>{throw Error("FAKE_ONLY_PRIVATE_NOTIFICATION");});assert.equal((await f.invoke()).status,"OPENED");});
