// Offline, detached artifact inventory. Never imports extension code or performs a publish/audit request.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{TextDecoder}=require('node:util'),yauzl=require('yauzl');
const RUNTIMES=['extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js'];
const ASSETS=['README.md','CHANGELOG.md','LICENSE.md','media/icon.svg','media/logo_circle_whiter.png','media/walkthrough/demo.md','media/walkthrough/vault.md','media/walkthrough/integrate.md'];
const ENTRIES=['[Content_Types].xml','extension.vsixmanifest','extension/package.json',...RUNTIMES.map(x=>'extension/dist/'+x),...ASSETS.map(x=>'extension/'+x)].sort();
const FINAL_ASSETS=[...ASSETS,'PRIVACY.md','THIRD-PARTY-NOTICES.md','SBOM.cdx.json'];
const FULL_LICENSE_SHA256='50850df5d69907a09666f7ce40740b5bb54d1b6bbdd5c39ed9ad7b7e9f86a253';
const {createEmbeddedMetadata}=require('./release-metadata.cjs');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const decode=raw=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
const parse=raw=>JSON.parse(decode(raw));
function demand(ok,message){if(!ok)throw new Error(message);}
function relative(value){demand(typeof value==='string'&&value.length<=1024&&!/[\\:\x00-\x1f\x7f]/.test(value)&&!path.isAbsolute(value)&&value.split('/').every(x=>x&&x!=='.'&&x!=='..'),'Unsafe input path');return value;}
async function ordinary(root,file){
 const full=path.resolve(file);demand(full.startsWith(root+path.sep),'Input path escaped repository');
 for(let cursor=full;;cursor=path.dirname(cursor)){const item=await fs.lstat(cursor);demand(!item.isSymbolicLink(),'Linked input path refused');if(cursor===root)break;}
 const stat=await fs.lstat(full);demand(stat.isFile()&&stat.nlink===1,'Ordinary input file required');demand((await fs.realpath(full)).toLowerCase()===full.toLowerCase(),'Aliased input path refused');return stat;
}
async function read(root,file,cap){
 const before=await ordinary(root,file);demand(before.size<=cap,'Input size bound exceeded');const raw=await fs.readFile(file);const after=await ordinary(root,file);
 demand(raw.length===before.size&&after.size===before.size&&after.ino===before.ino&&after.mtimeMs===before.mtimeMs&&after.ctimeMs===before.ctimeMs,'Input changed while reading');return raw;
}
function codeInput(name){relative(name);demand(!/(?:^|\/)(?:__tests__|fixtures|evidence)(?:\/|$)/.test(name)&&/\.(?:[cm]?js|ts|json)$/.test(name),'Unsupported build input path');demand(/^(?:node_modules\/|packages\/(?:core|detectors|guard-core|soterai-lite|vscode-extension)\/(?:src|dist)\/|apps\/local-ai-broker\/src\/)/.test(name),'Unsupported build input path');}
function packageRoot(input){const parts=input.split('/'),at=parts.lastIndexOf('node_modules');if(at<0)return undefined;const count=parts[at+1]?.startsWith('@')?2:1;demand(parts.length>at+count+1,'Invalid dependency input path');return parts.slice(0,at+count+1).join('/');}
async function archive(raw,final=false){
 const expected=final?[...ENTRIES,'extension/PRIVACY.md','extension/THIRD-PARTY-NOTICES.md','extension/SBOM.cdx.json']:ENTRIES;
 const zip=await yauzl.fromBufferPromise(raw,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true});
 const entries=new Map();let total=0;
 try{for await(const entry of zip.eachEntry()){
  // vsce canonicalizes only these two documentation names. Case-folded
  // uniqueness still rejects an archive carrying both spellings.
  const name=entry.fileName,allowed=expected.includes(name)||name==='extension/readme.md'||name==='extension/changelog.md';
  demand(allowed&&!entries.has(name)&&![...entries.keys()].some(x=>x.toLowerCase()===name.toLowerCase()),'Unexpected, duplicate or aliased archive entry');
  demand(entries.size<expected.length&&entry.uncompressedSize<=8*1024*1024&&entry.compressedSize<=16*1024*1024,'Archive entry size bound exceeded');
  total+=entry.uncompressedSize;demand(total<=32*1024*1024,'Archive total size budget exceeded');
  demand((entry.generalPurposeBitFlag&1)===0,'Encrypted archive entry refused');
  const mode=(entry.externalFileAttributes>>>16)&0o170000;demand(mode===0||mode===0o100000,'Non-file archive entry refused');
  const stream=await zip.openReadStreamPromise(entry),chunks=[];let size=0;
  for await(const chunk of stream){size+=chunk.length;demand(size<=entry.uncompressedSize&&size<=8*1024*1024,'Expanded entry size bound exceeded');chunks.push(chunk);}
  demand(size===entry.uncompressedSize,'Truncated archive entry');entries.set(name,Buffer.concat(chunks));
 }}finally{zip.close();}
 demand(entries.size===expected.length,'Missing archive entry/runtime');return entries;
}
async function inspectProvenance(root,receipt,entries){
 demand(receipt.status==='BUILT_NOT_HOST_VERIFIED'&&receipt.runtimeCount===4&&Array.isArray(receipt.inventory)&&receipt.inventory.length===4,'Four-runtime build provenance required');
 const seen=new Set(),inputs=new Map(),runtimes=[];
 for(const runtime of receipt.inventory){
  demand(runtime&&RUNTIMES.includes(runtime.name)&&!seen.has(runtime.name),'Duplicate or unknown runtime provenance');seen.add(runtime.name);
  const raw=entries.get('extension/dist/'+runtime.name);demand(Number.isSafeInteger(runtime.bytes)&&raw.length===runtime.bytes&&sha(raw)===runtime.sha256,'Runtime hash/provenance mismatch');
  demand(Array.isArray(runtime.inputs)&&runtime.inputs.length>0&&runtime.inputs.length<=4096,'Runtime input inventory required');
  const local=new Set();for(const input of runtime.inputs){
   codeInput(input.path);demand(!local.has(input.path)&&Number.isSafeInteger(input.bytes)&&input.bytes>=0&&input.bytes<=8*1024*1024&&/^[a-f0-9]{64}$/.test(input.sha256),'Invalid build input inventory');local.add(input.path);
   let known=inputs.get(input.path);
   if(known){demand(known.bytes===input.bytes&&known.sha256===input.sha256,'Conflicting build input hashes');known.runtimes.add(runtime.name);}
   else{demand(inputs.size<4096,'Build input count bound exceeded');const content=await read(root,path.join(root,input.path),8*1024*1024);demand(content.length===input.bytes&&sha(content)===input.sha256,'Build input hash mismatch');known={...input,runtimes:new Set([runtime.name])};inputs.set(input.path,known);}
  }
  runtimes.push({name:runtime.name,bytes:raw.length,sha256:sha(raw),inputCount:runtime.inputs.length});
 }
 const groups=new Map();for(const input of inputs.values()){const name=packageRoot(input.path);if(name){if(!groups.has(name))groups.set(name,[]);groups.get(name).push(input);}}
 const components=[],licenses=[],noticeContents=[];
 for(const[rootRelative,records]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const packagePath=rootRelative+'/package.json',metadataRaw=await read(root,path.join(root,packagePath),256*1024),metadata=parse(metadataRaw);
  demand(typeof metadata.name==='string'&&/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(metadata.name)&&typeof metadata.version==='string'&&/^[a-z0-9.+_-]{1,96}$/i.test(metadata.version),'Invalid dependency identity');
  const tail=rootRelative.slice(rootRelative.lastIndexOf('node_modules/')+'node_modules/'.length);demand(metadata.name===tail,'Dependency identity/path mismatch');
  const license=typeof metadata.license==='string'&&/^[A-Za-z0-9 .+()/_-]{1,128}$/.test(metadata.license)?metadata.license:undefined;
  const names=(await fs.readdir(path.join(root,rootRelative))).filter(name=>/^(?:licen[cs]e(?:[._-].*)?|copying(?:[._-].*)?|notice(?:[._-].*)?)$/i.test(name)).sort();const notices=[];
  const retained=[];
  demand(names.length<=16,'License notice count bound exceeded');for(const name of names){const content=await read(root,path.join(root,rootRelative,name),256*1024);notices.push({path:rootRelative+'/'+name,bytes:content.length,sha256:sha(content)});retained.push({path:rootRelative+'/'+name,raw:content});}
  const ref='npm:'+rootRelative+'@'+metadata.version,purl='pkg:npm/'+metadata.name.split('/').map(encodeURIComponent).join('/')+'@'+encodeURIComponent(metadata.version);
  const bundledRuntimes=[...new Set(records.flatMap(x=>[...x.runtimes]))].sort();
  components.push({type:'library','bom-ref':ref,name:metadata.name,version:metadata.version,purl,...(license?{licenses:[{license:{name:license}}]}:{}),properties:[{name:'soterai:package-root',value:rootRelative},{name:'soterai:package-metadata-sha256',value:sha(metadataRaw)},{name:'soterai:bundled-input-count',value:String(records.length)},{name:'soterai:bundled-runtimes',value:JSON.stringify(bundledRuntimes)}]});
  licenses.push({name:metadata.name,version:metadata.version,metadata:{path:packagePath,bytes:metadataRaw.length,sha256:sha(metadataRaw)},license:license||'UNKNOWN',notices,status:license&&notices.length>0?'METADATA_AND_NOTICE_PRESENT_NOT_LEGAL_APPROVAL':'INCOMPLETE_LICENSE_METADATA_OR_NOTICE'});
  noticeContents.push({name:metadata.name,version:metadata.version,notices:retained});
 }
 return{inputs,runtimes,components,licenses,noticeContents};
}
const sourceRows=inputs=>[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path)).map(x=>({path:x.path,bytes:x.bytes,sha256:x.sha256,runtimes:[...x.runtimes].sort()}));
function embedded(receiptRaw,receipt,inventory){return createEmbeddedMetadata({identity:receipt.identity,version:receipt.version,buildReceiptSha256:sha(receiptRaw),runtimes:inventory.runtimes,sourceInputs:sourceRows(inventory.inputs),components:inventory.components,licenses:inventory.licenses,noticeContents:inventory.noticeContents.map(x=>({...x,notices:x.notices.map(n=>({path:n.path,content:decode(n.raw)}))}))});}
function finalLayout(root,buildReceiptPath){
 const relativeReceipt=path.relative(root,path.resolve(buildReceiptPath)).replaceAll('\\','/');
 demand(/^packages\/soterai-lite\/builds\/[A-Za-z0-9._-]{1,128}\/build-provenance\.json$/.test(relativeReceipt),'Final build receipt layout refused');
 return{packageRoot:path.join(root,'packages/soterai-lite'),attempt:path.dirname(path.resolve(buildReceiptPath))};
}
function finalXml(raw){
 const text=raw.replace(/<!--[\s\S]*?-->/g,'');demand(!/<!/.test(text),'Unsupported final XML construct');
 // The installed packager uses this same bounded, local SAX dependency through xml2js.
 // Regex extraction below supplies contract checks only after document admission.
 const parser=require('sax').parser(true,{xmlns:true});let depth=0,roots=0;
 parser.onerror=()=>{throw new Error('Malformed final XML');};
 parser.onopentag=()=>{if(depth++===0)roots++;demand(roots===1,'Malformed final XML document roots');};
 parser.onclosetag=()=>{depth--;demand(depth>=0,'Malformed final XML nesting');};
 parser.ontext=value=>demand(depth>0||value.trim()==='','Malformed final XML outside root');
 parser.write(raw).close();demand(depth===0&&roots===1,'Malformed final XML document');return text;
}
function attributes(text){const out=new Map(),expression=/([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"<]*)"/g;for(const match of text.matchAll(expression)){demand(!out.has(match[1]),'Duplicate XML attribute');out.set(match[1],match[2]);}demand(text.replace(expression,'').replace(/\//g,'').trim()==='','Malformed XML attributes');return out;}
async function prepareReleaseAssets({repoRoot,buildReceiptPath}){
 const root=path.resolve(repoRoot),{attempt}=finalLayout(root,buildReceiptPath),raw=await read(root,path.resolve(buildReceiptPath),2*1024*1024),receipt=parse(raw),entries=new Map();
 demand(Array.isArray(receipt.inventory)&&receipt.inventory.length===4,'Four-runtime build provenance required');
 for(const item of receipt.inventory){demand(RUNTIMES.includes(item.name),'Unknown runtime');entries.set('extension/dist/'+item.name,await read(root,path.join(attempt,'dist',item.name),8*1024*1024));}
 const manifestRaw=await read(root,path.join(attempt,'package.json'),2*1024*1024);demand(sha(manifestRaw)===receipt.manifestSha256,'Immutable build manifest mismatch');
 return embedded(raw,receipt,await inspectProvenance(root,receipt,entries));
}
async function verifyFinal({root,receiptRaw,receipt,entries,manifest,xml,inventory,buildReceiptPath,packageReceiptPath,expectedSha256,artifact}){
 const {packageRoot,attempt}=finalLayout(root,buildReceiptPath);demand(typeof packageReceiptPath==='string'&&path.resolve(packageReceiptPath)===path.join(attempt,'package-receipt.json'),'Final package asset receipt required');
 const packageRaw=await read(root,path.resolve(packageReceiptPath),2*1024*1024),pack=parse(packageRaw);
 demand(pack.status==='PACKAGED_NOT_HOST_VERIFIED'&&pack.sha256===expectedSha256&&pack.bytes===artifact.length&&pack.buildReceiptSha256===sha(receiptRaw),'Final package provenance mismatch');
 const properties=[...xml.matchAll(/<Properties>([\s\S]*?)<\/Properties>/g)];demand(properties.length===1,'Actual pre-release XML properties required');const prerelease=[...properties[0][1].matchAll(/<Property\b([^>]*)\/?\s*>/g)].map(x=>attributes(x[1])).filter(x=>x.get('Id')==='Microsoft.VisualStudio.Code.PreRelease');demand(prerelease.length===1&&prerelease[0].get('Value')==='true','Actual pre-release XML property required');
 demand(manifest.capabilities?.virtualWorkspaces?.supported===false,'Unsupported virtual-workspace declaration required');demand(manifest.capabilities?.untrustedWorkspaces?.supported==='limited'&&typeof manifest.capabilities.untrustedWorkspaces.description==='string'&&manifest.capabilities.untrustedWorkspaces.description.length>0,'Limited-trust manifest required');
 demand(manifest.soteraiLiteRelease?.schemaVersion===1&&manifest.soteraiLiteRelease.channel==='pre-release'&&JSON.stringify(manifest.soteraiLiteRelease.unsupportedFeatures)===JSON.stringify(['preCommit']),'Pre-commit release capability exclusion required');
 const originalManifest=await read(root,path.join(attempt,'package.json'),2*1024*1024);demand(sha(originalManifest)===receipt.manifestSha256,'Build manifest changed');const staged=parse(originalManifest);delete staged.scripts;delete staged.devDependencies;const expectedManifest=Buffer.from(JSON.stringify(staged,null,2)+'\n');demand(entries.get('extension/package.json').equals(expectedManifest)&&pack.stagedManifestSha256===sha(expectedManifest),'Staged manifest provenance mismatch');
 demand(Array.isArray(pack.assets)&&pack.assets.length===FINAL_ASSETS.length,'Complete final asset receipt required');
 const names=new Set();
 for(const row of pack.assets){demand(row&&FINAL_ASSETS.includes(row.path)&&!names.has(row.path),'Invalid final asset receipt');names.add(row.path);const source=['SBOM.cdx.json','THIRD-PARTY-NOTICES.md'].includes(row.path)?path.join(attempt,'release-assets',row.path):path.join(packageRoot,row.path);demand(row.source===path.relative(root,source).replaceAll('\\','/'),'Final asset source path mismatch');const raw=await read(root,source,8*1024*1024),packed=entries.get('extension/'+row.path)??entries.get('extension/'+row.path.toLowerCase());demand(packed&&raw.equals(packed)&&raw.length===row.bytes&&sha(raw)===row.sha256,'Final asset changed or provenance mismatch');}
 demand(sha(entries.get('extension/LICENSE.md'))===FULL_LICENSE_SHA256,'Complete selected BUSL license required');
 const generated=embedded(receiptRaw,receipt,inventory);demand(entries.get('extension/SBOM.cdx.json').equals(Buffer.from(JSON.stringify(generated.sbom,null,2)+'\n')),'Embedded SBOM metadata mismatch');demand(entries.get('extension/THIRD-PARTY-NOTICES.md').equals(Buffer.from(generated.notices)),'Embedded third-party notices mismatch');
 demand(sha(await read(root,path.resolve(packageReceiptPath),2*1024*1024))===sha(packageRaw),'Package receipt changed during audit');
 return{generated,packageReceipt:{bytes:packageRaw.length,sha256:sha(packageRaw)}};
}
async function auditRelease({repoRoot,vsixPath,expectedSha256,buildReceiptPath,final=false,packageReceiptPath}){
 const root=path.resolve(repoRoot);demand(/^[a-f0-9]{64}$/.test(expectedSha256),'Exact lowercase artifact SHA256 required');
 const artifact=await read(root,path.resolve(vsixPath),16*1024*1024);demand(sha(artifact)===expectedSha256,'Artifact hash mismatch');
 const receiptRaw=await read(root,path.resolve(buildReceiptPath),2*1024*1024),receipt=parse(receiptRaw),entries=await archive(artifact,final),manifest=parse(entries.get('extension/package.json'));
 demand(manifest.publisher==='soterai'&&manifest.name==='soterai-ide-guard'&&manifest.main==='./dist/extension.js'&&/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(manifest.version)&&receipt.identity===manifest.publisher+'.'+manifest.name&&receipt.version===manifest.version,'Artifact identity/provenance mismatch');
 if(final)finalXml(decode(entries.get('[Content_Types].xml')));
 const xml=final?finalXml(decode(entries.get('extension.vsixmanifest'))):decode(entries.get('extension.vsixmanifest'));demand(!/<!DOCTYPE|<!ENTITY/i.test(xml),'Unsupported archive XML');const identities=[...xml.matchAll(/<Identity\b([^>]*)\/?\s*>/g)];demand(identities.length===1,'Unique platform identity required');
 if(final)attributes(identities[0][1]);
 for(const[key,value]of Object.entries({TargetPlatform:'win32-x64',Publisher:manifest.publisher,Id:manifest.name,Version:manifest.version})){const found=new RegExp('\\b'+key+'="([^"]*)"').exec(identities[0][1]);demand(found&&found[1]===value,'Archive platform/identity mismatch');}
 const inventory=await inspectProvenance(root,receipt,entries),{inputs,runtimes,components,licenses}=inventory;
 const rootRef='vsix:'+expectedSha256;
 const sbom={bomFormat:'CycloneDX',specVersion:'1.6',version:1,metadata:{component:{type:'application','bom-ref':rootRef,name:receipt.identity,version:receipt.version,hashes:[{alg:'SHA-256',content:expectedSha256}]}},components,dependencies:[{ref:rootRef,dependsOn:components.map(x=>x['bom-ref'])}]};
 const report={schemaVersion:1,status:'PASS_OFFLINE_INVENTORY_ONLY',releaseReady:false,artifact:{name:path.basename(vsixPath),bytes:artifact.length,sha256:expectedSha256},buildReceipt:{bytes:receiptRaw.length,sha256:sha(receiptRaw)},identity:receipt.identity,version:receipt.version,target:'win32-x64',entries:[...entries].sort(([a],[b])=>a.localeCompare(b)).map(([name,raw])=>({path:name,bytes:raw.length,sha256:sha(raw)})),runtimes:runtimes.sort((a,b)=>a.name.localeCompare(b.name)),sourceInputs:[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path)).map(x=>({path:x.path,bytes:x.bytes,sha256:x.sha256,runtimes:[...x.runtimes].sort()})),licenses,platforms:{'win32-x64':'ARTIFACT_METADATA_ONLY_NO_NEW_NATIVE_RUN',linux:'NOT_TESTED',darwin:'NOT_TESTED',remote:'NOT_TESTED'},vulnerabilityAudit:'NOT_RUN_NETWORK_NOT_AUTHORIZED',marketplacePublication:'NOT_RUN',sbomPlacement:'DETACHED_NOT_EMBEDDED_IN_THIS_VSIX',remainingReleaseGates:['All required feature/native/human gates and final claims remain required','F31b final shipped notices/privacy/SBOM and exact-object inspection','Owner publisher/identity finalization','Authorized current dependency vulnerability audit'],limitations:'Source-file hashes and package metadata enumerate bundled inputs; no tarball reproducibility, legal approval, vulnerability-free or native/human coverage claim.'};
 // Recheck the explicitly pinned immutable artifacts before returning any result.
 demand(sha(await read(root,path.resolve(vsixPath),16*1024*1024))===expectedSha256,'Artifact changed during audit');demand(sha(await read(root,path.resolve(buildReceiptPath),2*1024*1024))===sha(receiptRaw),'Build receipt changed during audit');
 if(final){const verified=await verifyFinal({root,receiptRaw,receipt,entries,manifest,xml,inventory,buildReceiptPath,packageReceiptPath,expectedSha256,artifact});report.status='PASS_FINAL_OFFLINE_PACKAGE_NOT_RELEASE_READY';report.sbomPlacement='EMBEDDED_RECOMPUTED_FROM_CURRENT_PROVENANCE';report.preRelease=true;report.unsupportedFeatures=['preCommit'];report.packageReceipt=verified.packageReceipt;report.embeddedSbomSha256=sha(entries.get('extension/SBOM.cdx.json'));report.remainingReleaseGates=['F31b supported native/tool verification and scoped commit','F32 installed-only lifecycle','V01-V05 including exact-object human/independent evidence','Owner publisher/identity and advisory audit decisions'];report.limitations+=' F26a pre-commit is owner-skipped and unsupported; no final native PASS. New pre-commit grants are withdrawn; reviewed recovery remains.';return{report,sbom:verified.generated.sbom};}
 return {report,sbom};
}
async function main(args){
 demand(args.length===8&&args[0]==='--vsix'&&args[2]==='--sha256'&&args[4]==='--receipt'&&args[6]==='--out','Use --vsix PATH --sha256 HASH --receipt PATH --out NEW_WORKSPACE_DIRECTORY');
 const repoRoot=path.resolve(__dirname,'../../..'),output=path.resolve(args[7]);demand(output.startsWith(repoRoot+path.sep),'Output must stay in workspace');
 // The parent must already exist and be ordinary; refuse linked parents and overwrites.
 for(let cursor=path.dirname(output);;cursor=path.dirname(cursor)){const stat=await fs.lstat(cursor);demand(stat.isDirectory()&&!stat.isSymbolicLink(),'Ordinary output parent required');if(cursor===repoRoot)break;}
 try{await fs.lstat(output);throw new Error('Output overwrite refused');}catch(error){if(error.code!=='ENOENT')throw error;}
 const result=await auditRelease({repoRoot,vsixPath:path.resolve(args[1]),expectedSha256:args[3],buildReceiptPath:path.resolve(args[5])});
 await fs.mkdir(output);await fs.writeFile(path.join(output,'release-inventory.json'),JSON.stringify(result.report,null,2)+'\n',{flag:'wx'});await fs.writeFile(path.join(output,'sbom.cdx.json'),JSON.stringify(result.sbom,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:result.report.status,artifactSha256:args[3],entries:result.report.entries.length,runtimes:result.report.runtimes.length,bundledComponents:result.sbom.components.length,releaseReady:false}));
}
module.exports={auditRelease,auditFinalRelease:options=>auditRelease({...options,final:true}),prepareReleaseAssets,FINAL_ASSETS};
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Offline release audit failed; no release-ready result. Verify explicit artifact, provenance, bounds and new output directory.');process.exitCode=1;});
