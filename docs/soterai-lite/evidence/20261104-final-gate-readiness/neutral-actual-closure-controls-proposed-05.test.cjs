'use strict';
// Pure current-file admission only; no packet build or native/process/network action.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const helper=require(process.env.NEUTRAL_HELPER_MODULE||'./build-neutral-review-kit-proposed-05.cjs');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const buildPath='packages/soterai-lite/builds/2026-11-03T14-37-01-797Z-c6ef06c0/build-provenance.json';
const raw=fs.readFileSync(path.join(repo,buildPath));
assert.equal(sha(raw),'f3001ef4c30c774eb396073011f77a7841d2f35e7cc3e8f00b023ab4730c2111');
const inputs=JSON.parse(raw).inventory.flatMap(r=>r.inputs);
const rows=[...new Map(inputs.filter(r=>!r.path.startsWith('node_modules/')&&/\.(?:ts|js|cjs|mjs)$/.test(r.path)&&/(?:\/src\/|\/dist\/)/.test(r.path)&&!r.path.includes('/__tests__/')).map(r=>[r.path,r])).values()].sort((a,b)=>a.path.localeCompare(b.path));
const fact=p=>{const b=fs.readFileSync(path.join(repo,p));return{path:p,bytes:b.length,sha256:sha(b)};};
test('NR01 actual firstparty runtime closure admits every original path and exact build bytes',()=>{
  assert.equal(rows.length,370);
  const failed=[];for(const row of rows)try{assert.equal(helper.allowed({...row,role:'PRODUCT_SOURCE'}).rel,row.path);}catch(error){failed.push({path:row.path,error:error.message});}
  assert.deepEqual(failed,[]);
});
test('NR02 metadata recipes admit original role without forbidden context',()=>{
  const proof=JSON.parse(fs.readFileSync(path.join(repo,'docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json')));
  const recipes=proof.files.filter(r=>/^packages\/soterai-lite\/scripts\/[^/]+\.cjs$/.test(r.path)||r.path==='packages/vscode-extension/scripts/parserBundleOptions.cjs');
  const failed=[];for(const row of recipes)try{helper.allowed({...fact(row.path),role:'BUILD_RECIPE'});}catch(error){failed.push({path:row.path,error:error.message});}
  assert.deepEqual(failed,[]);
});
const exceptionPaths=['packages/vscode-extension/src/artifacts/ArtifactContent.ts','packages/vscode-extension/src/artifacts/ArtifactController.ts','packages/vscode-extension/src/artifacts/ArtifactFlags.ts','packages/vscode-extension/src/artifacts/commands.ts'];
test('NR03 four exact current runtime artifacts paths refuse every non-source role',()=>{
  for(const p of exceptionPaths)for(const role of ['BUILD_RECIPE','SYNTHETIC_FIXTURE','NEUTRAL_INSTRUCTIONS','LICENSE','PRODUCT_MANIFEST'])assert.throws(()=>helper.allowed({...fact(p),role}));
});
test('NR04 runtime directory exception refuses size/hash drift',()=>{
  for(const p of exceptionPaths){const row={...fact(p),role:'PRODUCT_SOURCE'};assert.throws(()=>helper.allowed({...row,bytes:row.bytes+1}));assert.throws(()=>helper.allowed({...row,sha256:'0'.repeat(64)}));}
});
test('NR05 arbitrary artifact/evidence roots and copied context remain refused',()=>{
  const row={...fact(exceptionPaths[0]),role:'PRODUCT_SOURCE'};
  for(const p of ['packages/vscode-extension/src/artifacts/Unreviewed.ts','packages/vscode-extension/src/evidence/ArtifactContent.ts','packages/core/src/artifacts/ArtifactContent.ts','packages/vscode-extension/artifacts/ArtifactContent.ts','packages/vscode-extension/src/artifacts/BuilderNotes.ts','docs/soterai-lite/evidence/ArtifactContent.ts','docs/soterai-lite/ledger.md','packages/vscode-extension/node_modules/src/artifacts/ArtifactContent.ts'])assert.throws(()=>helper.allowed({...row,path:p}));
});
test('NR06 full actual request closure preserves four runtime/archive/catalog and contextual-reference checks',()=>{
  const proof=JSON.parse(fs.readFileSync(path.join(repo,'docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json')));
  const files=rows.map(r=>({...r,role:'PRODUCT_SOURCE'}));
  for(const p of ['packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/core/package.json','packages/guard-core/package.json','packages/detectors/package.json','apps/local-ai-broker/package.json'])if(fs.existsSync(path.join(repo,p)))files.push({...fact(p),role:'PRODUCT_MANIFEST'});
  for(const p of ['LICENSE','LICENSING.md','packages/soterai-lite/LICENSE.md'])files.push({...fact(p),role:'LICENSE'});
  for(const r of proof.files)if(/^packages\/soterai-lite\/scripts\/[^/]+\.cjs$/.test(r.path)||r.path==='packages/vscode-extension/scripts/parserBundleOptions.cjs')files.push({...fact(r.path),role:'BUILD_RECIPE'});
  const request={schemaVersion:1,destination:'docs/soterai-lite/independent-review-kit-20261104-a3c18f05',artifact:fact('packages/soterai-lite/soterai-lite-0.7.0-f32-20261103-attempt01.vsix'),catalog:fact('docs/soterai-lite/LITE-CATALOG.json'),runtimeIdentity:structuredClone(helper.expectedRuntimes),files};
  const plan=helper.prepare(request);assert.equal(plan.search.hits.length,0);assert(!fs.existsSync(plan.destination));assert.equal(plan.items.length,files.length+6);
});
module.exports={rows,fact};
