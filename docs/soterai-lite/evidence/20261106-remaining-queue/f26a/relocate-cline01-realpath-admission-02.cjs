'use strict';
// Read-only native-realpath and byte admission; PowerShell alone owns copy/removal.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo='C:\\Users\\USER\\OneDrive\\Desktop\\Ai-Agent-Security-Guard';
const failed=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-cline-01'),source=path.join(failed,'public-vendor');
const testRoot='D:\\SoterAI-Lite-test-profiles',archiveParent=path.join(testRoot,'cline01-public-vendor-archive-20261106-3a1d7b9c'),archive=path.join(archiveParent,'public-vendor');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function inside(value,boundary){assert(value===boundary||value.startsWith(boundary+path.sep),'Outside exact admitted root: '+value);}
function exact(value,boundary){
 value=path.resolve(value);inside(value,boundary);assert.equal(fs.realpathSync.native(value),value,'Native resolved path differs: '+value);
 let current=value;
 for(;;){const stat=fs.lstatSync(current);assert(!stat.isSymbolicLink(),'Linked descendant: '+current);if(current===boundary)break;current=path.dirname(current);inside(current,boundary);}
 return fs.lstatSync(value);
}
function fact(file){const raw=fs.readFileSync(file);return{path:file,bytes:raw.length,sha256:sha(raw)};}
function tree(root){
 const rows=[];
 function walk(dir){exact(dir,root);for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),st=exact(file,root);if(st.isDirectory())walk(file);else{assert(st.isFile()&&st.nlink===1);rows.push(fact(file));}}}
 walk(root);return rows;
}
function admit(mode){
 assert(['before','copied','after'].includes(mode));assert.equal(path.resolve(repo),repo);assert.equal(path.resolve(testRoot),testRoot);exact(repo,repo);exact(testRoot,testRoot);exact(failed,repo);
 const bindingPath=path.join(failed,'route-binding.json'),binding=read(bindingPath),close=read(path.join(failed,'route-owned-close.json'));
 assert.equal(binding.id,'cline');assert.equal(binding.publicInputs.length,38);assert(close.actualClose&&close.exitCode===1&&close.stdoutEOF&&close.stderrEOF&&close.signalsRequested===0);
 const entries=binding.publicInputs.map(row=>{const original=path.resolve(repo,row.path);inside(original,source);assert.notEqual(original,source);const relativePath=path.relative(source,original),target=path.resolve(archive,relativePath);inside(target,archive);return{relativePath,bytes:row.bytes,sha256:row.sha256,source:original,archive:target};});
 assert.equal(new Set(entries.map(row=>row.relativePath)).size,38);assert.equal(entries.reduce((sum,row)=>sum+row.bytes,0),38239400);
 if(mode==='before')assert(!fs.existsSync(archiveParent),'Existing target archive refused');
 if(mode==='after')assert(!fs.existsSync(source),'Removed source must be absent');
 for(const kind of mode==='before'?['source']:mode==='copied'?['source','archive']:['archive']){
  const selectedRoot=kind==='source'?source:archive,boundary=kind==='source'?repo:testRoot;exact(selectedRoot,boundary);
  const actual=tree(selectedRoot);assert.equal(actual.length,38);
  for(const row of entries){const st=exact(row[kind],boundary);assert(st.isFile()&&st.nlink===1);assert.deepEqual(fact(row[kind]),{path:row[kind],bytes:row.bytes,sha256:row.sha256});}
 }
 return{status:'PASS_READ_ONLY_NATIVE_REALPATH_AND_ALL38_PUBLIC_BYTES',mode,at:new Date().toISOString(),sourceRoot:source,archiveRoot:archive,workspaceNativeRealpath:fs.realpathSync.native(repo),testRootNativeRealpath:fs.realpathSync.native(testRoot),sourceNativeRealpath:mode==='after'?null:fs.realpathSync.native(source),archiveNativeRealpath:mode==='before'?null:fs.realpathSync.native(archive),files:38,bytes:38239400,originalBindingSha256:fact(bindingPath).sha256,entries,nativeProcessesLaunched:0,filesystemWrites:0,ancestorScope:'No-link traversal stops at exact workspace and D test-root boundaries; native realpath must equal each admitted literal path.'};
}
module.exports={admit};if(require.main===module){try{console.log(JSON.stringify(admit(process.argv[2])));}catch(error){console.error(error);process.exitCode=1;}}
