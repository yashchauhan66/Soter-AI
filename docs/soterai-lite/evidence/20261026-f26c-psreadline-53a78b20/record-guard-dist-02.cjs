const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=read(own('guard-dist-before-02.json')),changed=[],unchanged=[];
for(const old of before.records){const raw=fs.readFileSync(path.join(repo,old.path)),current={path:old.path,bytes:raw.length,sha256:sha(raw)};(current.bytes===old.bytes&&current.sha256===old.sha256?unchanged:changed).push(current);}
assert(changed.every(x=>/^packages\/guard-core\/dist\/detectors\/SecretDetector\.(?:js|js\.map|d\.ts|d\.ts\.map)$/.test(x.path)),'Unexpected other generated output drift');
assert.equal(changed.length,4);assert.equal(unchanged.length,208);
const r={status:'GUARD_CORE_REBUILT_EXACT_FOUR_PROJECTION_OUTPUTS_ONLY',observedAt:new Date().toISOString(),changed,unchangedCount:208,preservedBefore:212,allBeforeRetained:true,productPatternOrPolicyChanges:0,notes:'Stale-dist H4 failure corrected by actual canonical tsc emit; old outputs and first failed full remain preserved. New exact VSIX/full binding required.'};fs.writeFileSync(own('guard-dist-delta-02.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(r));
