const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const previous=read(own('full-inputs-01.json')),delta=read(own('guard-dist-delta-02.json'));assert.equal(previous.fileCount,1002);assert.equal(delta.changed.length,4);
const known=new Map(delta.changed.map(row=>[row.path,row])),files=new Map(),changed=[];
const fact=name=>{const raw=fs.readFileSync(path.join(repo,name));return{path:name,bytes:raw.length,sha256:sha(raw)}};
for(const old of previous.files){const current=fact(old.path);if(current.bytes!==old.bytes||current.sha256!==old.sha256){assert.deepEqual(current,known.get(current.path),'Unexpected product/test drift');changed.push(current.path);}files.set(current.path,current);}
const added=[];for(const row of delta.changed){assert.deepEqual(fact(row.path),row);if(!files.has(row.path))added.push(row.path);files.set(row.path,row);}
const host='packages/vscode-extension/src/__tests__/host/litePSReadLineHistory.host.ts';assert(!files.has(host));files.set(host,fact(host));added.push(host);
const records=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path));
const result={status:'CURRENT_REBUILT_GUARD_DIST_AND_NATIVE28_FULL02_PENDING',observedAt:new Date().toISOString(),fileCount:records.length,previous1002Unchanged:1002-changed.length,changed,added,guardDistDelta:{path:path.relative(repo,own('guard-dist-delta-02.json')).replace(/\\/g,'/'),sha256:sha(fs.readFileSync(own('guard-dist-delta-02.json')))},nativeOracles:28,files:records};
assert.equal(records.length,1002+added.length);fs.writeFileSync(own('full-inputs-02.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({fileCount:records.length,unchanged:result.previous1002Unchanged,changed,added}));
