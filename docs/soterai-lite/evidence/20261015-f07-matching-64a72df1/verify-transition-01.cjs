const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),git=(...args)=>cp.execFileSync('git',args,{cwd:repo,maxBuffer:16*1024*1024});
const revision=git('rev-parse','HEAD').toString().trim(),source=JSON.parse(fs.readFileSync(path.join(__dirname,'f07-committed-byte-verification-01.json'),'utf8')).revision;assert.equal(git('rev-parse','HEAD^').toString().trim(),source);
const index=JSON.parse(fs.readFileSync(path.join(__dirname,'f07-transition-index-01.json'),'utf8'));
const mismatches=index.entries.filter(entry=>sha(git('show',revision+':'+entry.path))!==entry.sha256).map(entry=>entry.path);
const expected=fs.readFileSync(path.join(__dirname,'f07-transition-allowlist-01.txt'),'utf8').trim().split('\n').sort(),actual=git('diff-tree','--no-commit-id','--name-only','-r',revision).toString().trim().split('\n').sort();
assert.deepEqual(mismatches,[]);assert.deepEqual(actual,expected);assert.equal(git('diff','--cached','--name-only').toString().trim(),'');
fs.writeFileSync(path.join(__dirname,'f07-transition-byte-verification-01.json'),JSON.stringify({status:'PASS',revision,indexedEntries:index.entries.length,committedPaths:actual.length,mismatches,unexpectedPaths:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',revision,indexedEntries:index.entries.length,committedPaths:actual.length}));
