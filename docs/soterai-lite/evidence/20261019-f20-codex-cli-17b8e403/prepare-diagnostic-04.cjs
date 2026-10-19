'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let s=fs.readFileSync(path.join(__dirname,'product-matrix-03.cjs'),'utf8');const a='  records.ownerStages=[];';assert.equal(s.split(a).length,2);
s=s.replace(a,[
 "  const storage=context.globalStorageUri,storageRel=path.relative(root,storage.fsPath);",
 "  records.ownerDiagnostic.storage={scheme:storage.scheme,authorityEmpty:!storage.authority,absolute:path.isAbsolute(storage.fsPath),relative:!storageRel.startsWith('..')&&!path.isAbsolute(storageRel)?storageRel:'OUTSIDE_SYNTHETIC_ROOT',storedReceiptPresent:!!context.globalState.get('soterai.lite.codexCliAdapter.receipt.v1')};",
 a].join('\n'));
fs.writeFileSync(path.join(__dirname,'product-matrix-04.cjs'),s,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'run-product-matrix-04.ps1'),fs.readFileSync(path.join(__dirname,'run-product-matrix-03.ps1'),'utf8').replaceAll('product-matrix-03.cjs','product-matrix-04.cjs'),{flag:'wx'});
console.log('PREPARED_STORAGE_METADATA_DIAGNOSTIC_NO_AUTHORITY_CHANGE');
