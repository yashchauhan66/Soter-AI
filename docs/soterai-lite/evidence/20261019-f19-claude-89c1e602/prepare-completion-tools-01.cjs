const fs=require("node:fs"),path=require("node:path"),base=__dirname,prior=path.join(base,"../20261018-f18-cline-46a8c902");
const write=(name,text)=>fs.writeFileSync(path.join(base,name),text,{flag:"wx"});
for(const name of["evidence-lib-01.cjs","verify-source-01.cjs","verify-transition-01.cjs"]){
 let text=fs.readFileSync(path.join(prior,name),"utf8");
 if(name==="verify-transition-01.cjs")text=text.split("F19").join("NEXT_F20_PLACEHOLDER").split("F18").join("F19").split("NEXT_F20_PLACEHOLDER").join("F20");
 else text=text.split("F18").join("F19");
 text=text.split("f18").join("f19");write(name,text);
}
let close=fs.readFileSync(path.join(prior,"close-source-03.ps1"),"utf8").split("F18").join("F19").split("f18").join("f19").split("prepare-index-03.cjs").join("prepare-index-01.cjs").split("index-preparation-03").join("index-preparation-01").split("pinned Cline adapter").join("pinned Claude Code native CLI adapter").split("activate F19").join("activate F20");
write("close-source-01.ps1",close);
console.log("Prepared source/transition proof helpers only; acceptance, index, staging and commits NOT EXECUTED.");
