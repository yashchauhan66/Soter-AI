const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
let index=fs.readFileSync(path.join(base,"prepare-index-03.cjs"),"utf8").split("inside(__dirname,'generated-runtime-inputs-01')").join("inside(__dirname,'generated-runtime-inputs-02')");
const marker="const changed=[...names].filter";assert.equal(index.split(marker).length,2);
const binding=[
 "for(const name of [...names]){",
 " if(name.startsWith(base+'/')||name.startsWith(previous+'/')||ownSources.has(name)||!tracked.has(name))continue;",
 " const originalBytes=fs.readFileSync(inside(repo,name)),blob=git('show',parent+':'+name);if(sha(originalBytes)===sha(blob))continue;",
 " assert.equal(blob.toString('utf8').replace(/\\r\\n/g,'\\n'),originalBytes.toString('utf8').replace(/\\r\\n/g,'\\n'),'Non-scoped non-line-ending difference refused: '+name);",
 " const original=fact(inside(repo,name)),target=inside(snapshotRoot,name);assert(!fs.existsSync(target));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,originalBytes,{flag:'wx'});const snapshot=fact(target);assert.equal(snapshot.sha256,original.sha256);assert.equal(snapshot.bytes,original.bytes);current(original);names.delete(name);names.add(snapshot.path);generatedInputSnapshots.push({original,snapshot,reason:'Existing Git/working-tree line-ending normalization; original source unchanged.'});",
 "}",
 "fs.appendFileSync(inside(repo,'docs/soterai-lite/ledger.md'),'\\n\\n## STEP RECEIPT F19-INDEX04 / unchanged normalized source bytes\\n\\nIndex03 also stopped before staging on state.ts: Git and working bytes differed only by existing CRLF/LF normalization, with no Git content diff. Its generated snapshots and failed raw receipt remain. Index04 additionally binds those unchanged non-scoped input bytes through exact evidence copies, after explicit newline-only equality checks. Original source/generated files are not rewritten or staged. All indexed copies and their original-current mappings are checked; actual runtime/artifact/tests unchanged. No prior failed index is a committed-byte proof.\\n');"
].join("\n")+"\n";
index=index.replace(marker,binding+marker);
fs.writeFileSync(path.join(base,"prepare-index-04.cjs"),index,{flag:"wx"});
console.log("Prepared read-only mapping for existing line-ending-only inputs; original files remain unchanged.");
