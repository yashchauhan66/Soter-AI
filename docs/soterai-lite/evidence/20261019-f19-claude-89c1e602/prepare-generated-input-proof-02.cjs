const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
const write=(name,text)=>fs.writeFileSync(path.join(base,name),text,{flag:"wx"});
let index=fs.readFileSync(path.join(base,"prepare-index-02.cjs"),"utf8");
const marker="for(const name of lines(git('ls-files','--others','--exclude-standard','--',...sourceRoots))){";
assert.equal(index.split(marker).length,2);
const snapshot=[
 "const generatedInputSnapshots=[],snapshotRoot=inside(__dirname,'generated-runtime-inputs-01');assert(!fs.existsSync(snapshotRoot));fs.mkdirSync(snapshotRoot);",
 "const generated=new Map();for(const input of acceptance.inputs){if(!input.path.startsWith('packages/guard-core/dist/')&&!input.path.startsWith('packages/detectors/dist/'))continue;assert(input.path.endsWith('.js'));if(generated.has(input.path)){assert.equal(generated.get(input.path).sha256,input.sha256);continue;}generated.set(input.path,input);}",
 "for(const input of generated.values()){current(input);const target=inside(snapshotRoot,input.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,fs.readFileSync(inside(repo,input.path)),{flag:'wx'});const snapshot=fact(target);assert.equal(snapshot.sha256,input.sha256);assert.equal(snapshot.bytes,input.bytes);current(input);names.delete(input.path);names.add(snapshot.path);generatedInputSnapshots.push({original:input,snapshot});}",
 "fs.appendFileSync(inside(repo,'docs/soterai-lite/ledger.md'),'\\n\\n## STEP RECEIPT F19-INDEX / generated input byte binding\\n\\nRead-only index02 stopped before staging because ignored generated guard-core/detectors JS were not Git-tracked sources. No product/artifact/test change or Git mutation. Current index03 binds all packaged runtime inputs: tracked source bytes directly, and '+generatedInputSnapshots.length+' exact generated-byte copies under owned evidence. Originals stay unchanged/untracked; no unrelated outputs are staged. Snapshot/current SHA/size equality is verified, and every copied Git blob is included in the source proof. Earlier failed index receipt retained; acceptance and exact candidate04 gates unchanged.\\n');"
].join("\n")+"\n";
index=index.replace(marker,snapshot+marker).replace("write('f19-evidence-index-01.json',{schemaVersion:1,parent,","write('f19-evidence-index-01.json',{schemaVersion:1,parent,generatedInputSnapshots,");
write("prepare-index-03.cjs",index);
let verify=fs.readFileSync(path.join(base,"verify-source-01.cjs"),"utf8");
const before="const acceptance=read(own('f19-acceptance-01.json'));";assert.equal(verify.split(before).length,2);
verify=verify.replace(before,"for(const mapping of index.generatedInputSnapshots??[]){assert.equal(mapping.snapshot.sha256,mapping.original.sha256);assert.equal(mapping.snapshot.bytes,mapping.original.bytes);assert.equal(sha(git('show',revision+':'+mapping.snapshot.path)),mapping.original.sha256);current(mapping.original);}\n"+before);
verify=verify.replace("indexedEntries:index.entries.length,","indexedEntries:index.entries.length,generatedRuntimeSnapshots:(index.generatedInputSnapshots??[]).length,");
write("verify-source-02.cjs",verify);
let close=fs.readFileSync(path.join(base,"close-source-03.ps1"),"utf8").split("verify-source-01.cjs").join("verify-source-02.cjs");
write("close-source-04.ps1",close);
console.log("Prepared explicit generated-input snapshots and all-indexed Git/current-byte verifier; no originals changed.");
