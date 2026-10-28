'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n),prior=n=>path.join(__dirname,'../20261028-f29-protection-center-6c93e15a',n),put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'});
put('palette-entrypoints-01.cjs',fs.readFileSync(prior('palette-entrypoints-06.cjs')));
let s=fs.readFileSync(prior('run-code-renderer-observer-07.cjs'),'utf8');
for(const [a,b]of [['require("./accessibility-binding-02.cjs")','require("./accessibility-binding-01.cjs")'],['require("./palette-keyboard-fixture-05.cjs")','require("../20261028-f29-protection-center-6c93e15a/palette-keyboard-fixture-05.cjs")'],['require("./palette-entrypoints-06.cjs")','require("./palette-entrypoints-01.cjs")'],['./vsix-extracted-02/extension/package.json','./vsix-extracted-01/extension/package.json'],['feature: "F29", status: "INCOMPLETE"','feature: "F30", status: "INCOMPLETE"']]){assert(s.includes(a),a);s=s.split(a).join(b);}
const marker='        result.observations.push({ phase: "safe-revoke-before-enter"';assert.equal(s.split(marker).length-1,1);
const addition=`        result.observations.push({phase:"actual-verify-before-enter",...(await selectByKeyboard(2,"Verify my setup"))});
        await page.keyboard.press("Enter");
        await until(async()=>{const value=await snapshot();return value.views[2].tree?.text?.includes("Synthetic checks: CURRENT");},15000,"Actual Verify action did not publish current synthetic results");
        for(const label of ["secret-matching: PASS (3/3)","output-redactor: PASS (10/10)","gateway-loopback: PASS (6/6)"]){result.observations.push({phase:"actual-verify-component-row",label,...(await selectByKeyboard(2,label))});}
        result.verifySetup="OBSERVED_REAL_TREE_ENTER_CURRENT_THREE_CANARY_COMPONENTS";
`;
s=s.replace(marker,addition+marker);assert(s.includes('assert.equal(ready.feature, "F29")'),'Retain legacy component gate identity, separate from current binding feature.');put('run-code-renderer-observer-01.cjs',s);
console.log('F30_RENDERER_PREPARED_NO_CODE_BROWSER_LAUNCH_ACTUAL_VERIFY_ENTER_REQUIRED');
