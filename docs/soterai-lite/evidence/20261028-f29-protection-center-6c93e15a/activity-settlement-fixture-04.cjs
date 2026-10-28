'use strict';
// Observe the existing asynchronous owner until its current PENDING outcome
// settles. Never rewrite a report, retry a storage write or change an assertion.
async function settledActivityReport(read,wait=ms=>new Promise(done=>setTimeout(done,ms)),now=Date.now){
 const deadline=now()+15000;let report=await read();
 while(report.persistence==='PENDING'&&now()<deadline){await wait(20);report=await read();}
 return report;
}
module.exports={settledActivityReport};
