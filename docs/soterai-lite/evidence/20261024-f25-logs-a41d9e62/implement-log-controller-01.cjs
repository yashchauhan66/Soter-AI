'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),read=name=>fs.readFileSync(path.join(repo,name),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before={};
for(const name of ['packages/vscode-extension/src/artifacts/ArtifactController.ts','packages/vscode-extension/src/artifacts/ArtifactFlags.ts','packages/vscode-extension/src/artifacts/commands.ts','packages/vscode-extension/src/hygiene/HygieneExposureLedger.ts']){
 const bytes=fs.readFileSync(path.join(repo,name));const target=path.join(__dirname,'controller-original-inputs-01',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});before[name]={bytes:bytes.length,sha256:sha(bytes)};
}
let controller=read('packages/vscode-extension/src/artifacts/ArtifactController.ts');
controller=controller.replaceAll('ArtifactController','LogController').replaceAll('ArtifactScanResult','LogScanResult').replaceAll('ARTIFACT_LIMITS','LOG_LIMITS').replaceAll('ARTIFACT_SCOPE','LOG_SCOPE').replaceAll('ArtifactContent','LogContent').replaceAll('artifactViews','logContentViews').replaceAll('ArtifactFlags','LogFlags').replaceAll('artifactScannerEnabled','logProtectionEnabled').replaceAll('"artifact-v1"','"logs-v1"');
const modalStart=controller.indexOf('        const action = "Analyze local artifacts";'),modalEnd=controller.indexOf('        await BoundarySnapshot.load();',modalStart);assert(modalStart>=0&&modalEnd>modalStart);
controller=controller.slice(0,modalStart)+controller.slice(modalEnd);
const modal=`        const action = "Analyze saved logs";
        const choice = await vscode.window.showWarningMessage("Analyze saved local logs and test reports?", { modal: true,
            detail: "Review up to128 regular saved files,64KiB each and1MiB within60seconds. Plain failures and strict bounded JSON/JSONL are analyzed locally. No log, script, reference, test or provider is executed. Keyed possible-exposure metadata only; caps and unsupported inputs stay partial. Review cleanup and rotation manually. Original logs and earlier disclosures remain reachable." }, action);
        check(); if (managedPolicyBinding(root) !== approvalPolicy) throw Error();
        if (choice !== action) return { status: "CANCELLED" };
`;
const discovery='        const discovered = await vscode.workspace.findFiles';assert(controller.includes(discovery));controller=controller.replace(discovery,modal+discovery);
const pendingStart=controller.indexOf('            const pending: HygieneFinding[] = [];'),pendingEnd=controller.indexOf('            findings.push(...pending); files++;',pendingStart);assert(pendingStart>=0&&pendingEnd>pendingStart);
const analysis=`            if (parsed.status !== "ANALYZED") { skipped++; continue; }
            const pending: HygieneFinding[] = [], seenValues = new Set<string>();
            try {
                const views = parsed.kind === "TEXT" ? parsed.views : [
                    { relativePath: stamp.relative + "/raw.txt", text, language: "text" as const }, ...parsed.views,
                    ...(parsed.views.length > 1 ? [{ relativePath: stamp.relative + "/joined.txt", text: parsed.views.map(view => view.text).join(""), language: "text" as const }] : []),
                ];
                for (const view of views) {
                    check(); const analysis = analyzer.analyze({ source: view.relativePath, text: view.text, environment: false });
                    for (const finding of analysis.findings) {
                        if (seenValues.has(finding.valueRef)) continue;
                        seenValues.add(finding.valueRef); pending.push(finding);
                    }
                    check(); if (pending.length + findings.length > 128) throw Error();
                }
            } catch { check(); skipped++; continue; }
`;
controller=controller.slice(0,pendingStart)+analysis+controller.slice(pendingEnd);
assert(!controller.includes('artifact')&&!controller.includes('Artifact'));
const outputs={
 'LogController.ts':controller,
 'LogFlags.ts':read('packages/vscode-extension/src/artifacts/ArtifactFlags.ts').replace('artifactScannerEnabled','logProtectionEnabled').replace('lite.artifactScanner','lite.logProtection'),
 'commands.ts':read('packages/vscode-extension/src/artifacts/commands.ts').replaceAll('ArtifactController','LogController').replace('registerArtifactScanner','registerLogProtection').replace('soterai.artifactScannerStatus','soterai.logProtectionStatus').replace('soterai.reviewArtifacts','soterai.reviewLogs'),
};
for(const [name,text] of Object.entries(outputs))fs.writeFileSync(path.join(repo,'packages/vscode-extension/src/logs',name),text,{flag:'wx'});
const ledgerFile='packages/vscode-extension/src/hygiene/HygieneExposureLedger.ts';let ledger=read(ledgerFile);
assert(ledger.includes('domain?: "history-v1" | "artifact-v1"'));assert(ledger.includes('domain !== "history-v1" && domain !== "artifact-v1"'));
ledger=ledger.replace('domain?: "history-v1" | "artifact-v1"','domain?: "history-v1" | "artifact-v1" | "logs-v1"').replace('domain !== "history-v1" && domain !== "artifact-v1"','domain !== "history-v1" && domain !== "artifact-v1" && domain !== "logs-v1"');fs.writeFileSync(path.join(repo,ledgerFile),ledger);
fs.writeFileSync(path.join(__dirname,'controller-implementation-01.json'),JSON.stringify({status:'IMPLEMENTED_NOT_YET_VERIFIED',before,scope:'Existing canonical artifact scanner path/policy/root/key/timeout/read/final recapture pattern reused. Owner modal moved before discovery. Logs use finite text/JSON/JSONL private views, raw+decoded heuristic analysis with per-file value deduplication; no artifact publication or source-map parser copied. Canonical ledger gains only finite logs-v1 domain.'},null,2),{flag:'wx'});
console.log(JSON.stringify({status:'IMPLEMENTED_NOT_YET_VERIFIED',modules:Object.keys(outputs),domain:'logs-v1'}));
