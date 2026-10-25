'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),prior=path.join(repo,'docs/soterai-lite/evidence/20261023-f24-artifact-c3a5d91e');
const original=fs.readFileSync(path.join(prior,'input-lib-01.cjs'),'utf8');
// These two NEW host-only fixtures are being authored in parallel. Neither is
// a product import or a **/*.test.ts input. Final native/compiler freeze must
// include their actual bytes separately; this full/unit freeze cannot certify
// them. All existing host fixtures remain included without exclusions.
const excluded=['packages/vscode-extension/src/__tests__/host/liteLogs.host.ts','packages/vscode-extension/src/__tests__/host/liteLogVaultRuntime.host.ts'];
let lib=original.replace("const files=",'const excluded='+JSON.stringify(excluded)+';\nconst files=')
 .replace('return [...found].sort();','return [...found].filter(file=>!excluded.includes(file)).sort();')
 .replace("'source-inputs-01.json'","'full-inputs-01.json'");
fs.writeFileSync(path.join(__dirname,'full-input-lib-01.cjs'),lib,{flag:'wx'});
const api=require('./full-input-lib-01.cjs');
const value={status:'FROZEN_UNIT_PRODUCT_BUILD_INPUTS_NATIVE_FIXTURE_ADDITIONS_EXCLUDED',nativeFixtureExclusions:excluded,records:api.inventory().map(api.fact),observedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'full-inputs-01.json'),JSON.stringify(value,null,2),{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'check-full-inputs-01.cjs'),"const e=require('./full-input-lib-01.cjs');console.log(JSON.stringify({status:'EXACT_FULL_UNIT_PRODUCT_INPUTS',files:e.check(),exclusions:'ONLY_NEW_NATIVE_FIXTURES_NEVER_PRODUCT_OR_TEST_IMPORTS'}));\n",{flag:'wx'});
console.log(JSON.stringify({status:value.status,files:value.records.length,excluded}));
