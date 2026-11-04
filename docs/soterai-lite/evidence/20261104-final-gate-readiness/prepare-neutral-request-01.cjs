'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),F=path.resolve(__dirname,'../20261103-f32-lifecycle-2e95d6a4'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=p=>{const b=fs.readFileSync(path.join(repo,p));return{path:p,bytes:b.length,sha256:sha(b)}};
const q=JSON.parse(fs.readFileSync(path.join(F,'current-package-qualification-01.json'))),proof=JSON.parse(fs.readFileSync(path.join(F,'full-inputs-04.json'))),build=JSON.parse(fs.readFileSync(path.join(repo,'packages/soterai-lite/builds/2026-11-03T14-37-01-797Z-c6ef06c0/build-provenance.json')));
const files=new Map();function add(p,role){const r=fact(p);assert(proof.files.some(x=>x.path===p&&x.sha256===r.sha256)||role==='LICENSE');files.set(p,{...r,role});}
for(const r of build.inventory.flatMap(x=>x.inputs))if(!r.path.startsWith('node_modules/')){
 let p=r.path;if(p.includes('/dist/')){p=p.replace('/dist/','/src/').replace(/\.js$/,'.ts');if(!fs.existsSync(path.join(repo,p)))continue;}
 if(p.includes('/src/')&&/\.(?:ts|js|cjs|mjs)$/.test(p)&&!p.includes('/__tests__/'))add(p,'PRODUCT_SOURCE');
}
for(const p of ['packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/core/package.json','packages/guard-core/package.json','packages/detectors/package.json','apps/local-ai-broker/package.json'])if(fs.existsSync(path.join(repo,p)))add(p,'PRODUCT_MANIFEST');
for(const p of ['LICENSE','LICENSING.md','packages/soterai-lite/LICENSE.md'])add(p,'LICENSE');
for(const r of proof.files)if(/^packages\/soterai-lite\/scripts\/[^/]+\.cjs$/.test(r.path)||r.path==='packages/vscode-extension/scripts/parserBundleOptions.cjs')add(r.path,'BUILD_RECIPE');
const request={schemaVersion:1,destination:'docs/soterai-lite/independent-review-kit-20261104-'+crypto.randomBytes(4).toString('hex'),artifact:fact(path.relative(repo,q.vsix.path).replaceAll('\\','/')),catalog:fact('docs/soterai-lite/LITE-CATALOG.json'),runtimeIdentity:q.payload.runtimes.map(x=>({name:x.relative.slice(5),bytes:x.bytes,sha256:x.sha256})),files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))};
const helper=path.join(__dirname,'build-neutral-review-kit-proposed-03.cjs');assert.equal(sha(fs.readFileSync(helper)),'5e0e7f756d0ab63a13b8cf71a08e7da1b69e3ccb084e14e164f2142b322da017');require(helper).prepare(request);
const file=path.join(__dirname,'neutral-request-current-01.json');fs.writeFileSync(file,JSON.stringify(request,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_NEUTRAL_ALLOWLIST_REQUEST_PREPARED_NOT_PACKET_OR_REVIEW',files:request.files.length,destination:request.destination,request:fact(path.relative(repo,file).replaceAll('\\','/'))}));
