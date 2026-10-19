const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname,prior=path.join(base,"../20261018-f18-cline-46a8c902");
const names=["build-native-hosts-01.cjs","run-retained-native-01.ps1","run-affected-hosts-01.ps1","run-functional-01.ps1","run-security-01.ps1","artifact-binding-01.ps1"];
for(const name of names){let text=fs.readFileSync(path.join(prior,name),"utf8");if(name==="run-retained-native-01.ps1")text=text.split("f18-retained-native-").join("f19-retained-native-");const target=path.join(base,name);assert(!fs.existsSync(target),"Overwrite refused");fs.writeFileSync(target,text,{flag:"wx"});}
console.log(JSON.stringify({prepared:names}));
