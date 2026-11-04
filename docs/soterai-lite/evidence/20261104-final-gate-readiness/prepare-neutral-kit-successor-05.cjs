'use strict';
// Evidence-only successor authoring. No packet build/native/process/network/Git action.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const buildPath='packages/soterai-lite/builds/2026-11-03T14-37-01-797Z-c6ef06c0/build-provenance.json';
const buildRaw=fs.readFileSync(path.join(repo,buildPath));
assert.equal(sha(buildRaw),'f3001ef4c30c774eb396073011f77a7841d2f35e7cc3e8f00b023ab4730c2111');
const inputs=JSON.parse(buildRaw).inventory.flatMap(r=>r.inputs);
const rows=[...new Map(inputs.filter(r=>/^(?:packages\/(?:vscode-extension|soterai-lite|core|guard-core|detectors)\/|apps\/local-ai-broker\/)/.test(r.path)&&!/(?:^|\/)node_modules(?:\/|$)/.test(r.path)&&/\.(?:ts|js|cjs|mjs)$/.test(r.path)&&/\/(?:src|dist)\//.test(r.path)&&!r.path.includes('/__tests__/')).map(r=>[r.path,r])).values()].sort((a,b)=>a.path.localeCompare(b.path));
assert.equal(rows.length,370);
const exceptions=rows.filter(r=>/(?:^|\/)(?:artifacts|evidence)(?:\/|$)/i.test(r.path));
assert.deepEqual(exceptions.map(r=>r.path),['packages/vscode-extension/src/artifacts/ArtifactContent.ts','packages/vscode-extension/src/artifacts/ArtifactController.ts','packages/vscode-extension/src/artifacts/ArtifactFlags.ts','packages/vscode-extension/src/artifacts/commands.ts']);
for(const row of rows){const raw=fs.readFileSync(path.join(repo,row.path));assert.equal(raw.length,row.bytes,row.path);assert.equal(sha(raw),row.sha256,row.path);}
let base=fs.readFileSync(path.join(__dirname,'build-neutral-review-kit-base-04.cjs'),'utf8');
assert.equal(sha(Buffer.from(base)),'77d1fcb03c4dbab000a54bbce09fd18dd6824b5a8c623bffa575b05d6841ebff');
function replace(before,after){assert.equal(base.split(before).length-1,1,before);base=base.replace(before,()=>after);}
replace('const roles = new Set(',`// Only these four actual runtime build inputs bypass the contextual directory names.\nconst runtimeDirectoryInputs = new Map(${JSON.stringify(exceptions.map(r=>[r.path,{bytes:r.bytes,sha256:r.sha256}]),null,2)});\nconst roles = new Set(`);
replace('  assert(!/(?:^|\\/)(?:\\.git|node_modules|builds|artifacts|evidence)(?:\\/|$)/i.test(p));',
  "  const runtimeDirectory = runtimeDirectoryInputs.get(p);\n  const runtimeDirectoryProduct = row.role === 'PRODUCT_SOURCE' && runtimeDirectory && row.bytes === runtimeDirectory.bytes && row.sha256 === runtimeDirectory.sha256;\n  assert(!/(?:^|\\/)(?:\\.git|node_modules|builds)(?:\\/|$)/i.test(p));\n  assert(runtimeDirectoryProduct || !/(?:^|\\/)(?:artifacts|evidence)(?:\\/|$)/i.test(p));");
fs.writeFileSync(path.join(__dirname,'build-neutral-review-kit-base-05.cjs'),base,{flag:'wx'});
let wrapper=fs.readFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-04.cjs'),'utf8');
assert.equal(sha(Buffer.from(wrapper)),'5ae3b2734276a6a8f9fea91bb4c81429b60eabb3c485808821bebdb16e5ae479');
assert.equal(wrapper.split('./build-neutral-review-kit-base-04.cjs').length-1,1);
wrapper=wrapper.replace('./build-neutral-review-kit-base-04.cjs','./build-neutral-review-kit-base-05.cjs');
fs.writeFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-05.cjs'),wrapper,{flag:'wx'});
const proofPath='docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json',proofRaw=fs.readFileSync(path.join(repo,proofPath));
assert.equal(sha(proofRaw),'21a9721cade24be9cb76a03350273dbc79f1f8e0e913bc92d7a1c5385db8b764');
const proof=JSON.parse(proofRaw),proofMap=new Map(proof.files.map(r=>[r.path,r]));
const sourceProofMatches=rows.filter(r=>{const p=proofMap.get(r.path);if(!p)return false;assert.equal(r.bytes,p.bytes,r.path);assert.equal(r.sha256,p.sha256,r.path);return true;}).length;
const report={status:'EXACT_FOUR_RUNTIME_DIRECTORY_EXCEPTIONS_ONLY',buildProvenance:{path:buildPath,sha256:sha(buildRaw)},sourceProof:{path:proofPath,sha256:sha(proofRaw)},runtimeInputCount:rows.length,sourceProofMatches,buildInventoryOnly:rows.length-sourceProofMatches,exceptions,rows,limitation:'The eleven detectors compiled JavaScript inputs are in current exact build inventory, absent from full sourceproof04. Original compiled bytes are retained; no TypeScript equivalence or execution is inferred. Metadata manifests, licenses and build recipes are separate snapshots, not additional sourceproof members.'};
fs.writeFileSync(path.join(__dirname,'neutral-runtime-input-admission-05.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'SUCCESSOR05_AUTHORED_NOT_PACKET_BUILT',runtimeInputCount:rows.length,exceptions:exceptions.length,sourceProofMatches,buildInventoryOnly:rows.length-sourceProofMatches,baseSha256:sha(Buffer.from(base)),wrapperSha256:sha(Buffer.from(wrapper))}));
