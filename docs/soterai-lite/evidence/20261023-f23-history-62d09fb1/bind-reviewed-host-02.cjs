'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),review=JSON.parse(fs.readFileSync(path.join(__dirname,'host-version-review-02.json'),'utf8'));
assert.equal(review.status,'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING');assert.equal(review.currentHost.version,'1.143.1');
const previous=path.join(__dirname,'host-current-binding-03.ps1'),guard=fs.readFileSync(previous,'utf8');
assert(guard.includes("'host-version-review-01.json'"));assert(guard.includes("'1.143.0'"));
fs.writeFileSync(path.join(__dirname,'host-current-binding-04.ps1'),guard.replaceAll("'host-version-review-01.json'","'host-version-review-02.json'").replaceAll("'1.143.0'","'1.143.1'"),{flag:'wx'});
const snap=path.join(__dirname,'unexecuted-native-prior-bindings-01');fs.mkdirSync(snap);const rows=[];
for(const entry of fs.readdirSync(__dirname,{withFileTypes:true})){
 if(!entry.isFile()||!entry.name.endsWith('.ps1')||entry.name.startsWith('host-current-binding-'))continue;
 const file=path.join(__dirname,entry.name),before=fs.readFileSync(file),text=before.toString('utf8');if(!text.includes('host-current-binding-03.ps1'))continue;
 // These native/package fixtures have never been executed. Their prior bytes
 // are preserved before binding them to the reviewed newly installed editor.
 fs.writeFileSync(path.join(snap,entry.name),before,{flag:'wx'});const after=Buffer.from(text.replaceAll('host-current-binding-03.ps1','host-current-binding-04.ps1'));fs.writeFileSync(file,after);
 rows.push({file:entry.name,before:{bytes:before.length,sha256:sha(before)},after:{bytes:after.length,sha256:sha(after)}});
}
fs.writeFileSync(path.join(__dirname,'host-binding-change-02.json'),JSON.stringify({status:'PREPARED_NOT_NATIVE_VERIFIED',oldVersion:'1.143.0',newVersion:'1.143.1',changed:rows,scope:'Only unexecuted native fixtures retargeted after explicit installed-source20API review; original executed host guard and all original pins retained. No version substitution for vendor clients, no agent update, no runtime/test/timing changes.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'BOUND_REVIEWED_HOST_NATIVE_PENDING',scripts:rows.length,version:review.currentHost.version}));
