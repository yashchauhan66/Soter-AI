'use strict';
// Inert until explicitly invoked. Writes request/authority metadata only, never a review packet.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=p=>{const raw=fs.readFileSync(path.join(repo,p));return{path:p,bytes:raw.length,sha256:sha(raw)};};
const loadPinned=(p,expected)=>{const raw=fs.readFileSync(path.join(repo,p));assert.equal(sha(raw),expected,p);return JSON.parse(raw);};
function main(){
  assert.equal(process.argv.length,2,'No caller-selected source, helper, or destination arguments');
  const buildPath='packages/soterai-lite/builds/2026-11-03T14-37-01-797Z-c6ef06c0/build-provenance.json';
  const proofPath='docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json';
  const buildSha='f3001ef4c30c774eb396073011f77a7841d2f35e7cc3e8f00b023ab4730c2111',proofSha='21a9721cade24be9cb76a03350273dbc79f1f8e0e913bc92d7a1c5385db8b764';
  const build=loadPinned(buildPath,buildSha),proof=loadPinned(proofPath,proofSha),proofMap=new Map(proof.files.map(r=>[r.path,r]));
  const helperPath='docs/soterai-lite/evidence/20261104-final-gate-readiness/build-neutral-review-kit-proposed-05.cjs',basePath='docs/soterai-lite/evidence/20261104-final-gate-readiness/build-neutral-review-kit-base-05.cjs';
  assert.equal(fact(helperPath).sha256,'a57d788e2827e203ae4ee3744d5fed9f5ea00662e11cae89261091b6d9c9ae43');
  assert.equal(fact(basePath).sha256,'8ac30d9e014feb3873d1250a542a1bb16656485e9ba3366624b4f5360e49904c');
  const helper=require('./build-neutral-review-kit-proposed-05.cjs'),sourceRows=[...new Map(build.inventory.flatMap(r=>r.inputs).filter(r=>/^(?:packages\/(?:vscode-extension|soterai-lite|core|guard-core|detectors)\/|apps\/local-ai-broker\/)/.test(r.path)&&!/(?:^|\/)node_modules(?:\/|$)/.test(r.path)&&/\.(?:ts|js|cjs|mjs)$/.test(r.path)&&/\/(?:src|dist)\//.test(r.path)&&!r.path.includes('/__tests__/')).map(r=>[r.path,r])).values()].sort((a,b)=>a.path.localeCompare(b.path));
  assert.equal(sourceRows.length,370);
  let sourceProofMatches=0;const files=sourceRows.map(r=>{const actual=fact(r.path);assert.deepEqual(actual,r);const frozen=proofMap.get(r.path);if(frozen){assert.equal(actual.bytes,frozen.bytes,r.path);assert.equal(actual.sha256,frozen.sha256,r.path);sourceProofMatches++;}else assert(r.path.startsWith('packages/detectors/dist/'));return{...actual,role:'PRODUCT_SOURCE'};});
  assert.equal(sourceProofMatches,359);
  const metadata=[];
  function addMetadata(p,role){const actual=fact(p);metadata.push({...actual,role,snapshotAuthority:'CURRENT_BYTE_SNAPSHOT_SEPARATE_FROM_RUNTIME_SOURCE_CLOSURE'});files.push({...actual,role});}
  for(const p of ['packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/core/package.json','packages/guard-core/package.json','packages/detectors/package.json','apps/local-ai-broker/package.json'])if(fs.existsSync(path.join(repo,p)))addMetadata(p,'PRODUCT_MANIFEST');
  for(const p of ['LICENSE','LICENSING.md','packages/soterai-lite/LICENSE.md'])addMetadata(p,'LICENSE');
  for(const r of proof.files)if(/^packages\/soterai-lite\/scripts\/[^/]+\.cjs$/.test(r.path)||r.path==='packages/vscode-extension/scripts/parserBundleOptions.cjs')addMetadata(r.path,'BUILD_RECIPE');
  const request={schemaVersion:1,destination:'docs/soterai-lite/independent-review-kit-20261104-'+crypto.randomBytes(4).toString('hex'),artifact:fact('packages/soterai-lite/soterai-lite-0.7.0-f32-20261103-attempt01.vsix'),catalog:fact('docs/soterai-lite/LITE-CATALOG.json'),runtimeIdentity:structuredClone(helper.expectedRuntimes),files:files.sort((a,b)=>a.path.localeCompare(b.path))};
  const plan=helper.prepare(request);assert(!fs.existsSync(plan.destination));
  const requestPath=path.join(__dirname,'neutral-request-current-03.json'),authorityPath=path.join(__dirname,'neutral-request-source-authority-03.json');
  assert(!fs.existsSync(requestPath)&&!fs.existsSync(authorityPath),'Evidence overwrite refused');
  const authority={status:'EXACT_BUILD_INPUTS_PLUS_SEPARATE_METADATA_SNAPSHOTS_NO_PACKET_BUILD',buildProvenance:{path:buildPath,sha256:buildSha},sourceProof:{path:proofPath,sha256:proofSha},runtimeInputCount:sourceRows.length,sourceProofMatches,buildInventoryOnly:sourceRows.length-sourceProofMatches,metadataSnapshots:metadata,helper:fact(helperPath),base:fact(basePath),limitation:'Eleven detector compiled JS inputs are build-inventory-only. Metadata snapshots are not counted as runtime sourceproof members. No TS remap, independent review, native coverage, final rating or publication authority is inferred.'};
  fs.writeFileSync(authorityPath,JSON.stringify(authority,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(requestPath,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:'EXACT_NEUTRAL_REQUEST03_PREPARED_NOT_PACKET_BUILT',runtimeInputs:sourceRows.length,sourceProofMatches,buildInventoryOnly:sourceRows.length-sourceProofMatches,metadataSnapshots:metadata.length,files:request.files.length,destination:request.destination,request:fact(path.relative(repo,requestPath).replaceAll('\\','/')),authority:fact(path.relative(repo,authorityPath).replaceAll('\\','/')),search:plan.search}));
}
if(require.main===module)main();
module.exports={main};
