const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
let text=fs.readFileSync(path.join(base,"prepare-index-05.cjs"),"utf8").split("inside(__dirname,'generated-runtime-inputs-03')").join("inside(__dirname,'generated-runtime-inputs-04')");
const marker="const modified=lines(git(";assert.equal(text.split(marker).length,2);
text=text.replace(marker,"for(const name of ['packages/vscode-extension/src/__tests__/fixtures/claude-tools-2.1.301-01.json','packages/vscode-extension/src/__tests__/fixtures/claude-protocol-2.1.301-01.json'])ownSources.add(name);\n"+marker);
fs.writeFileSync(path.join(base,"prepare-index-06.cjs"),text,{flag:"wx"});
console.log("Included the two already-frozen native public protocol/schema fixtures in the exact source allowlist.");
