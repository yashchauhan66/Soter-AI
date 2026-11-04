const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let text=fs.readFileSync(path.join(__dirname,'qualify-vendor-installed-size-01.cjs'),'utf8');
function change(a,b){assert.equal(text.split(a).length,2,a);text=text.replace(a,b);}
change('/\\.vsixmanifest/g','/async function Nl\\(/g');
change("status:'PASS_EXACT_VENDOR_ADDED_VSIXMANIFEST_SIZE_AND_RETAINED_BEFORE_FAILURE'","status:'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST'");
change("observedAt:new Date().toISOString(),priorAdmission:","observedAt:new Date().toISOString(),vendorReceiptSha256:fact(own('public-vendor-observation-02.json')).sha256,currentVsixSha256:prior.currentVsix.sha256,oldVsixSha256:prior.oldVsix.sha256,priorAdmission:");
assert.equal(text.split('archivePayloadUncompressedBytes:').length,3);text=text.replaceAll('archivePayloadUncompressedBytes:','payloadUncompressedBytes:');
assert.equal(text.split('vsixManifest:').length,3);text=text.replaceAll('vsixManifest:','archiveXml:');
assert.equal(text.split('vendor-installed-size-qualification-01.json').length,3);text=text.replaceAll('vendor-installed-size-qualification-01.json','vendor-installed-size-qualification-02.json');
fs.writeFileSync(path.join(__dirname,'qualify-vendor-installed-size-02.cjs'),text,{flag:'wx'});
console.log('Exact raw archive/installed XML checks retained; recursive-size witness and wrapper API corrected. No product/native executed.');
