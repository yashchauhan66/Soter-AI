import * as vscode from "vscode";
import * as path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import type {BrokerManager} from "../broker/BrokerManager";
import {onDidChangeBoundaryRules,onDidChangeOwnerPolicySession} from "../ai-boundary/BoundarySnapshot";
import {onDidChangeManualRestriction} from "../ai-boundary/RestrictionOperation";
import {loadPrivacyVerification} from "../project-privacy/VerificationEvidence";
import {secretBrokerRuntime} from "../secret-broker/runtime";
import {runOutputSelfTest} from "../secret-broker/OutputSelfTest";
import {runSetupMatchingCheck} from "./SetupCanaryChecks";
import {captureSetupCompanions,sameSetupCompanions} from "./SetupVerificationIdentity";
import {setupVerificationEnabled} from "./SetupVerificationFlags";
import {SetupVerificationSession} from "./SetupVerificationSession";
import type {SetupBinding,SetupReportState} from "./SetupVerificationReport";
// Evaluated as the bundle initializes, before activation can create an owned broker.
const ACTIVATION_COMPANIONS=captureSetupCompanions(__dirname);
const KEY="soterai.lite.setupVerification.v1";
const SETTINGS=["lite.setupVerification","lite.secretMatching","lite.outputRedactor","lite.gatewayPolicy","lite.gatewayLifecycle","lite.vaultMode",
    "lite.gatewayJsonBodies","lite.gatewayGzipBodies","lite.gatewayBrotliBodies","lite.gatewayDeflateBodies","lite.gatewayChunkedBodies","lite.gatewayFramedBodies","lite.gatewayMultipartBodies","lite.gatewayBase64Bodies",
    "lite.clineAdapter","lite.claudeAdapter","lite.codexCliAdapter","lite.codexIdeAdapter","lite.geminiCliAdapter","broker.openAIProviderUrl","broker.anthropicProviderUrl","broker.codexResponsesProviderUrl","broker.geminiProviderUrl","projectPrivacy.enabled","lite.safeConsent"];
export interface SetupVerificationHandle extends vscode.Disposable {current():SetupReportState}
export function registerSetupVerification(context:vscode.ExtensionContext,deps:{manager:Pick<BrokerManager,"ownedSnapshot"|"request">;changed():void}):SetupVerificationHandle {
    const resources:vscode.Disposable[]=[],nonce=randomUUID();let revision=0,disposed=false;
    const binding=():SetupBinding|undefined=>{
        try {
            if(disposed||!setupVerificationEnabled()||!vscode.workspace.isTrusted)return;
            const identity=loadPrivacyVerification(context.extensionPath,false);
            if(!identity.loadedSha256||identity.loadedSha256!==identity.installedSha256)return;
            const companions=captureSetupCompanions(path.join(context.extensionPath,"dist"));if(!sameSetupCompanions(ACTIVATION_COMPANIONS,companions)||!companions)return;
            const config=vscode.workspace.getConfiguration("soterai"),settings=SETTINGS.map(name=>{
                const value=config.get<unknown>(name);if(value!==undefined&&typeof value!=="boolean"&&typeof value!=="string")throw Error();
                if(typeof value==="string"&&value.length>4096)throw Error();return value??null;
            });
            const owned=deps.manager.ownedSnapshot(),roots=(vscode.workspace.workspaceFolders??[]).map(f=>f.uri.toString());if(roots.length>32||roots.some(r=>r.length>32768))return;
            // Routing strings/workspace identities are hashed in memory, never persisted/displayed as text.
            const digest=createHash("sha256").update(JSON.stringify([nonce,revision,identity.loadedSha256,companions,settings,roots,owned.state,owned.session??null,owned.port??null])).digest("hex");
            return{binding:digest,extensionSha256:identity.loadedSha256,brokerSha256:companions["local-ai-broker.js"]};
        }catch{return;}
    };
    const session=new SetupVerificationSession({enabled:()=>!disposed&&setupVerificationEnabled(),trusted:()=>vscode.workspace.isTrusted,now:()=>Date.now(),binding,
        initialReport:context.workspaceState.get(KEY),changed:()=>deps.changed(),save:async report=>{await context.workspaceState.update(KEY,report);},
        run:async()=>{
            const matching=runSetupMatchingCheck(secretBrokerRuntime.outputFilter),output=runOutputSelfTest(secretBrokerRuntime.outputFilter);let gateway:unknown;
            if(deps.manager.ownedSnapshot().state==="healthy")try{gateway=await deps.manager.request("/v1/gateway/self-test",{method:"POST",body:"{}"},15000);}catch{/* Fixed NOT_TESTED; no caller/provider error text. */}
            return{matching,output,gateway};
        }});
    const invalidate=()=>{revision++;session.invalidate();};
    resources.push(vscode.commands.registerCommand("soterai.verifySetup",async(...args:unknown[])=>{
        if(args.length||!setupVerificationEnabled()||!vscode.workspace.isTrusted||!binding())return{status:"UNAVAILABLE"};
        try {
            const result=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:vscode.l10n.t("Checking synthetic local protection"),cancellable:true},async(_progress,token)=>{
                const abort=new AbortController();if(token.isCancellationRequested)abort.abort();const cancel=token.onCancellationRequested(()=>abort.abort());
                try{return await session.run(abort.signal);}finally{cancel.dispose();}
            });
            if(result.status!=="SAVED")return result;
            const report=session.current();if(report.state!=="CURRENT")return{status:"UNAVAILABLE"};
            const checks=report.report!.checks,failed=checks.filter(c=>c.status==="FAIL").length,untested=checks.filter(c=>c.status==="NOT_TESTED").length;
            // A native notification may stay open indefinitely. Release the
            // reviewed action after committing its result; notification failure
            // must neither retain that owner nor discard valid metadata.
            try{void Promise.resolve(vscode.window.showInformationMessage(vscode.l10n.t("Synthetic checks updated: {0} PASS, {1} FAIL, {2} NOT_TESTED. Review Coverage; live tool routes remain NOT_TESTED.",checks.length-failed-untested,failed,untested))).then(undefined,()=>{});}catch{/* Coverage remains available even when notification delivery fails. */}
            return{status:"OPENED",report};
        }catch{return{status:"INCOMPLETE"};}
    }),vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration("soterai"))invalidate();}),vscode.workspace.onDidChangeWorkspaceFolders(invalidate),
    onDidChangeBoundaryRules(invalidate),onDidChangeOwnerPolicySession(invalidate),onDidChangeManualRestriction(invalidate));
    if(typeof vscode.workspace.onDidGrantWorkspaceTrust==="function")resources.push(vscode.workspace.onDidGrantWorkspaceTrust(invalidate));
    const handle:SetupVerificationHandle={current:()=>session.current(),dispose(){if(disposed)return;disposed=true;session.dispose();for(const item of resources.reverse())item.dispose();}};
    context.subscriptions.push(handle);return handle;
}
