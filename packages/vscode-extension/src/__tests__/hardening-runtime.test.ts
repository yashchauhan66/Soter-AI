import "./phase2/register.mjs";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { ProtectionStateService } from "../protection/ProtectionStateService";
import { deriveProtectionState } from "../protection/ProtectionState";
import { PolicyStore } from "../firewall/PolicyStore";
import { registerBrokerCommands } from "../broker/commands";
import { confirmScopedChange } from "../security/ScopedConfirmation";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";

test("live off/missing/unhealthy Safe Mode overrides cached enabled; URL text verifies zero routes", async () => {
    stub.resetState();
    const context=stub.makeExtensionContext("synthetic-runtime");
    await context.globalState.update("soterai.safeMode",{enabled:true,level:"strict"});
    let status: any={state:"healthy",running:true,safeMode:{enabled:false}};
    const service=new ProtectionStateService(context as never,{brokerManager:{status:async()=>status,url:"http://127.0.0.1:47321"} as never,workspaceGuard:{isEnabled:true} as never,sentinel:{isEnabled:true} as never});
    const snapshots=[];
    for (const value of [status,{state:"healthy",running:true},{state:"offline",running:false,safeMode:{enabled:true}}]) {
        status=value; snapshots.push(await service.refresh());
    }
    for (const s of snapshots) { assert.equal(s.facts.safeModeEnabled,false); assert.equal(s.facts.protectedAiTools,0); }
    status={state:"healthy",running:true,safeMode:{enabled:true}};
    assert.equal((await service.refresh()).facts.safeModeEnabled,true);
    stub.state.config.set("soterai.hardening.runtimeEvidence",false);
    assert.equal((await service.refresh()).facts.safeModeEnabled,false);
});
test("policy status validates bytes and no URL/comment can increase verified route count", async () => {
    const root=await mkdtemp(join(tmpdir(),"soterai-runtime-unit-"));
    try {
        stub.resetState(root); await mkdir(join(root,".soterai"));
        await writeFile(join(root,".soterai/policy.json"),"{broken"); assert.equal(await PolicyStore.status(),"invalid");
        await writeFile(join(root,".soterai/policy.json"),'{"protectedFiles":["private/**"]}'); assert.equal(await PolicyStore.status(),"loaded");
        await writeFile(join(root,".env"),"# http://127.0.0.1:47321/v1/ai/openai-compatible");
        const service=new ProtectionStateService(stub.makeExtensionContext(root) as never,{brokerManager:{status:async()=>({state:"healthy",running:true})} as never,workspaceGuard:{isEnabled:true} as never,sentinel:{isEnabled:true} as never});
        assert.equal((await service.refresh()).facts.protectedAiTools,0);
        await assert.rejects(PolicyStore.removeProtected("private/**"),/Programmatic/);
    } finally { assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith("soterai-runtime-unit-"));await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}); }
});
test("broker approval command arguments cannot bypass modal; approval displays exact scope", async () => {
    stub.resetState(); const context=stub.makeExtensionContext("synthetic-consent");
    const event={decision:"approval_required",sessionId:"synthetic-session",contentHash:"a".repeat(64)};
    let posts=0;
    registerBrokerCommands(context as never,{request:async(p:string)=>{if(p==="/v1/events/recent")return{events:[event]};posts++;return{};}} as never,()=>{});
    try {
        await stub.commands.executeCommand("soterai.approveAIContextOnce",{approved:true}); assert.equal(posts,0);
        assert.ok(stub.capturedText().includes(event.contentHash));assert.match(stub.capturedText(),/not agent-proof/);
        const prompt=mock.method(stub.window,"showWarningMessage",async()=>"Confirm this change");
        try { await stub.commands.executeCommand("soterai.approveAIContextOnce");assert.equal(posts,1); }
        finally { prompt.mock.restore(); }
        stub.state.config.set("soterai.hardening.scopedConfirmation",false);
        assert.equal(await confirmScopedChange("synthetic"),false);
        await stub.commands.executeCommand("soterai.approveAIContextOnce");assert.equal(posts,1);
    } finally { context.subscriptions.forEach(d=>d.dispose()); }
});

test("unknown routing evidence cannot report either a verified route or detected bypass", () => {
    const descriptor=deriveProtectionState({enabled:true,broker:"healthy",workspaceTrusted:true,policy:"loaded",safeModeEnabled:true,protectedWorkspaceEnabled:true,sentinelEnabled:true,mcpStrictModeEnabled:false,liveScanEnabled:true,protectedAiTools:0,detectedAiTools:7,routingEvidence:"unknown"});
    assert.equal(descriptor.state,"PARTIALLY_ENFORCED");assert.match(descriptor.coverage,/UNTESTED/);
    assert.doesNotMatch(descriptor.title,/Bypass detected|Fully enforced/);
});
