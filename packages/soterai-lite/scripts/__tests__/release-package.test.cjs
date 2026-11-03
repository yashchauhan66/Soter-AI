'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{ZipFile}=require('yazl');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),runtimes=['extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js'];
const baseAssets=['README.md','CHANGELOG.md','LICENSE.md','media/icon.svg','media/logo_circle_whiter.png','media/walkthrough/demo.md','media/walkthrough/vault.md','media/walkthrough/integrate.md'];
const repoActual=path.resolve(__dirname,'../../../..');
const api=()=>require('../audit-release.cjs');
async function write(file,raw){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,raw,{flag:'wx'});}
async function zip(entries){const z=new ZipFile(),chunks=[];z.outputStream.on('data',b=>chunks.push(b));const done=new Promise((resolve,reject)=>{z.outputStream.on('end',resolve);z.outputStream.on('error',reject);});for(const[n,b]of entries)z.addBuffer(b,n);z.end();await done;return Buffer.concat(chunks);}
async function fixture(change=()=>{},buildOnly=false){
 const repo=await fs.mkdtemp(path.join(os.tmpdir(),'soterai-f31b-synthetic-')),root=path.join(repo,'packages/soterai-lite'),attempt=path.join(root,'builds/synthetic');
 const input=Buffer.from('module.exports=1;'),inputPath='node_modules/fixture-library/index.js';await write(path.join(repo,inputPath),input);await write(path.join(repo,'node_modules/fixture-library/package.json'),JSON.stringify({name:'fixture-library',version:'1.2.3',license:'MIT'}));await write(path.join(repo,'node_modules/fixture-library/LICENSE'),'Full synthetic public MIT notice.\n');
 const manifest={name:'soterai-ide-guard',displayName:'SoterAI Lite synthetic',publisher:'soterai',version:'0.7.0',main:'./dist/extension.js',engines:{vscode:'^1.85.0'},license:'SEE LICENSE IN LICENSE.md',description:'Synthetic local package fixture',repository:{type:'git',url:'https://example.invalid/fixture.git'},soteraiLiteRelease:{schemaVersion:1,channel:'pre-release',unsupportedFeatures:['preCommit']},capabilities:{untrustedWorkspaces:{supported:'limited',description:'Local checks only; reviewed operations require a trusted local workspace.'},virtualWorkspaces:{supported:false}}};
 manifest.activationEvents=['onStartupFinished'];
 const manifestRaw=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await write(path.join(attempt,'package.json'),manifestRaw);
 const inventory=[];for(const[name,i]of runtimes.map((n,i)=>[n,i])){const raw=Buffer.from('module.exports='+i+';');await write(path.join(attempt,'dist',name),raw);inventory.push({name,bytes:raw.length,sha256:sha(raw),inputs:[{path:inputPath,bytes:input.length,sha256:sha(input)}]});}
 const receipt={status:'BUILT_NOT_HOST_VERIFIED',identity:'soterai.soterai-ide-guard',version:'0.7.0',runtimeCount:4,manifestSha256:sha(manifestRaw),inventory},receiptPath=path.join(attempt,'build-provenance.json');await write(receiptPath,JSON.stringify(receipt,null,2)+'\n');
 for(const name of [...baseAssets,'PRIVACY.md']){const content=name==='LICENSE.md'?await fs.readFile(path.join(repoActual,'docs/soterai-lite/evidence/20261102-release-gate-readiness/historical-extension-BUSL11.txt')):Buffer.from('Synthetic public asset '+name+'\n');await write(path.join(root,name),content);}
 if(buildOnly)return{repo,root,attempt,receipt,receiptPath,manifest};
 const generated=await api().prepareReleaseAssets({repoRoot:repo,buildReceiptPath:receiptPath});
 await write(path.join(attempt,'release-assets/SBOM.cdx.json'),JSON.stringify(generated.sbom,null,2)+'\n');await write(path.join(attempt,'release-assets/THIRD-PARTY-NOTICES.md'),generated.notices);
 const entries=new Map([['[Content_Types].xml',Buffer.from('<Types/>')],['extension.vsixmanifest',Buffer.from('<PackageManifest><Metadata><Identity Id="soterai-ide-guard" Version="0.7.0" Publisher="soterai" TargetPlatform="win32-x64"/><Properties><Property Id="Microsoft.VisualStudio.Code.PreRelease" Value="true"/></Properties></Metadata></PackageManifest>')],['extension/package.json',manifestRaw]]),assets=[];
 for(const row of inventory)entries.set('extension/dist/'+row.name,await fs.readFile(path.join(attempt,'dist',row.name)));
 for(const name of [...baseAssets,'PRIVACY.md','SBOM.cdx.json','THIRD-PARTY-NOTICES.md']){const source=['SBOM.cdx.json','THIRD-PARTY-NOTICES.md'].includes(name)?path.join(attempt,'release-assets',name):path.join(root,name),raw=await fs.readFile(source);entries.set('extension/'+name,raw);assets.push({path:name,source:path.relative(repo,source).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)});}
 const context={repo,root,attempt,receipt,receiptPath,manifest,entries,assets};await change(context);
 const raw=await zip(entries),vsixPath=path.join(repo,'synthetic-final.vsix');await write(vsixPath,raw);
 const packageReceipt={status:'PACKAGED_NOT_HOST_VERIFIED',output:path.relative(repo,vsixPath),bytes:raw.length,sha256:sha(raw),buildReceiptSha256:sha(await fs.readFile(receiptPath)),stagedManifestSha256:sha(manifestRaw),assets};const packageReceiptPath=path.join(attempt,'package-receipt.json');await write(packageReceiptPath,JSON.stringify(packageReceipt,null,2)+'\n');
 return{...context,options:{repoRoot:repo,vsixPath,expectedSha256:sha(raw),buildReceiptPath:receiptPath,packageReceiptPath}};
}
test('B07 valid final18 archive recomputes embedded metadata/notices and keeps readiness false',async()=>{const f=await fixture(),x=await api().auditFinalRelease(f.options);assert.equal(x.report.status,'PASS_FINAL_OFFLINE_PACKAGE_NOT_RELEASE_READY');assert.equal(x.report.entries.length,18);assert.equal(x.report.sbomPlacement,'EMBEDDED_RECOMPUTED_FROM_CURRENT_PROVENANCE');assert.equal(x.report.releaseReady,false);assert.equal(x.report.preRelease,true);});
test('B08 missing privacy and unexpected map entries both refuse',async()=>{for(const change of [x=>x.entries.delete('extension/PRIVACY.md'),x=>x.entries.set('extension/dist/extension.js.map',Buffer.from('public synthetic'))]){const f=await fixture(change);await assert.rejects(api().auditFinalRelease(f.options),/entry|asset|missing/i);}});
test('B09 well-formed but changed SBOM refuses independently of archive SHA',async()=>{const f=await fixture(x=>{const b=JSON.parse(x.entries.get('extension/SBOM.cdx.json'));b.components[0].version='9.9.9';x.entries.set('extension/SBOM.cdx.json',Buffer.from(JSON.stringify(b,null,2)+'\n'));});await assert.rejects(api().auditFinalRelease(f.options),/metadata|sbom|asset/i);});
test('B10 preview without actual pre-release XML property refuses',async()=>{const f=await fixture(x=>x.entries.set('extension.vsixmanifest',Buffer.from('<Identity Id="soterai-ide-guard" Version="0.7.0" Publisher="soterai" TargetPlatform="win32-x64"/>')));await assert.rejects(api().auditFinalRelease(f.options),/pre.release/i);});
test('B10 duplicate XML values and comment-only pre-release properties cannot pass',async()=>{for(const change of [s=>s.replace('Value="true"','Value="true" Value="false"'),s=>s.replace('<Property Id="Microsoft.VisualStudio.Code.PreRelease" Value="true"/>','<!-- <Property Id="Microsoft.VisualStudio.Code.PreRelease" Value="true"/> -->')]){const f=await fixture(x=>x.entries.set('extension.vsixmanifest',Buffer.from(change(x.entries.get('extension.vsixmanifest').toString()))));await assert.rejects(api().auditFinalRelease(f.options),/XML|pre.release/i);}});
test('B11 unsupported virtual-workspace declaration must survive packaging',async()=>{const f=await fixture(x=>{x.manifest.capabilities.virtualWorkspaces.supported=true;x.entries.set('extension/package.json',Buffer.from(JSON.stringify(x.manifest)));});await assert.rejects(api().auditFinalRelease(f.options),/manifest|virtual|asset/i);});
test('B12 pre-commit exclusion cannot be removed from final package metadata',async()=>{const f=await fixture(x=>{x.manifest.soteraiLiteRelease.unsupportedFeatures=[];x.entries.set('extension/package.json',Buffer.from(JSON.stringify(x.manifest)));});await assert.rejects(api().auditFinalRelease(f.options),/manifest|pre.commit|capability/i);});
test('B14 complete selected BUSL terms are required byte-for-byte',async()=>{const f=await fixture(x=>x.entries.set('extension/LICENSE.md',Buffer.from('Short license summary')));await assert.rejects(api().auditFinalRelease(f.options),/license|asset/i);});
test('B18 post-package asset source drift refuses',async()=>{const f=await fixture();await fs.writeFile(path.join(f.root,'README.md'),'Changed public asset');await assert.rejects(api().auditFinalRelease(f.options),/asset|changed/i);});
test('B09 changed bundled source cannot be hidden by internally coherent embedded metadata',async()=>{const f=await fixture();await fs.writeFile(path.join(f.repo,'node_modules/fixture-library/index.js'),'module.exports=2;');await assert.rejects(api().auditFinalRelease(f.options),/input|provenance/i);});
test('B16 installed vsce actually emits final18 entries and the pre-release platform property',async()=>{const f=await fixture(()=>{},true),output=path.join(f.repo,'actual-packager.vsix'),result=await require('../package.cjs').packageBuild({repoRoot:f.repo,packageRoot:f.root,buildReceiptPath:f.receiptPath,output});assert.equal(result.preRelease,true);assert.equal(result.releaseReady,false);const audit=await api().auditFinalRelease({repoRoot:f.repo,vsixPath:output,expectedSha256:result.sha256,buildReceiptPath:f.receiptPath,packageReceiptPath:path.join(f.attempt,'package-receipt.json')});assert.equal(audit.report.entries.length,18);assert.equal(audit.report.preRelease,true);});
test('B13 existing final output is never overwritten',async()=>{const f=await fixture(()=>{},true),output=path.join(f.repo,'existing.vsix');await write(output,'Synthetic sentinel');await assert.rejects(require('../package.cjs').packageBuild({repoRoot:f.repo,packageRoot:f.root,buildReceiptPath:f.receiptPath,output}),/overwrite/i);assert.equal(await fs.readFile(output,'utf8'),'Synthetic sentinel');});
module.exports={fixture};

