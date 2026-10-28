'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {phase}=require('./native-owned-phase-01.cjs');
async function main(){
 const run=path.join(__dirname,'native-owner-witness-01');fs.mkdirSync(run);
 const spec={executable:process.execPath,args:['-e','process.stdout.write("PUBLIC_OUTPUT");process.stderr.write("PUBLIC_ERROR");'],cwd:__dirname,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},run,name:'node-witness',profile:run,deadlineMs:15000};
 const result=await phase(spec);assert.equal(result.closed.code,0);assert.equal(result.closed.signal,null);assert(result.close.stdoutEOF&&result.close.stderrEOF);assert(!result.deadline&&!result.overflow&&!result.error);
 assert.equal(fs.readFileSync(path.join(run,'node-witness-stdout.bin'),'utf8'),'PUBLIC_OUTPUT');assert.equal(fs.readFileSync(path.join(run,'node-witness-stderr.bin'),'utf8'),'PUBLIC_ERROR');
 await assert.rejects(phase(spec),/Existing phase evidence/);
 console.log(JSON.stringify({status:'PASS_ACTUAL_SYNTHETIC_NODE_OWNER_AND_PRELAUNCH_DUPLICATE_REFUSAL',checks:2,nativeCode:'NOT_RUN',signalsRequested:0}));
}
main().catch(()=>{console.error('Native owner fixture validation refused.');process.exitCode=1;});
