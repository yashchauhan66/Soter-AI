'use strict';
const e=require('./evidence-lib-01.cjs'),rows=[];
for(const name of e.fs.readdirSync(e.own('prebuilt-native-hosts-01'))){
 const before=e.fact(e.own('prebuilt-native-hosts-01/'+name)),after=e.fact(e.own('prebuilt-native-hosts-02/'+name));
 rows.push({name,before,after,changed:before.sha256!==after.sha256});
}
e.assert.equal(rows.length,11);e.assert.deepEqual(rows.filter(row=>row.changed).map(row=>row.name),['lite-mcp-host.js']);
const text=e.bytes(e.own('prebuilt-native-hosts-02/lite-mcp-host.js')).toString('utf8');e.assert(!text.includes('workbench.action.revertAndCloseActiveMcp'));e.assert(text.includes('workbench.action.revertAndCloseActiveEditor'));
const vsix=e.fact(e.path.join(e.repo,'packages/soterai-lite/soterai-lite-0.7.0-f22h-20261022-attempt01.vsix'));e.assert.equal(vsix.sha256,'578a9ef8193d6572eee314ea6b274b4e344db28837560e1cc621f12693465e3a');
e.write('native-driver-fix-comparison-01.json',{status:'PASS_ONLY_MCP_NATIVE_FIXTURE_CHANGED',rows,changed:1,unchanged:10,artifact:vsix,productionChanges:0,scope:'Actual compiler/build PASS; exact same10 affected drivers and production artifact. Only the corrected MCP cleanup command changes native MCP test driver. This is prelaunch evidence only.'});
console.log(JSON.stringify({status:'PASS_ONLY_MCP_NATIVE_FIXTURE_CHANGED',changed:1,unchanged:10,vsix:vsix.sha256}));
