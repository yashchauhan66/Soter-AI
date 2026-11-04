'use strict';
// Evidence-only exact input authoring. No artifact/test/build/native/network/Git action.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const buildPath='packages/soterai-lite/builds/2026-11-03T14-37-01-797Z-c6ef06c0/build-provenance.json';
const proofPath='docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json';
const buildRaw=fs.readFileSync(path.join(repo,buildPath)),proofRaw=fs.readFileSync(path.join(repo,proofPath));
assert.equal(sha(buildRaw),'f3001ef4c30c774eb396073011f77a7841d2f35e7cc3e8f00b023ab4730c2111');
assert.equal(sha(proofRaw),'21a9721cade24be9cb76a03350273dbc79f1f8e0e913bc92d7a1c5385db8b764');
const build=JSON.parse(buildRaw),proof=JSON.parse(proofRaw);
const rows=[...new Map(build.inventory.flatMap(x=>x.inputs).filter(x=>!x.path.startsWith('node_modules/')&&x.path.includes('/dist/')).map(x=>[x.path,x])).values()].sort((a,b)=>a.path.localeCompare(b.path));
assert.equal(rows.length,63);let frozen=0,buildOnly=0;
for(const row of rows){
  assert(/^packages\/(?:guard-core|detectors)\/dist\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(row.path));
  const raw=fs.readFileSync(path.join(repo,row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);
  const match=proof.files.find(p=>p.path===row.path);if(match){assert.equal(match.bytes,row.bytes);assert.equal(match.sha256,row.sha256);frozen++;}
  else{assert(row.path.startsWith('packages/detectors/dist/'));buildOnly++;}
}
assert.equal(frozen,52);assert.equal(buildOnly,11);
let base=fs.readFileSync(path.join(__dirname,'build-neutral-review-kit-base-03.cjs'),'utf8');
function replace(before,after){assert.equal(base.split(before).length-1,1,before);base=base.replace(before,()=>after)}
replace('const roles = new Set(',`const compiledDistInputs = new Map(${JSON.stringify(rows.map(r=>[r.path,{bytes:r.bytes,sha256:r.sha256}]),null,2)});\nconst roles = new Set(`);
replace("  assert(!/(?:^|\\/)(?:\\.git|node_modules|builds|dist|artifacts|evidence)(?:\\/|$)/i.test(p));", "  const compiled = compiledDistInputs.get(p);\n  const compiledProduct = row.role === 'PRODUCT_SOURCE' && compiled && row.bytes === compiled.bytes && row.sha256 === compiled.sha256;\n  assert(!/(?:^|\\/)(?:\\.git|node_modules|builds|artifacts|evidence)(?:\\/|$)/i.test(p));\n  assert(compiledProduct || !/(?:^|\\/)dist(?:\\/|$)/i.test(p));");
replace('  assert(runtimeLedger || !/ledger/i.test(path.basename(p)));','  assert(runtimeLedger || compiledProduct || !/ledger/i.test(path.basename(p)));');
fs.writeFileSync(path.join(__dirname,'build-neutral-review-kit-base-04.cjs'),base,{flag:'wx'});
let wrapper=fs.readFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-03.cjs'),'utf8');
assert.equal(wrapper.split('./build-neutral-review-kit-base-03.cjs').length-1,1);wrapper=wrapper.replace('./build-neutral-review-kit-base-03.cjs','./build-neutral-review-kit-base-04.cjs');
fs.writeFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-04.cjs'),wrapper,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'neutral-compiled-input-admission-04.json'),JSON.stringify({status:'EXACT_FIRSTPARTY_COMPILED_BUILD_INPUT_ALLOWLIST_ONLY',buildProvenance:{path:buildPath,sha256:sha(buildRaw)},sourceProof:{path:proofPath,sha256:sha(proofRaw)},sourceProofMatches:frozen,buildInventoryOnly:buildOnly,rows,limitation:'11 detectors JavaScript inputs are pinned by current exact build inventory and current bytes, absent from full sourceproof04; no TypeScript equivalence or test execution is inferred.'},null,2)+'\n',{flag:'wx'});
