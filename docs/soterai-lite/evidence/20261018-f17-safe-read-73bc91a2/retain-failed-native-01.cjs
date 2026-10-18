'use strict';
const h=require('./evidence-lib-01.cjs'),{fs,path,assert,own,hash,write}=h;
const retained=[];
for(const [name,run] of [['01','f17-native-host-20261018T143329Z-9ff4d14b'],['02','f17-native-host-20261018T145554Z-2a149168']]){
 const source=path.join('D:/SoterAI-Lite-test-profiles',run,'workspace/f17-mcp-route-receipt.json'),destination=own('failed-native-route-'+name+'.json');
 const data=fs.readFileSync(source);fs.writeFileSync(destination,data,{flag:'wx'});assert.equal(hash(source),hash(destination));retained.push({source,destination:path.basename(destination),bytes:data.length,sha256:hash(destination)});
}
write('failed-native-route-retention-01.json',{status:'PASS_EXACT_RETENTION_NOT_ACCEPTANCE',retained,time:new Date().toISOString()});console.log(JSON.stringify({status:'PASS_RETAINED',files:retained.length}));
