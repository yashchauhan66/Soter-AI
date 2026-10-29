const fs=require('node:fs'),assert=require('node:assert/strict'),{own,read,fact,sha}=require('./storage-current-admission-09.cjs');
const original=fs.readFileSync(own('precommit-offline-owner-01.cjs'),'utf8');let s=original;
const changes=[['899f01c8e699e613ac5d3fc2f8066e8997938e79ecc665dfe34af3e5c4e9090b','8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced'],['assert.equal(pin.root, root);','assert.equal(pin.root, state.root); assert(same(pin.root, root));'],['assert.equal(envelope.payload.root, root);','assert.equal(envelope.payload.root, pin.root);']];
for(const [a,b]of changes){assert.equal(s.split(a).length,2);s=s.replace(a,b);}
const at=s.indexOf('  const stdoutFile =');assert.equal(s.slice(at),original.slice(original.indexOf('  const stdoutFile =')));
fs.writeFileSync(own('precommit-offline-owner-11.cjs.txt'),s,{flag:'wx'});
const oldPrefix=fs.readFileSync(own('offline-helper-after-preflight-10.cjs'),'utf8'),trailer=oldPrefix.slice(oldPrefix.indexOf("  process.stdout.write('ALL_OFFLINE"));
fs.writeFileSync(own('offline-helper-after-preflight-11.cjs'),s.slice(0,at)+trailer,{flag:'wx'});
fs.writeFileSync(own('offline-helper-metadata-review-11.json'),JSON.stringify({status:'PREPARED_READONLY_TEST_PENDING_NOT_NATIVE_AUTHORIZATION',observedAt:new Date().toISOString(),original:fact(own('precommit-offline-owner-01.cjs')),candidate:fact(own('precommit-offline-owner-11.cjs.txt')),changes,postAdmissionSpawnAndOracleSuffixSha256:sha(Buffer.from(s.slice(at))),spawnSuffixByteExact:true,rootChecks:'Exact signed descriptor root equals exact saved primary root; both physically same case-insensitive local Windows root. Envelope root equals signed pin root.',signalsRequested:0},null,2)+'\n',{flag:'wx'});
