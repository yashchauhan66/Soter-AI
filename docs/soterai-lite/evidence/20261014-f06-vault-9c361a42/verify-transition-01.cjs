const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),git=(...args)=>cp.execFileSync('git',args,{cwd:repo,maxBuffer:16*1024*1024}),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const revision=git('rev-parse','HEAD').toString().trim();assert.equal(git('rev-parse','HEAD^').toString().trim(),'9ef608baec316f8bf80f2ff853db57df203e99c9');
const index=JSON.parse(fs.readFileSync(path.join(__dirname,'f06-transition-index-01.json'),'utf8'));
const mismatches=index.entries.filter(entry=>sha(git('show',revision+':'+entry.path))!==entry.sha256).map(entry=>entry.path);assert.deepEqual(mismatches,[]);
const expected=fs.readFileSync(path.join(__dirname,'f06-transition-allowlist-01.txt'),'utf8').trim().split('\n').sort(),actual=git('diff-tree','--no-commit-id','--name-only','-r',revision).toString().trim().split('\n').sort();assert.deepEqual(actual,expected);assert.equal(git('diff','--cached','--name-only').toString().trim(),'');
const receipt={status:'PASS',revision,indexedEntries:index.entries.length,committedPaths:actual.length,mismatches,unexpectedPaths:0};fs.writeFileSync(path.join(__dirname,'f06-transition-byte-verification-01.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
