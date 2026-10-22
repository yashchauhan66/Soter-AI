'use strict';
// Original bytes are indexed; generated/runtime or inherited EOL variants are snapshots.
const h=require('./evidence-lib-01.cjs');
const {fs,path,assert,repo,base,sha,hash,read,inside,relative,fact,write,git,lines,current}=h;
const parent='91f5820f337f00ad4da89ab9b8dcc9975f8a13a8';
assert.equal(lines(git('rev-parse','HEAD'))[0],parent);assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
const checkpoint=read(path.join(__dirname,'checkpoint-receipt-01.json'));assert.equal(checkpoint.status,'INCOMPLETE');assert.equal(checkpoint.parent,parent);assert.equal(checkpoint.acceptance,'NOT_GRANTED');assert.equal(checkpoint.nextFeature,'NOT_STARTED');
current(checkpoint.artifact);for(const row of [...checkpoint.inputs,...checkpoint.parserInputs])current(row);
const progress=read(path.join(__dirname,'f22g-progress-03.json'));assert.equal(progress.records.length,20);for(const row of progress.records)current(row);
const queue=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json')),card=queue.features.find(row=>row.id==='F22');
assert.equal(queue.activeFeature,'F22');assert.equal(card.activeSubcard,'F22g');assert(['ACTIVE','INCOMPLETE'].includes(card.subcards.find(row=>row.id==='F22g')?.status));assert.notEqual(card.subcards.find(row=>row.id==='F22h')?.status,'ACTIVE');
assert(!fs.existsSync(path.join(__dirname,'f22g-acceptance-01.json')));
const sourceRoots=['apps/local-ai-broker/src','packages/core/src','packages/vscode-extension/src','packages/guard-core/src','packages/detectors/src','packages/soterai-lite/src'];
const ownSources=new Set([...progress.records.map(row=>row.path),'docs/soterai-lite/FEATURE-QUEUE.json']);
const modified=lines(git('diff','--name-only','HEAD','--',...sourceRoots));for(const name of modified)assert(ownSources.has(name),'Unrelated source modification refused: '+name);
const previous='docs/soterai-lite/evidence/20261021-f22f-ci-46f38b2d';
const names=new Set([...ownSources,...modified,...checkpoint.inputs.map(row=>row.path),'docs/soterai-lite/ledger.md','docs/soterai-lite/IMPLEMENTATION-PLAN.md','docs/soterai-lite/MASTER-PROMPT-20261016.txt','docs/soterai-lite/LITE-CATALOG.json','docs/soterai-lite/evidence/20261018-f16-gateway-policy-6e9a31d4/git-batch-01.cjs']);
const snapshotRoot=inside(__dirname,'checkpoint-generated-runtime-inputs-01');assert(!fs.existsSync(snapshotRoot));fs.mkdirSync(snapshotRoot);
const generatedInputSnapshots=[],generated=new Map();
for(const input of [...checkpoint.inputs,...checkpoint.parserInputs]){
 if(!input.path.startsWith('packages/guard-core/dist/')&&!input.path.startsWith('packages/detectors/dist/')&&!input.path.startsWith('node_modules/@babel/parser/')&&!input.path.startsWith('node_modules/yaml/')&&!input.path.startsWith('node_modules/jsonc-parser/'))continue;
 assert(/\.(?:js|json|md|ts)$/.test(input.path)||/(?:^|\/)LICENSE$/.test(input.path));
 if(generated.has(input.path)){assert.equal(generated.get(input.path).sha256,input.sha256);continue;}generated.set(input.path,input);
}
for(const input of generated.values()){
 current(input);const target=inside(snapshotRoot,input.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,fs.readFileSync(inside(repo,input.path)),{flag:'wx'});
 const snapshot=fact(target);assert.equal(snapshot.sha256,input.sha256);assert.equal(snapshot.bytes,input.bytes);current(input);names.delete(input.path);names.add(snapshot.path);generatedInputSnapshots.push({original:input,snapshot});
}
for(const name of lines(git('ls-files','--others','--exclude-standard','--',...sourceRoots))){assert(ownSources.has(name),'Unexpected untracked source refused: '+name);names.add(name);}
for(const name of lines(git('ls-files','--','packages/vscode-extension/src/__tests__')))if(fs.existsSync(inside(repo,name)))names.add(name);
const hosts=path.join(repo,'packages/vscode-extension/src/__tests__/host');for(const entry of fs.readdirSync(hosts,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.ts'))names.add(relative(path.join(hosts,entry.name)));
for(const name of lines(git('ls-files','--others','--exclude-standard','--',previous)))if(new RegExp('^'+previous+'/[a-z0-9.-]+\\.(json|txt)$').test(name))names.add(name);
function walk(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  assert(!entry.isSymbolicLink(),'Symlink refused: '+entry.name);const file=path.join(directory,entry.name);
  if(entry.isDirectory()){
   if(/^(?:vsix-extracted-|prebuilt-)/.test(entry.name)||['extension','extensions','profile','profiles','node_modules','dist','builds','runtime','.git'].includes(entry.name))continue;
   walk(file);
  }else if(/\.(?:json|txt|md|ps1|cjs|ts|js|log)$/.test(entry.name))names.add(relative(file));
 }
}
walk(__dirname);
const indexPath=base+'/checkpoint-evidence-index-01.json',allowPath=base+'/checkpoint-commit-allowlist-01.txt';
assert(!names.has(indexPath)&&!names.has(allowPath));
const tracked=new Set(lines(git('ls-files','--',...sourceRoots,...ownSources,'docs/soterai-lite')).filter(name=>names.has(name)));git.preload(parent,[...tracked]);
for(const name of [...names]){
 if(name==='docs/soterai-lite/ledger.md'||name.startsWith(base+'/')||name.startsWith(previous+'/')||ownSources.has(name)||!tracked.has(name))continue;
 const originalBytes=fs.readFileSync(inside(repo,name)),blob=git('show',parent+':'+name);if(sha(originalBytes)===sha(blob))continue;
 assert.equal(blob.toString('utf8').replace(/\r\n/g,'\n'),originalBytes.toString('utf8').replace(/\r\n/g,'\n'),'Non-scoped non-line-ending difference refused: '+name);
 const original=fact(inside(repo,name)),target=inside(snapshotRoot,name);assert(!fs.existsSync(target));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,originalBytes,{flag:'wx'});
 const snapshot=fact(target);assert.equal(snapshot.sha256,original.sha256);assert.equal(snapshot.bytes,original.bytes);current(original);names.delete(name);names.add(snapshot.path);generatedInputSnapshots.push({original,snapshot,reason:'Existing Git/working-tree line-ending normalization; original source unchanged.'});
}
const changed=[...names].filter(name=>!tracked.has(name)||sha(git('show',parent+':'+name))!==hash(inside(repo,name)));
for(const name of changed)if(!name.startsWith(base+'/')&&!name.startsWith(previous+'/')&&name!=='docs/soterai-lite/ledger.md')assert(ownSources.has(name),'Unexpected changed indexed input refused: '+name);
const expected=[...changed,indexPath,allowPath].sort();fs.writeFileSync(inside(repo,allowPath),expected.join('\n')+'\n',{flag:'wx'});names.add(allowPath);
write('checkpoint-evidence-index-01.json',{
 schemaVersion:1,status:'INCOMPLETE',feature:'F22g',parent,checkpoint:fact(path.join(__dirname,'checkpoint-receipt-01.json')),generatedInputSnapshots,
 scope:'Scoped unfinished F22g checkpoint: exact current source/test corpus and explicit evidence, original-byte generated parser/guard/detector inputs and inherited EOL drift snapshots. No accepted native/affected result, feature completion, rating or advancement. VSIX/extracted/runtime/prebuilt/profile directories are retained outside this source index; the exact VSIX hash is rechecked.',
 entries:[...names].sort().map(name=>fact(inside(repo,name))),expectedCommitPaths:expected
});
console.log(JSON.stringify({status:'INCOMPLETE_CHECKPOINT_PREPARED_NOT_COMMITTED',indexed:names.size,paths:expected.length,generatedInputSnapshots:generatedInputSnapshots.length,artifact:checkpoint.artifact.sha256}));
