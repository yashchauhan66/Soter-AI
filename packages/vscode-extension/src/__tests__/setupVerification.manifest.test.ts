import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as path from "node:path";
import {CENTER_ACTIONS,protectionCenterRows,type CenterFacts} from "../protection-center/ProtectionCenterModel";
const root=path.resolve(__dirname,"../../../..");
for(const name of ["vscode-extension","soterai-lite"])test(`F30 ${name} registers one fixed command and restricted-machine flag`,()=>{const p=JSON.parse(readFileSync(path.join(root,"packages",name,"package.json"),"utf8")),flag=p.contributes.configuration.properties["soterai.lite.setupVerification"];assert(flag);assert.equal(flag.type,"boolean");assert.equal(flag.default,true);assert.equal(flag.scope,"machine");assert(p.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.setupVerification"));assert.equal(p.contributes.commands.filter((c:{command:string})=>c.command==="soterai.verifySetup").length,1);});
test("F30 native Center action uses its fixed verify command without paths",()=>assert.equal(CENTER_ACTIONS.verify,"soterai.verifySetup"));
test("F30 coverage offers its real owner action while results are still missing",()=>{const facts={enabled:true,trusted:true,workspaceCount:1,unavailable:false,restrictions:[],activity:[],activityEnabled:false,broker:"offline",evidence:{state:"MISSING",surfaces:[],fullClaim:"BLOCKED"},setupEnabled:true,setupReport:{state:"MISSING"}} as CenterFacts;const rows=protectionCenterRows(facts);assert(rows.coverage.some(r=>r.label==="Verify my setup"&&r.action==="verify"));assert(rows.coverage.some(r=>r.label.includes("Live verification: NOT_TESTED")));assert(!JSON.stringify(rows).includes("100%"));});
