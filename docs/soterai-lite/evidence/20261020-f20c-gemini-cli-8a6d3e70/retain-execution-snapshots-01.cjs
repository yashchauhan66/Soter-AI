const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');const base=__dirname,repo=path.resolve(base,'../../../..'),out=path.join(base,'retained-execution-snapshots-01'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
assert(!fs.existsSync(out));fs.mkdirSync(out);const roots=new Set(),rows=[],skipped=[];
for(const name of fs.readdirSync(base)){if(/^native-(?:mcp-)?run-pointer-[0-9]+\.json$/.test(name)){const p=read(path.join(base,name));if(p.root)roots.add(p.root);}
 if(/^(?:f20[abc]-product-|f20a-retained-native-)/.test(name)){const f=path.join(base,name,'freeze.json');if(fs.existsSync(f)){const p=read(f);const r=p.executionRoot||p.root;if(r)roots.add(r);}}
}
const rootFiles=['launch-description-01.json','system-settings.json','system-defaults.json','home/.gemini/settings.json','stdout-01.txt','stderr-01.txt','stdout-live-01.txt','stderr-live-01.txt','guard-report-01.json','guard-live-01.jsonl','deadline-01.json','feasibility-report-01.json','product-result.json','product-result.json.driver-error.json'];
const nativeFiles=['launch.json','stdout.txt','stderr.txt','guard-report-01.json','guard-live-01.jsonl','natural-close-receipt.json'];
for(const rawRoot of [...roots].sort()){
 const root=path.resolve(rawRoot);assert(root.toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\'));assert(/^f20[abc]-(?:feasibility|product|retained-native)-[a-zA-Z0-9-]+$/.test(path.basename(root)));assert(fs.lstatSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink());assert.equal(fs.realpathSync(root).toLowerCase(),root.toLowerCase());
 const destination=path.join(out,path.basename(root));fs.mkdirSync(destination);const names=[...rootFiles];
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(entry.isDirectory()&&/^native-[a-z0-9-]+$/.test(entry.name))for(const name of nativeFiles)names.push(entry.name+'/'+name);
  if(entry.isFile()&&/^(?:native-ingress-[0-9]+\.json|native-trace-[0-9]+-(?:stdout|stderr)\.txt)$/.test(entry.name))names.push(entry.name);
 }
 for(const name of names){const source=path.resolve(root,name),relative=path.relative(root,source);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));if(!fs.existsSync(source))continue;
  const before=fs.lstatSync(source);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=4*1024*1024);assert.equal(fs.realpathSync(source).toLowerCase(),source.toLowerCase());
  const bytes=fs.readFileSync(source),after=fs.lstatSync(source);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino||bytes.length!==before.size){skipped.push({root,name,status:'VOLATILE_RETAINED_AT_SOURCE_NOT_A_FINAL_SNAPSHOT'});continue;}
  const target=path.join(destination,name.replaceAll('/','__')+'.txt');fs.writeFileSync(target,bytes,{flag:'wx'});rows.push({source,root,name,path:path.relative(repo,target).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes),scope:'Exact observed synthetic generated file snapshot; no closure inference from live files'});
 }
}
fs.writeFileSync(path.join(base,'execution-snapshot-index-01.json'),JSON.stringify({status:'PASS_EXACT_OBSERVED_SNAPSHOTS',roots:[...roots],files:rows,skipped,scope:'Explicit synthetic generated diagnostics/native requests/output/launch/close receipts only. Public vendor copies/normal profiles and real project secrets are not read or copied. Historical running attempts retain original incomplete labels; this snapshot is not a cleanup/close claim.',time:new Date().toISOString()},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_EXACT_OBSERVED_SNAPSHOTS',roots:roots.size,files:rows.length,volatile:skipped.length}));