for(const [id,mutate]of [
 ['unclosed tail',s=>s+'<unclosed'],
 ['second document root',s=>s+'<Second/>'],
 ['undeclared entity',s=>s.replace('</Metadata>','<DisplayName>&unknown;</DisplayName></Metadata>')]
])test('B10 malformed final XML refuses '+id,async()=>{
 const f=await fixture(x=>x.entries.set('extension.vsixmanifest',Buffer.from(mutate(x.entries.get('extension.vsixmanifest').toString()))));
 await assert.rejects(api().auditFinalRelease(f.options),/XML|xml|malformed/i);
});

test('B16 actual production files allowlist ships all18 final entries',async()=>{
 const f=await fixture(()=>{},true),actual=JSON.parse(await fs.readFile(path.join(repoActual,'packages/soterai-lite/package.json'),'utf8'));
 f.manifest.files=actual.files;const raw=Buffer.from(JSON.stringify(f.manifest,null,2)+'\n');
 await fs.writeFile(path.join(f.attempt,'package.json'),raw);f.receipt.manifestSha256=crypto.createHash('sha256').update(raw).digest('hex');await fs.writeFile(f.receiptPath,JSON.stringify(f.receipt,null,2)+'\n');
 const output=path.join(f.repo,'production-allowlist.vsix'),result=await require(path.join(repoActual,'packages/soterai-lite/scripts/package.cjs')).packageBuild({repoRoot:f.repo,packageRoot:f.root,buildReceiptPath:f.receiptPath,output});
 const audited=await require(path.join(repoActual,'packages/soterai-lite/scripts/audit-release.cjs')).auditFinalRelease({repoRoot:f.repo,vsixPath:output,expectedSha256:result.sha256,buildReceiptPath:f.receiptPath,packageReceiptPath:path.join(f.attempt,'package-receipt.json')});
 assert.equal(audited.report.entries.length,18);assert.equal(audited.report.preRelease,true);
});

test('B16 preserves reviewed README relative-link bytes with GitHub repository metadata',async()=>{
 const f=await fixture(()=>{},true);f.manifest.repository={type:'git',url:'https://github.com/synthetic-owner/synthetic-fixture.git'};
 const raw=Buffer.from(JSON.stringify(f.manifest,null,2)+'\n');await fs.writeFile(path.join(f.attempt,'package.json'),raw);f.receipt.manifestSha256=crypto.createHash('sha256').update(raw).digest('hex');await fs.writeFile(f.receiptPath,JSON.stringify(f.receipt,null,2)+'\n');
 await fs.writeFile(path.join(f.root,'README.md'),'Reviewed synthetic docs: [Privacy](PRIVACY.md).\n');
 const output=path.join(f.repo,'reviewed-readme.vsix'),result=await require(path.join(repoActual,'packages/soterai-lite/scripts/package.cjs')).packageBuild({repoRoot:f.repo,packageRoot:f.root,buildReceiptPath:f.receiptPath,output});assert.equal(result.preRelease,true);
});
