'use strict';
const e=require('./evidence-lib-01.cjs'),input=e.read(e.own('source-inputs-02.json')),roots=['packages/vscode-extension/src/__tests__','apps/local-ai-broker/src'],actual=[];
function walk(dir){for(const item of e.fs.readdirSync(e.path.join(e.repo,dir),{withFileTypes:true})){const relative=dir+'/'+item.name;e.assert(!item.isSymbolicLink());if(item.isDirectory())walk(relative);else if(item.isFile()&&/\.(?:ts|tsx|mjs|cjs|js)$/.test(item.name))actual.push(relative);}}
for(const root of roots)walk(root);const expected=input.records.filter(row=>roots.some(root=>row.path.startsWith(root+'/'))&&/\.(?:ts|tsx|mjs|cjs|js)$/.test(row.path)).map(row=>row.path).sort();
e.assert.deepEqual(actual.sort(),expected,'Frozen extension-test/backend source inventory changed.');for(const row of input.records)e.current(row);
console.log(JSON.stringify({status:'PASS_FROZEN_INPUT_BYTES_AND_TEST_BACKEND_MEMBERSHIP',files:input.records.length,testAndBackendFiles:actual.length}));
