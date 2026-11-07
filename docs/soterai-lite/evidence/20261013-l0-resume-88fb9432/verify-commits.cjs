const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stages=[['P01','ed5b9812','p01-evidence-index.json'],['P02','39ac7906','p02-evidence-index.json'],['P03','edf015a4','p03-evidence-index.json']];
const results=stages.map(([stage,revision,index])=>{
 const entries=JSON.parse(fs.readFileSync(path.join(__dirname,index),'utf8').replace(/^\uFEFF/,'' )).entries;
 const mismatches=[];
 for(const entry of entries){const bytes=cp.execFileSync('git',['show',revision+':'+entry.path],{maxBuffer:30*1024*1024});if(sha(bytes)!==entry.sha256)mismatches.push(entry.path);}
 return{stage,revision:cp.execFileSync('git',['rev-parse',revision],{encoding:'utf8'}).trim(),entries:entries.length,mismatches};
});
const result={status:results.every(r=>r.mismatches.length===0)?'PASS':'FAIL',results};
fs.writeFileSync(path.join(__dirname,'p00-p03-committed-byte-verification.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
if(result.status!=='PASS')process.exitCode=1;
