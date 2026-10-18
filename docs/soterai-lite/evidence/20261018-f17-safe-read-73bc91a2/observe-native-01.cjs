'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const run='f17-native-host-20261018T143329Z-9ff4d14b',root=path.join('D:/SoterAI-Lite-test-profiles',run);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const result={utc:new Date().toISOString(),freePhysical:os.freemem(),evidenceFiles:fs.readdirSync(path.join(__dirname,run)),executionFiles:fs.existsSync(root)?fs.readdirSync(root):[]};
for(const phase of ['primary','restart']){const file=path.join(root,phase+'-results.json');if(fs.existsSync(file)){const report=read(file);result[phase]={passed:report.passed,failed:report.failed,notRun:report.notRun,driverFailure:report.driverFailure,failures:report.observations.filter(r=>r.status!=='PASS')};}}
console.log(JSON.stringify(result,null,2));
