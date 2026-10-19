const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
let text=fs.readFileSync(path.join(base,"close-source-02.ps1"),"utf8");
const line=text.split(/\r?\n/).find(value=>value.startsWith("Invoke-F19Close 'index-preparation-02'"));assert(line);text=text.replace(line+"\r\n","").replace(line+"\n","");
fs.writeFileSync(path.join(base,"close-source-03.ps1"),text,{flag:"wx"});
console.log("Prepared mutation-only close script; read-only index preparation will run separately first.");
