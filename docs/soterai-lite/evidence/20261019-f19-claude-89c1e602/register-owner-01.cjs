const fs=require("node:fs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),path=require("node:path");
const repo=process.cwd(),dir=__dirname,receipt=path.join(dir,"owner-registration-changes-01.json");
assert(!fs.existsSync(receipt),"Evidence overwrite refused");
const additions=[
 ["soterai.configurePinnedClaude","Review Pinned Claude Code Setup"],
 ["soterai.restorePinnedClaude","Restore Previous Claude Code Config"],
 ["soterai.claudeAdapterStatus","Show Pinned Claude Code Adapter Status"],
];
const records=[];
for(const [name,indent] of [["vscode-extension",4],["soterai-lite",2]]) {
 const file="packages/"+name+"/package.json",manifest=JSON.parse(fs.readFileSync(file,"utf8"));
 for(const [command,title] of additions) {
  assert(!manifest.contributes.commands.some(item=>item.command===command),"Already registered");
  manifest.contributes.commands.push({command,title,category:"SoterAI"});
  manifest.contributes.menus.commandPalette.push({command,when:"soterai.advancedCommands"});
 }
 fs.writeFileSync(file,JSON.stringify(manifest,null,indent)+"\n");
 const bytes=fs.readFileSync(file);records.push({path:file,bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")});
}
fs.writeFileSync(receipt,JSON.stringify({status:"OWNER_COMMANDS_REGISTERED_NOT_ACCEPTANCE",records},null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({changed:records.map(item=>item.path)}));
