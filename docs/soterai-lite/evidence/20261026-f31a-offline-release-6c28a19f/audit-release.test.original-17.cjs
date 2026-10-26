const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {ZipFile}=require('yazl');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const runtimeNames=['extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js'];
const assets=['README.md','CHANGELOG.md','LICENSE.md','media/icon.svg','media/logo_circle_whiter.png','media/walkthrough/demo.md','media/walkthrough/vault.md','media/walkthrough/integrate.md'];
async function fixture(t,change=()=>{}){
 const repo=await fs.mkdtemp(path.join(os.tmpdir(),'soterai-f31a-synthetic-'));t.after(()=>{}); // retain synthetic evidence; no recursive cleanup
 const entries=new Map([['[Content_Types].xml',Buffer.from('<Types/>')],['extension.vsixmanifest',Buffer.from('<PackageManifest><Metadata><Identity Id="soterai-ide-guard" Version="0.7.0" Publisher="soterai" TargetPlatform="win32-x64"/></Metadata></PackageManifest>')]]);
 const manifest={name:'soterai-ide-guard',publisher:'soterai',version:'0.7.0',main:'./dist/extension.js',engines:{vscode:'^1.85.0'},license:'SEE LICENSE IN LICENSE.md',capabilities:{untrustedWorkspaces:{supported:'limited'},virtualWorkspaces:{supported:false}}};
 const manifestRaw=Buffer.from(JSON.stringify(manifest));entries.set('extension/package.json',manifestRaw);
 for(const asset of assets)entries.set('extension/'+asset,Buffer.from('synthetic '+asset));
 const input=Buffer.from('module.exports=1;'),relative='node_modules/fixture-library/index.js';
 await fs.mkdir(path.join(repo,'node_modules/fixture-library'),{recursive:true});await fs.writeFile(path.join(repo,relative),input);await fs.writeFile(path.join(repo,'node_modules/fixture-library/package.json'),JSON.stringify({name:'fixture-library',version:'1.2.3',license:'MIT'}));await fs.writeFile(path.join(repo,'node_modules/fixture-library/LICENSE'),'Synthetic MIT notice retained.');
 const inventory=runtimeNames.map((name,i)=>{const raw=Buffer.from('module.exports='+i+';');entries.set('extension/dist/'+name,raw);return {name,bytes:raw.length,sha256:sha(raw),inputs:[{path:relative,bytes:input.length,sha256:sha(input)}]};});
 const receipt={status:'BUILT_NOT_HOST_VERIFIED',identity:'soterai.soterai-ide-guard',version:'0.7.0',runtimeCount:4,inventory};
 const context={repo,entries,receipt,manifest};await change(context);
 const zip=new ZipFile();for(const[name,raw]of entries)zip.addBuffer(raw,name);const chunks=[];zip.outputStream.on('data',x=>chunks.push(x));const closed=new Promise((resolve,reject)=>{zip.outputStream.on('end',resolve);zip.outputStream.on('error',reject)});zip.end();await closed;
 const vsixRaw=Buffer.concat(chunks),vsixPath=path.join(repo,'synthetic.vsix');await fs.writeFile(vsixPath,vsixRaw);
 const receiptPath=path.join(repo,'build-provenance.json');await fs.writeFile(receiptPath,JSON.stringify(receipt));
 return {...context,options:{repoRoot:repo,vsixPath,expectedSha256:sha(vsixRaw),buildReceiptPath:receiptPath}};
}
const load=()=>require('../audit-release.cjs');
test('exact synthetic artifact yields inventory and actual bundled-component SBOM; readiness stays incomplete',async t=>{
 const f=await fixture(t),{report,sbom}=await load().auditRelease(f.options);
 assert.equal(report.status,'PASS_OFFLINE_INVENTORY_ONLY');assert.equal(report.releaseReady,false);assert.equal(report.entries.length,15);assert.equal(report.runtimes.length,4);assert.equal(report.vulnerabilityAudit,'NOT_RUN_NETWORK_NOT_AUTHORIZED');assert.equal(report.marketplacePublication,'NOT_RUN');
 assert.equal(sbom.bomFormat,'CycloneDX');assert.equal(sbom.components.length,1);assert.equal(sbom.components[0].name,'fixture-library');assert.equal(sbom.components[0].version,'1.2.3');assert.equal(sbom.components[0].properties.find(x=>x.name==='soterai:bundled-input-count').value,'1');assert.equal(report.licenses[0].status,'METADATA_AND_NOTICE_PRESENT_NOT_LEGAL_APPROVAL');
 assert(!JSON.stringify({report,sbom}).includes(f.repo));
});
test('artifact SHA mismatch refuses before archive contents are accepted',async t=>{const f=await fixture(t);await assert.rejects(load().auditRelease({...f.options,expectedSha256:'0'.repeat(64)}),/artifact/i)});
test('missing runtime cannot yield inventory success',async t=>{const f=await fixture(t,x=>x.entries.delete('extension/dist/pre-commit-client.js'));await assert.rejects(load().auditRelease(f.options),/entry|runtime/i)});
test('runtime bytes must agree with build provenance',async t=>{const f=await fixture(t,x=>x.entries.set('extension/dist/extension.js',Buffer.from('modified')));await assert.rejects(load().auditRelease(f.options),/runtime/i)});
test('source maps and evidence are not accepted as release entries',async t=>{const f=await fixture(t,x=>x.entries.set('extension/dist/extension.js.map',Buffer.from('synthetic')));await assert.rejects(load().auditRelease(f.options),/entry/i)});
test('case alias entries are refused',async t=>{const f=await fixture(t,x=>x.entries.set('extension/readme.md',Buffer.from('alias')));await assert.rejects(load().auditRelease(f.options),/entry|alias/i)});
test('platform must be explicitly win32-x64',async t=>{const f=await fixture(t,x=>x.entries.set('extension.vsixmanifest',Buffer.from('<Identity TargetPlatform="linux-x64"/>')));await assert.rejects(load().auditRelease(f.options),/platform/i)});
test('manifest identity must match build provenance',async t=>{const f=await fixture(t,x=>x.entries.set('extension/package.json',Buffer.from(JSON.stringify({...x.manifest,publisher:'other'}))));await assert.rejects(load().auditRelease(f.options),/identity/i)});
test('missing build input cannot become a complete SBOM',async t=>{const f=await fixture(t,async x=>fs.unlink(path.join(x.repo,'node_modules/fixture-library/index.js')));await assert.rejects(load().auditRelease(f.options),/input|ENOENT/i)});
test('changed build input is refused',async t=>{const f=await fixture(t,async x=>fs.writeFile(path.join(x.repo,'node_modules/fixture-library/index.js'),'changed'));await assert.rejects(load().auditRelease(f.options),/input/i)});
test('repository selector input paths outside code inventory are refused before reading',async t=>{const f=await fixture(t,x=>{x.receipt.inventory[0].inputs=[{path:'.env',bytes:10,sha256:'0'.repeat(64)}]});await assert.rejects(load().auditRelease(f.options),/input|path/i)});
test('unknown license is visible INCOMPLETE without inventing approval',async t=>{const f=await fixture(t,async x=>fs.writeFile(path.join(x.repo,'node_modules/fixture-library/package.json'),JSON.stringify({name:'fixture-library',version:'1.2.3'})));const{report}=await load().auditRelease(f.options);assert.equal(report.licenses[0].status,'INCOMPLETE_LICENSE_METADATA_OR_NOTICE');assert.equal(report.releaseReady,false)});
test('missing notice is visible INCOMPLETE',async t=>{const f=await fixture(t,async x=>fs.unlink(path.join(x.repo,'node_modules/fixture-library/LICENSE')));const{report}=await load().auditRelease(f.options);assert.equal(report.licenses[0].status,'INCOMPLETE_LICENSE_METADATA_OR_NOTICE')});
test('duplicate runtime provenance is rejected',async t=>{const f=await fixture(t,x=>x.receipt.inventory[3]={...x.receipt.inventory[0]});await assert.rejects(load().auditRelease(f.options),/runtime/i)});
test('truncated ZIP is a failure, never a partially successful inventory',async t=>{const f=await fixture(t);const raw=(await fs.readFile(f.options.vsixPath)).subarray(0,50);await fs.writeFile(f.options.vsixPath,raw);await assert.rejects(load().auditRelease({...f.options,expectedSha256:sha(raw)}),/zip|archive|central|signature/i)});
test('archive entry with excessive expanded size is refused',async t=>{const f=await fixture(t,x=>x.entries.set('extension/README.md',Buffer.alloc(9*1024*1024,32)));await assert.rejects(load().auditRelease(f.options),/bound|size|budget/i)});
test('deterministic SBOM and report do not include current timestamps or guessed results',async t=>{const f=await fixture(t),a=await load().auditRelease(f.options),b=await load().auditRelease(f.options);assert.deepEqual(a,b);assert.equal(a.report.platforms['linux'],'NOT_TESTED');assert.equal(a.report.platforms['darwin'],'NOT_TESTED');assert.equal(a.report.platforms.remote,'NOT_TESTED')});
