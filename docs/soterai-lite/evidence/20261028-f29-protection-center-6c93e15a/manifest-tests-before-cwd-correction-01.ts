import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CENTER_ACTIONS } from "../protection-center/ProtectionCenterModel";
for(const name of ["vscode-extension","soterai-lite"])test(`F29 ${name} contributes native center behind a restricted machine flag`,()=>{
    const p=JSON.parse(readFileSync(path.resolve(process.cwd(),"packages",name,"package.json"),"utf8")),c=p.contributes;
    assert.deepEqual(c.configuration.properties["soterai.lite.protectionCenter"]?.type,"boolean");assert.equal(c.configuration.properties["soterai.lite.protectionCenter"].scope,"machine");assert.equal(c.configuration.properties["soterai.lite.protectionCenter"].default,true);assert(p.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.protectionCenter"));
    const views=c.views["soterai-explorer"],ids=["soterai-protected-items","soterai-protection-activity","soterai-protection-coverage"];assert.equal(views.filter((v:{id:string})=>ids.includes(v.id)).length,3);for(const v of views.filter((v:{id:string})=>ids.includes(v.id))){assert.equal(v.type,undefined);assert.equal(v.when,"soterai.protectionCenter");}for(const id of ["soterai-control-panel","soterai-project-risk","soterai-latest-findings","soterai-policy-status"])assert(views.find((v:{id:string})=>v.id===id).when.includes("!soterai.protectionCenter"));
    assert(c.menus["explorer/context"].some((v:{command:string})=>v.command==="soterai.openProtectionCenter"));assert(c.menus["view/title"].some((v:{command:string})=>v.command==="soterai.refreshProtectionCenter"));
});
test("F29 all fixed apply/restore targets exist in the canonical contributed command set",()=>{const p=JSON.parse(readFileSync(path.resolve(process.cwd(),"packages/vscode-extension/package.json"),"utf8"));const commands=new Set(p.contributes.commands.map((v:{command:string})=>v.command));for(const target of Object.values(CENTER_ACTIONS))assert(commands.has(target),target);});
