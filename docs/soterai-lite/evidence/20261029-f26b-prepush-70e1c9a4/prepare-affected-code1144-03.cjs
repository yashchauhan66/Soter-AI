'use strict';
// Prepare current metadata/guards only; no editor, Git, listener or browser start.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'}),save=(n,v)=>put(n,JSON.stringify(v,null,2)+'\n');
const fact=file=>{const b=fs.readFileSync(file);return{path:path.relative(repo,file).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};};
const nativeSha='293aa9d49b57495fea319fb7305dce7eb86c14a84e89913a46b72648cff3c4ed';
const native=read(own('native-launch-binding-06.json'));assert.equal(sha(fs.readFileSync(own('native-launch-binding-06.json'))),nativeSha);
const prior=read(path.resolve(__dirname,'../20261029-f26a-resume-1a40d9e7/native-current-binding-09.json'));
const originalInventory=read(path.resolve(repo,prior.toolInventory.path));
const pins=originalInventory.pins.map(row=>{
 if(!row.path.includes('Microsoft VS Code\\e646868227\\resources\\app')){const b=fs.readFileSync(row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);return row;}
 const next=row.path.replace('e646868227','2c33b50b16'),pin=native.vendorFacts.find(r=>r.path.toLowerCase()===next.toLowerCase());assert(pin);return pin;
});
assert.equal(pins.length,11);
const desktop=pins.find(row=>row.path.endsWith('workbench.desktop.main.js'));assert(desktop);
const desktopSource=fs.readFileSync(desktop.path,'utf8');
const workbench=originalInventory.staticWitnesses.workbench.map(row=>{const offset=desktopSource.indexOf(row.term);if(row.present)assert(offset>=0,'Current static witness missing: '+row.term);return{term:row.term,offset,present:offset>=0,excerpt:offset<0?null:desktopSource.slice(Math.max(0,offset-50),offset+row.term.length+100)};});
save('accessibility-tooling-code1144-01.json',{...originalInventory,status:'CURRENT_CODE11440_STATIC_INVENTORY_NOT_ACCESSIBILITY_ACCEPTANCE',observedAt:new Date().toISOString(),versions:{...originalInventory.versions,codeCurrentPinVersion:'1.144.0'},pins,staticWitnesses:{playwright:originalInventory.staticWitnesses.playwright,workbench},prior:fact(path.resolve(repo,prior.toolInventory.path)),change:'Only four actual Code application/theme pins refreshed to explicit requested installed1.144.0; original seven non-Code tooling pins byte exact. No native/accessibility acceptance transferred.'});
const inventoryFact=fact(own('accessibility-tooling-code1144-01.json'));
const oldScope=read(own('affected-scope-02.json'));
save('affected-scope-03.json',{...oldScope,sourceProof:fact(own('full-inputs-03.json')),currentArtifact:'Exact current F26b VSIX6c299712/content03;87 restricted machine flags/four runtimes; no historical acceptance transfer',driverInventory:'native-driver-provenance-03.json',driverBuild:'Original24 drivers/source bytes retained exactly; one corrected metadata-only F26b driver freshly emitted. All current-host affected routes remain NOT_RUN.',hostVersion:'1.144.0'});
let admission=fs.readFileSync(own('affected-current-admission-03.cjs'),'utf8');
for(const[from,to]of [['native-launch-binding-01.json','native-launch-binding-06.json'],['native-driver-provenance-02.json','native-driver-provenance-03.json'],['affected-scope-02.json','affected-scope-03.json'],['affected-packet-binding-02.json','affected-packet-binding-03.json']]){assert(admission.includes(from));admission=admission.replaceAll(from,to);}
const oldHost="assert.equal(b.hostReview.sha256,previous.hostReview.sha256);const host=read(pin(b.hostReview));assert.equal(host.currentHost.version,'1.143.1');";
assert(admission.includes(oldHost));admission=admission.replace(oldHost,"const host=read(pin(b.hostReview));assert.equal(host.currentHost.version,'1.144.0');assert.equal(b.hostReview.sha256,'"+native.hostReview.sha256+"');");
const oldInventory='const inventory=read(pin(previous.toolInventory));';assert(admission.includes(oldInventory));
admission=admission.replace(oldInventory,"pin(previous.toolInventory);const inventoryFile=own('accessibility-tooling-code1144-01.json');assert.equal(sha(fs.readFileSync(inventoryFile)),'"+inventoryFact.sha256+"');const inventory=read(inventoryFile);");
admission=admission.replace("assert(/^[a-f0-9]{64}$/.test(expectedSha256),'Exact reviewed native binding SHA is mandatory');","assert(/^[a-f0-9]{64}$/.test(expectedSha256),'Exact reviewed native binding SHA is mandatory');assert.equal(expectedSha256,'"+nativeSha+"');");
admission=admission.replace("assert.equal(r.configuredPush,'NOT_AUTHORIZED_NOT_RUN');return fact", "assert.equal(r.configuredPush,'NOT_AUTHORIZED_NOT_RUN');assert.equal(r.bindingSha256,'"+nativeSha+"');return fact");
admission=admission.replace("const b=await validateNativeBinding(packet.nativeLaunchBinding.sha256);", "for(const row of packet.fixtureInputs)pin(row);const b=await validateNativeBinding(packet.nativeLaunchBinding.sha256);");
admission=admission.replace('.then(b=>console.log(JSON.stringify({status:',".then(b=>console.log(JSON.stringify(process.argv.includes('--emit-binding')?b:{status:");
put('affected-current-admission-04.cjs',admission);
const admissionFact=fact(own('affected-current-admission-04.cjs'));
let shared=fs.readFileSync(path.resolve(__dirname,'../20261029-f26a-resume-1a40d9e7/affected-native-binding-01.ps1'),'utf8');
const start=shared.indexOf('function Get-F26cCurrentBinding {'),end=shared.indexOf('function Assert-F26AAffectedInputs {');assert(start>=0&&end>start);
const getter=`# Current F26b helper interface; no F26a/native09 execution or historical acceptance.
function Get-F26cCurrentBinding {
    $taskF26cBindingPath=Join-Path $PSScriptRoot 'native-launch-binding-06.json'
    if((Get-FileHash -LiteralPath $taskF26cBindingPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne '${nativeSha}'){throw 'Exact F26b current native binding changed.'}
    $taskF26cGuard=Join-Path $PSScriptRoot 'affected-current-admission-04.cjs'
    if((Get-FileHash -LiteralPath $taskF26cGuard -Algorithm SHA256).Hash.ToLowerInvariant() -cne '${admissionFact.sha256}'){throw 'Exact F26b affected guard changed.'}
    $taskF26cAnswer=& 'C:\\Program Files\\nodejs\\node.exe' $taskF26cGuard --require-component --emit-binding
    if($LASTEXITCODE -ne 0){throw 'Current native36 closure/full/artifact/source/host acceptance unavailable.'}
    return ($taskF26cAnswer | ConvertFrom-Json)
}
`;
shared=getter+shared.slice(end);
const oldRead="$taskF26cBinding=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-current-binding-09.json') -Raw -Encoding UTF8 | ConvertFrom-Json";
assert.equal(shared.split(oldRead).length,3);shared=shared.replaceAll(oldRead,'$taskF26cBinding=Get-F26cCurrentBinding');
shared=shared.replaceAll('offline-inventory-09/release-inventory.json','content-inspection-03.json');
put('affected-native-binding-01.ps1',shared);
(async()=>{
 const b=await require(own('affected-current-admission-04.cjs')).validateNativeBinding(nativeSha);
 const scope=read(own('affected-scope-03.json'));
 const helperNames=[...new Set([...scope.families.map(row=>row.helper),'affected-functional10-01.ps1','affected-security17-01.ps1','affected-functional-security-01.ps1','affected-preparation-pipe-ownership-01.ps1','affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js','affected-native-binding-01.ps1','affected-current-admission-04.cjs'])];
 const fixtureInputs=helperNames.map(name=>fact(own(name)));
 save('affected-packet-binding-03.json',{...b,status:'F26B_AFFECTED_CURRENT_PACKET_BOUND_NOT_RUN',observedAt:new Date().toISOString(),fixtureInputs,scope:fact(own('affected-scope-03.json')),toolInventory:inventoryFact,componentGate:'Exact native-component-acceptance-01 binding293aa9d4 PASS with natural owners closed+bothEOF is required before any affected execution',precommit:'USER_DEFERRED_UNVERIFIED_NO_SUBSTITUTE',configuredPush:'NOT_AUTHORIZED_NOT_RUN'});
 save('affected-code1144-preparation-03.json',{status:'CURRENT20FAMILIES509_37_PLUS_FUNCTIONAL10_SECURITY17_PREPARED_NOT_RUN',observedAt:new Date().toISOString(),nativeLaunchBinding:b.nativeLaunchBinding,packet:fact(own('affected-packet-binding-03.json')),admission:admissionFact,helperBinding:fact(own('affected-native-binding-01.ps1')),sourceProof:b.sourceProof,vsix:b.vsix,sourceAssertionChanges:0,retainedDriverBytesExact:24,hostVersion:'1.144.0',nativeRuns:0,signalsRequested:0});
 console.log(JSON.stringify({status:'CURRENT_CODE11440_AFFECTED_PACKET_PREPARED_NOT_RUN',families:20,assertions:509,phases:37,admission:admissionFact}));
})().catch(error=>{console.error(error);process.exitCode=1;});
