'use strict';
// Successor tightens the four exact runtime identities. Version01 is retained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const prior=require('./build-neutral-review-kit-base-04.cjs');
const repo=path.resolve(__dirname,'../../../..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const expectedRuntimes=[
  {name:'extension.js',bytes:1957320,sha256:'b611dee998d11824d523b3d561704f4a5dc15e27274e6e1d85c7154b9d42cfa0'},
  {name:'local-ai-broker.js',bytes:326860,sha256:'24c633aff86713f35133e6c103299a24bc2a4df0a6726c90462283ce9030b744'},
  {name:'pre-commit-client.js',bytes:24512,sha256:'36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb'},
  {name:'soterai-mcp-server.js',bytes:230255,sha256:'bac10b399ee9e28c069c72eae3254f2e84da155b2bcb2dc48467487d74845138'}
];
function prepare(request){
  assert.deepEqual(request.runtimeIdentity,expectedRuntimes,'Exact current four runtime identities required');
  return prior.prepare(request);
}
function main(){
  assert(['--check','--build'].includes(process.argv[2])&&process.argv.length===4);
  const requestPath=path.resolve(process.argv[3]);
  assert.equal(path.dirname(requestPath),__dirname);
  assert(/^neutral-request-[a-zA-Z0-9-]+\.json$/.test(path.basename(requestPath)));
  const st=fs.lstatSync(requestPath);assert(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size<1024*1024);
  const request=JSON.parse(fs.readFileSync(requestPath,'utf8').replace(/^\uFEFF/,''));
  const plan=prepare(request);
  if(process.argv[2]==='--check'){console.log(JSON.stringify({status:'PASS_INERT_EXACT_PACKET_ALLOWLIST_ADMISSION',files:plan.items.length,search:plan.search,nativeTestsRun:0}));return;}
  fs.mkdirSync(plan.destination);
  plan.items.push({rel:'exclusion-search.json',role:'PACKET_EXCLUSION_PROOF',raw:Buffer.from(JSON.stringify(plan.search,null,2)+'\n')});
  const files=[];
  for(const item of plan.items){const target=path.join(plan.destination,item.rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,item.raw,{flag:'wx'});files.push({path:item.rel,role:item.role,bytes:item.raw.length,sha256:digest(item.raw)});}
  const manifest=Buffer.from(JSON.stringify({schemaVersion:1,status:'EXACT_PACKET_BYTES_NOT_INDEPENDENT_REVIEW',files},null,2)+'\n');
  fs.writeFileSync(path.join(plan.destination,'file-list.json'),manifest,{flag:'wx'});
  console.log(JSON.stringify({status:'NEUTRAL_PACKET_WRITTEN_NO_NATIVE_OR_INDEPENDENT_VERDICT',destination:path.relative(repo,plan.destination).replaceAll('\\','/'),files:files.length,fileListSha256:digest(manifest),nativeTestsRun:0,releaseReady:false}));
}
if(require.main===module)main();
module.exports={prepare,expectedRuntimes,relative:prior.relative,allowed:prior.allowed};
