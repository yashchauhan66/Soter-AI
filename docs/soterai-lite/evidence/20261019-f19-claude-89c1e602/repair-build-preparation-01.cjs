const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");const base=__dirname;
const file="packages/vscode-extension/README.md";let text=fs.readFileSync(file,"utf8");
assert.equal(text.split("63 machine-scoped").length,2);fs.writeFileSync(file,text.replace("63 machine-scoped","64 machine-scoped"));
let script=fs.readFileSync(path.join(base,"build-candidate-01.ps1"),"utf8").replace("'typecheck-04'","'typecheck-05'").replace("'readme-readiness-01'","'readme-readiness-02'");
fs.writeFileSync(path.join(base,"build-candidate-02.ps1"),script,{flag:"wx"});
console.log("Fixed stale README machine-setting count; original failed build/raw retained. Package01 was not executed.");
