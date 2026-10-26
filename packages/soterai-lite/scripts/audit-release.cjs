// Offline, detached artifact inventory. Never imports extension code or performs a publish/audit request.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{TextDecoder}=require('node:util'),yauzl=require('yauzl');
const RUNTIMES=['extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js'];
const ASSETS=['README.md','CHANGELOG.md','LICENSE.md','media/icon.svg','media/logo_circle_whiter.png','media/walkthrough/demo.md','media/walkthrough/vault.md','media/walkthrough/integrate.md'];
const ENTRIES=['[Content_Types].xml','extension.vsixmanifest','extension/package.json',...RUNTIMES.map(x=>'extension/dist/'+x),...ASSETS.map(x=>'extension/'+x)].sort();
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
async function archive(raw){
 const zip=await yauzl.fromBufferPromise(raw,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true});
 const entries=new Map();let total=0;
 try{for await(const entry of zip.eachEntry()){
  // vsce canonicalizes only these two documentation names. Case-folded
  // uniqueness still rejects an archive carrying both spellings.
  const name=entry.fileName,allowed=ENTRIES.includes(name)||name==='extension/readme.md'||name==='extension/changelog.md';
  demand(allowed&&!entries.has(name)&&![...entries.keys()].some(x=>x.toLowerCase()===name.toLowerCase()),'Unexpected, duplicate or aliased archive entry');
  demand(entries.size<ENTRIES.length&&entry.uncompressedSize<=8*1024*1024&&entry.compressedSize<=16*1024*1024,'Archive entry size bound exceeded');
  total+=entry.uncompressedSize;demand(total<=32*1024*1024,'Archive total size budget exceeded');
  demand((entry.generalPurposeBitFlag&1)===0,'Encrypted archive entry refused');
  const mode=(entry.externalFileAttributes>>>16)&0o170000;demand(mode===0||mode===0o100000,'Non-file archive entry refused');
  const stream=await zip.openReadStreamPromise(entry),chunks=[];let size=0;
  for await(const chunk of stream){size+=chunk.length;demand(size<=entry.uncompressedSize&&size<=8*1024*1024,'Expanded entry size bound exceeded');chunks.push(chunk);}
  demand(size===entry.uncompressedSize,'Truncated archive entry');entries.set(name,Buffer.concat(chunks));
 }}finally{zip.close();}
 demand(entries.size===ENTRIES.length,'Missing archive entry/runtime');return entries;
}
async function auditRelease({repoRoot,vsixPath,expectedSha256,buildReceiptPath}){
 const root=path.resolve(repoRoot);demand(/^[a-f0-9]{64}$/.test(expectedSha256),'Exact lowercase artifact SHA256 required');
 const artifact=await read(root,path.resolve(vsixPath),16*1024*1024);demand(sha(artifact)===expectedSha256,'Artifact hash mismatch');
 const receiptRaw=await read(root,path.resolve(buildReceiptPath),2*1024*1024),receipt=parse(receiptRaw);
 demand(receipt.status==='BUILT_NOT_HOST_VERIFIED'&&receipt.runtimeCount===4&&Array.isArray(receipt.inventory)&&receipt.inventory.length===4,'Four-runtime build provenance required');
 const entries=await archive(artifact),manifest=parse(entries.get('extension/package.json'));
 demand(manifest.publisher==='soterai'&&manifest.name==='soterai-ide-guard'&&manifest.main==='./dist/extension.js'&&/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(manifest.version)&&receipt.identity===manifest.publisher+'.'+manifest.name&&receipt.version===manifest.version,'Artifact identity/provenance mismatch');
 const xml=decode(entries.get('extension.vsixmanifest'));demand(!/<!DOCTYPE|<!ENTITY/i.test(xml),'Unsupported archive XML');const identities=[...xml.matchAll(/<Identity\b([^>]*)\/?\s*>/g)];demand(identities.length===1,'Unique platform identity required');
 for(const[key,value]of Object.entries({TargetPlatform:'win32-x64',Publisher:manifest.publisher,Id:manifest.name,Version:manifest.version})){const found=new RegExp('\\b'+key+'="([^"]*)"').exec(identities[0][1]);demand(found&&found[1]===value,'Archive platform/identity mismatch');}
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
 const components=[],licenses=[];
 for(const[rootRelative,records]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const packagePath=rootRelative+'/package.json',metadataRaw=await read(root,path.join(root,packagePath),256*1024),metadata=parse(metadataRaw);
  demand(typeof metadata.name==='string'&&/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(metadata.name)&&typeof metadata.version==='string'&&/^[a-z0-9.+_-]{1,96}$/i.test(metadata.version),'Invalid dependency identity');
  const tail=rootRelative.slice(rootRelative.lastIndexOf('node_modules/')+'node_modules/'.length);demand(metadata.name===tail,'Dependency identity/path mismatch');
  const license=typeof metadata.license==='string'&&/^[A-Za-z0-9 .+()/_-]{1,128}$/.test(metadata.license)?metadata.license:undefined;
  const names=(await fs.readdir(path.join(root,rootRelative))).filter(name=>/^(?:licen[cs]e(?:[._-].*)?|copying(?:[._-].*)?|notice(?:[._-].*)?)$/i.test(name)).sort();const notices=[];
  demand(names.length<=16,'License notice count bound exceeded');for(const name of names){const content=await read(root,path.join(root,rootRelative,name),256*1024);notices.push({path:rootRelative+'/'+name,bytes:content.length,sha256:sha(content)});}
  const ref='npm:'+rootRelative+'@'+metadata.version,purl='pkg:npm/'+metadata.name.split('/').map(encodeURIComponent).join('/')+'@'+encodeURIComponent(metadata.version);
  const bundledRuntimes=[...new Set(records.flatMap(x=>[...x.runtimes]))].sort();
  components.push({type:'library','bom-ref':ref,name:metadata.name,version:metadata.version,purl,...(license?{licenses:[{license:{name:license}}]}:{}),properties:[{name:'soterai:package-root',value:rootRelative},{name:'soterai:package-metadata-sha256',value:sha(metadataRaw)},{name:'soterai:bundled-input-count',value:String(records.length)},{name:'soterai:bundled-runtimes',value:JSON.stringify(bundledRuntimes)}]});
  licenses.push({name:metadata.name,version:metadata.version,metadata:{path:packagePath,bytes:metadataRaw.length,sha256:sha(metadataRaw)},license:license||'UNKNOWN',notices,status:license&&notices.length>0?'METADATA_AND_NOTICE_PRESENT_NOT_LEGAL_APPROVAL':'INCOMPLETE_LICENSE_METADATA_OR_NOTICE'});
 }
 const rootRef='vsix:'+expectedSha256;
 const sbom={bomFormat:'CycloneDX',specVersion:'1.6',version:1,metadata:{component:{type:'application','bom-ref':rootRef,name:receipt.identity,version:receipt.version,hashes:[{alg:'SHA-256',content:expectedSha256}]}},components,dependencies:[{ref:rootRef,dependsOn:components.map(x=>x['bom-ref'])}]};
 const report={schemaVersion:1,status:'PASS_OFFLINE_INVENTORY_ONLY',releaseReady:false,artifact:{name:path.basename(vsixPath),bytes:artifact.length,sha256:expectedSha256},buildReceipt:{bytes:receiptRaw.length,sha256:sha(receiptRaw)},identity:receipt.identity,version:receipt.version,target:'win32-x64',entries:[...entries].sort(([a],[b])=>a.localeCompare(b)).map(([name,raw])=>({path:name,bytes:raw.length,sha256:sha(raw)})),runtimes:runtimes.sort((a,b)=>a.name.localeCompare(b.name)),sourceInputs:[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path)).map(x=>({path:x.path,bytes:x.bytes,sha256:x.sha256,runtimes:[...x.runtimes].sort()})),licenses,platforms:{'win32-x64':'ARTIFACT_METADATA_ONLY_NO_NEW_NATIVE_RUN',linux:'NOT_TESTED',darwin:'NOT_TESTED',remote:'NOT_TESTED'},vulnerabilityAudit:'NOT_RUN_NETWORK_NOT_AUTHORIZED',marketplacePublication:'NOT_RUN',sbomPlacement:'DETACHED_NOT_EMBEDDED_IN_THIS_VSIX',remainingReleaseGates:['All required feature/native/human gates and final claims remain required','F31b final shipped notices/privacy/SBOM and exact-object inspection','Owner publisher/identity finalization','Authorized current dependency vulnerability audit'],limitations:'Source-file hashes and package metadata enumerate bundled inputs; no tarball reproducibility, legal approval, vulnerability-free or native/human coverage claim.'};
 // Recheck the explicitly pinned immutable artifacts before returning any result.
 demand(sha(await read(root,path.resolve(vsixPath),16*1024*1024))===expectedSha256,'Artifact changed during audit');demand(sha(await read(root,path.resolve(buildReceiptPath),2*1024*1024))===sha(receiptRaw),'Build receipt changed during audit');
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
module.exports={auditRelease};
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Offline release audit failed; no release-ready result. Verify explicit artifact, provenance, bounds and new output directory.');process.exitCode=1;});
