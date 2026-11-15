'use strict';
// Deterministic build metadata only. No environment, network, runtime or publish API.
const crypto=require('node:crypto');
const RUNTIMES=Object.freeze(['extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js']);
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const demand=(ok,message)=>{if(!ok)throw Error(message);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const relative=value=>typeof value==='string'&&value.length<=1024&&!/[\\:\x00-\x1f\x7f]/.test(value)&&value.split('/').every(x=>x&&x!=='.'&&x!=='..');
const count=(value,cap)=>Number.isSafeInteger(value)&&value>=0&&value<=cap;
function createEmbeddedMetadata(input){
 demand(input&&input.identity==='soterai.soterai-ide-guard'&&/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(input.version),'Invalid release identity');
 demand(hash(input.buildReceiptSha256),'Invalid provenance hash');
 demand(Array.isArray(input.runtimes)&&input.runtimes.length===4,'Four runtimes required');
 const runtimes=input.runtimes.map(x=>{demand(x&&RUNTIMES.includes(x.name)&&count(x.bytes,8*1024*1024)&&hash(x.sha256)&&count(x.inputCount,4096),'Invalid runtime inventory');return{name:x.name,bytes:x.bytes,sha256:x.sha256,inputCount:x.inputCount};}).sort((a,b)=>a.name.localeCompare(b.name));
 demand(new Set(runtimes.map(x=>x.name)).size===4,'Duplicate runtime inventory');
 demand(Array.isArray(input.sourceInputs)&&input.sourceInputs.length>0&&input.sourceInputs.length<=4096,'Bounded source input inventory required');
 const sourceInputs=input.sourceInputs.map(x=>{demand(x&&relative(x.path),'Invalid source input path');demand(count(x.bytes,8*1024*1024)&&hash(x.sha256)&&Array.isArray(x.runtimes)&&x.runtimes.length>0&&x.runtimes.every(r=>RUNTIMES.includes(r))&&new Set(x.runtimes).size===x.runtimes.length,'Invalid source input inventory');return{path:x.path,bytes:x.bytes,sha256:x.sha256,runtimes:[...x.runtimes].sort()};}).sort((a,b)=>a.path.localeCompare(b.path));
 demand(new Set(sourceInputs.map(x=>x.path)).size===sourceInputs.length,'Duplicate source input inventory');
 demand(Array.isArray(input.components)&&input.components.length<=512&&Array.isArray(input.licenses)&&input.licenses.length===input.components.length,'License/component inventory required');
 demand(Array.isArray(input.noticeContents)&&input.noticeContents.length===input.components.length,'Complete notice inventory required');
 const identities=new Set(),components=JSON.parse(JSON.stringify(input.components)),texts=[];
 for(const component of components){
  demand(component&&component.type==='library'&&typeof component.name==='string'&&/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(component.name)&&typeof component.version==='string'&&/^[a-z0-9.+_-]{1,96}$/i.test(component.version)&&typeof component['bom-ref']==='string'&&component['bom-ref'].length<=1200,'Invalid component identity');
  demand(!identities.has(component['bom-ref']),'Duplicate component identity');identities.add(component['bom-ref']);
  const matches=input.licenses.filter(x=>x.name===component.name&&x.version===component.version),notices=input.noticeContents.filter(x=>x.name===component.name&&x.version===component.version);
  demand(matches.length===1&&notices.length===1,'Unique license/notice component identity required');
  const license=matches[0],notice=notices[0];
  demand(['MIT','ISC','Apache-2.0','BSD-2-Clause','BSD-3-Clause','0BSD'].includes(license.license)&&license.status==='METADATA_AND_NOTICE_PRESENT_NOT_LEGAL_APPROVAL','Incomplete or unreviewed license metadata');
  demand(Array.isArray(license.notices)&&license.notices.length>0&&license.notices.length<=16&&Array.isArray(notice.notices)&&notice.notices.length===license.notices.length,'Missing or excessive license notices');
  const seen=new Set();
  for(const row of [...notice.notices].sort((a,b)=>String(a.path).localeCompare(String(b.path)))){
   demand(relative(row.path)&&!seen.has(row.path),'Invalid notice path');seen.add(row.path);
   demand(typeof row.content==='string'&&Buffer.byteLength(row.content,'utf8')>0&&Buffer.byteLength(row.content,'utf8')<=256*1024&&!row.content.includes('\0'),'Notice text size bound exceeded');
   const expected=license.notices.filter(x=>x.path===row.path);demand(expected.length===1&&expected[0].bytes===Buffer.byteLength(row.content,'utf8')&&expected[0].sha256===sha(Buffer.from(row.content,'utf8')),'License notice hash mismatch');
   texts.push({key:component['bom-ref']+'\0'+row.path,text:'## '+component.name+' '+component.version+'\n\nLicense: '+license.license+'\nSource: '+row.path+'\n\n'+row.content+(row.content.endsWith('\n')?'':'\n')});
  }
 }
 components.sort((a,b)=>a['bom-ref'].localeCompare(b['bom-ref']));
 const rootRef='application:'+input.identity+'@'+input.version,inventorySha256=sha(Buffer.from(JSON.stringify({runtimes,sourceInputs})));
 const sbom={bomFormat:'CycloneDX',specVersion:'1.6',version:1,metadata:{component:{type:'application','bom-ref':rootRef,name:input.identity,version:input.version,properties:[{name:'soterai:build-receipt-sha256',value:input.buildReceiptSha256},{name:'soterai:runtime-source-inventory-sha256',value:inventorySha256},{name:'soterai:runtime-inventory',value:JSON.stringify(runtimes)}]}},components,dependencies:[{ref:rootRef,dependsOn:components.map(x=>x['bom-ref'])}]};
 demand(!/\b[A-Za-z]:\\|\\\\|\/Users\/|\/home\//.test(JSON.stringify(sbom)),'Absolute local path in embedded metadata');
 const notices='# Third-party notices\n\nThese components are bundled in SoterAI Lite. Their notices are retained below; this inventory is not legal approval or a current vulnerability audit.\n\n'+texts.sort((a,b)=>a.key.localeCompare(b.key)).map(x=>x.text).join('\n');
 demand(Buffer.byteLength(notices,'utf8')<=2*1024*1024,'Combined notice size bound exceeded');
 return{sbom,notices,releaseReady:false,advisoryAudit:'NOT_RUN_NETWORK_NOT_AUTHORIZED',legalReview:'NOT_CLAIMED',nativeAcceptance:'NOT_SUPPLIED_BY_METADATA'};
}
module.exports={createEmbeddedMetadata,RUNTIMES};
