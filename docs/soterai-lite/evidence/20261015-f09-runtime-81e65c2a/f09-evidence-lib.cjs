// Shared offline F09 evidence helpers. No Git mutation or application execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytes=file=>fs.readFileSync(file),hash=file=>sha(bytes(file)),read=file=>JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/,''));
const relative=file=>path.relative(repo,path.resolve(file)).replaceAll('\\','/');
function inside(root,file){const resolved=path.resolve(root,file),rel=path.relative(root,resolved);assert.ok(rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel),'Path escaped its evidence/workspace root.');return resolved;}
function own(name){assert.equal(typeof name,'string');assert.ok(!path.isAbsolute(name)&&!name.split(/[\\/]/).includes('..'));return inside(__dirname,name);}
function source(name){assert.equal(typeof name,'string');assert.ok(!path.isAbsolute(name)&&!name.split(/[\\/]/).some(part=>part==='..'||part==='.git'));assert.match(name,/\.(?:ts|json|md|txt|ps1|cjs|mjs)$/);assert.ok(!/(?:^|\/)(?:profile|node_modules|dist|builds)(?:\/|$)/.test(name.replaceAll('\\','/')));return inside(repo,name);}
function fileFact(file){const stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink());return{path:relative(file),bytes:stat.size,sha256:hash(file)};}
function bound(spec){assert.ok(spec&&typeof spec==='object');assert.match(spec.sha256??'',/^[a-f0-9]{64}$/);const file=own(spec.path);assert.equal(hash(file),spec.sha256);return file;}
const git=(...args)=>cp.execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:repo,maxBuffer:64*1024*1024,windowsHide:true});
const lines=buffer=>buffer.toString('utf8').trim().split(/\r?\n/).filter(Boolean);
function noOutputs(names){for(const name of names)assert.ok(!fs.existsSync(own(name)),'Immutable output already exists: '+name);}
function write(name,value){fs.writeFileSync(own(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function tap(file){const text=bytes(file).toString('utf8'),result={};for(const key of ['tests','suites','pass','fail','cancelled','skipped','todo']){const matches=[...text.matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];assert.equal(matches.length,1,'One final TAP summary required: '+key);result[key]=Number(matches[0][1]);}return result;}
function check(spec){const log=own(spec.log),record=read(log+'.result.json');assert.equal(record.exitCode,0);assert.equal(hash(log),record.sha256.toLowerCase());assert.equal(path.resolve(record.output),log);let counts;
 if(spec.kind==='tap'){counts=tap(log);assert.ok(spec.expected);for(const key of ['tests','pass','fail','cancelled','skipped'])assert.equal(counts[key],spec.expected[key],'Observed TAP '+key+' differs from explicit binding.');assert.equal(counts.fail,0);assert.equal(counts.cancelled,0);assert.equal(counts.todo,0);assert.equal(counts.pass+counts.skipped,counts.tests);}
 return{role:spec.role,log:relative(log),receipt:relative(log+'.result.json'),...record,...(counts?{counts}:{}),logSha256:hash(log),receiptSha256:hash(log+'.result.json')};}
module.exports={fs,path,assert,repo,base,sha,bytes,hash,read,relative,inside,own,source,fileFact,bound,git,lines,noOutputs,write,tap,check};