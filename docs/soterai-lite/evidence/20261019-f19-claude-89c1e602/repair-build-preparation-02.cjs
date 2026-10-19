const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");const base=__dirname;
const file="packages/vscode-extension/README.md";let text=fs.readFileSync(file,"utf8");
assert.equal(text.split("The 63 safety-relevant settings").length,2);fs.writeFileSync(file,text.replace("The 63 safety-relevant settings","The 64 safety-relevant settings"));
let script=fs.readFileSync(path.join(base,"build-candidate-01.ps1"),"utf8").replace("'typecheck-04'","'typecheck-05'").replace("'readme-readiness-01'","'readme-readiness-02'");
fs.writeFileSync(path.join(base,"build-candidate-03.ps1"),script,{flag:"wx"});
console.log("Fixed exact stale README count. Prep01 stopped at its assertion and wrote nothing; launch02 had a nonexistent script and never compiled or packaged.");
