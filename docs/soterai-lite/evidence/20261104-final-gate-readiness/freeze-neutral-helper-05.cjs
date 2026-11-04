'use strict';
// Evidence freeze only. No product/Git/native/process/network action.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['build-neutral-review-kit-base-05.cjs','build-neutral-review-kit-proposed-05.cjs','prepare-neutral-kit-successor-05.cjs','prepare-neutral-request-03.cjs','neutral-runtime-input-admission-05.json','neutral-kit-controls-proposed-05.test.cjs','neutral-source-ledger-controls-proposed-05.test.cjs','neutral-compiled-input-controls-proposed-05.test.cjs','neutral-actual-closure-controls-proposed-05.test.cjs','run-neutral-pure-controls-05.cjs','neutral-actual-closure-before-05.txt','neutral-actual-closure-before-05.txt.result.json','neutral-actual-closure-before-05-direct.txt','neutral-actual-closure-before-05-direct.txt.result.json','neutral-helper-authoring-05.txt','neutral-helper-authoring-05.txt.result.json','neutral-pure-controls-05.txt','neutral-pure-controls-05.txt.result.json','neutral-request-generator-syntax-03.txt','neutral-request-generator-syntax-03.txt.result.json','NEUTRAL-KIT-ACTUAL-CLOSURE-REVIEW05.md','freeze-neutral-helper-05.cjs'];
const files=names.map(name=>{const raw=fs.readFileSync(path.join(__dirname,name));return{path:name,bytes:raw.length,sha256:sha(raw)};});
assert.equal(files.find(r=>r.path==='build-neutral-review-kit-base-05.cjs').sha256,'8ac30d9e014feb3873d1250a542a1bb16656485e9ba3366624b4f5360e49904c');
assert.equal(files.find(r=>r.path==='build-neutral-review-kit-proposed-05.cjs').sha256,'a57d788e2827e203ae4ee3744d5fed9f5ea00662e11cae89261091b6d9c9ae43');
const report={status:'HELPER05_FROZEN_PURE34_PASS_NO_PACKET_BUILD',files,predecessorsPreserved:[{path:'build-neutral-review-kit-base-04.cjs',sha256:'77d1fcb03c4dbab000a54bbce09fd18dd6824b5a8c623bffa575b05d6841ebff'},{path:'build-neutral-review-kit-proposed-04.cjs',sha256:'5ae3b2734276a6a8f9fea91bb4c81429b60eabb3c485808821bebdb16e5ae479'}]};
for(const row of report.predecessorsPreserved)assert.equal(sha(fs.readFileSync(path.join(__dirname,row.path))),row.sha256);
const raw=Buffer.from(JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'neutral-helper-freeze-05.json'),raw,{flag:'wx'});
console.log(JSON.stringify({status:report.status,files:files.length,sha256:sha(raw)}));
