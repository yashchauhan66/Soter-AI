const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),git=(...args)=>cp.execFileSync('git',args,{cwd:repo,maxBuffer:4*1024*1024}),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const revision=git('rev-parse','HEAD').toString().trim();assert.equal(git('rev-parse','HEAD^').toString().trim(),'fd73041ad2d773a9c259c69e20e48245e51487ea');
const index=JSON.parse(fs.readFileSync(path.join(__dirname,'f05-transition-index-01.json'),'utf8'));
const mismatches=index.entries.filter(row=>sha(git('show',revision+':'+row.path))!==row.sha256);assert.equal(mismatches.length,0);
const expected=fs.readFileSync(path.join(__dirname,'f05-transition-allowlist-01.txt'),'utf8').trim().split('\n').sort(),actual=git('diff-tree','--no-commit-id','--name-only','-r',revision).toString().trim().split('\n').sort();assert.deepEqual(actual,expected);
fs.writeFileSync(path.join(__dirname,'f05-transition-byte-verification-01.json'),JSON.stringify({status:'PASS',revision,indexedHashes:index.entries.length,changedPaths:actual.length,mismatches:0,unexpectedPaths:0},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',revision,indexedHashes:index.entries.length,changedPaths:actual.length}));
