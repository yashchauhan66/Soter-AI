const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
let text=fs.readFileSync(path.join(base,"prepare-index-04.cjs"),"utf8").split("inside(__dirname,'generated-runtime-inputs-02')").join("inside(__dirname,'generated-runtime-inputs-03')");
const before=" if(name.startsWith(base+'/')||name.startsWith(previous+'/')||ownSources.has(name)||!tracked.has(name))continue;";
assert.equal(text.split(before).length,2);
text=text.replace(before," if(name==='docs/soterai-lite/ledger.md'||name.startsWith(base+'/')||name.startsWith(previous+'/')||ownSources.has(name)||!tracked.has(name))continue;");
fs.writeFileSync(path.join(base,"prepare-index-05.cjs"),text,{flag:"wx"});
console.log("Excluded the intentionally appended F19 ledger from unchanged-source newline comparison. No original input altered.");
