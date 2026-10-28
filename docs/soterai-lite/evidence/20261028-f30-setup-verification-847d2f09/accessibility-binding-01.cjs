'use strict';
const B=require('../20261028-f29-protection-center-6c93e15a/accessibility-binding-01.cjs'),{verifyStreamedPin}=require('../20261028-f29-protection-center-6c93e15a/streamed-vendor-pin-08.cjs');
const {fs,path,assert,root,dRoot,inside,pin,readJson,sha}=B;
function writeJson(filename,value){assert(inside(__dirname,filename)||inside(dRoot,filename));const raw=Buffer.from(JSON.stringify(value,null,2)+'\n');fs.writeFileSync(filename,raw,{flag:'wx'});return{path:filename,bytes:raw.length,sha256:sha(raw)};}
function admit(filename,kind){
 const absolute=path.resolve(filename);assert(inside(__dirname,absolute));const b=readJson(absolute);assert.equal(b.schemaVersion,1);assert.equal(b.feature,'F30');assert.equal(b.kind,kind);
 const proof=JSON.parse(pin(b.sourceProof).raw.toString('utf8').replace(/^\uFEFF/,''));assert.equal(proof.feature,'F30');assert.equal(proof.fileCount,1036);assert.equal(proof.files.length,1036);for(const row of proof.files)pin(row);
 pin(b.vsix);assert.equal(b.runtimes.length,4);for(const row of b.runtimes)pin(row);assert(b.requiredReceipts.length>=7);for(const row of b.requiredReceipts)pin(row);
 const inventory=JSON.parse(pin(b.toolInventory).raw.toString('utf8').replace(/^\uFEFF/,''));assert.equal(inventory.status,'PREPARED_STATIC_LOCAL_INVENTORY_NOT_ACCESSIBILITY_ACCEPTANCE');assert.equal(inventory.pins.length,11);for(const row of inventory.pins)verifyStreamedPin(row,{singleLink:!path.isAbsolute(row.path)||inside(root,row.path)});
 assert.equal(inventory.versions.playwright,'1.61.1');assert.equal(inventory.versions.axe,'4.12.1');assert.equal(b.signals,0);assert.equal(b.syntheticOnly,true);
 return{b,inventory,bindingPin:{path:absolute,bytes:fs.statSync(absolute).size,sha256:sha(fs.readFileSync(absolute))}};
}
module.exports={...B,writeJson,admit};
