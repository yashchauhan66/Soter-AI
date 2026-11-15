const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){const output=process.argv[2];if(!output)throw Error('A fresh output directory is required');const target=path.resolve(output);await fs.mkdir(target);const entries=[['owner-broker.cjs','owner-entry.ts'],['ec2-install.cjs','ec2-install.ts']];const receipt=[];
  for(const [name,source] of entries){const result=await esbuild.build({entryPoints:[path.join(root,'packages/soterai-cli/src/operations',source)],bundle:true,write:false,platform:'node',target:'node22',format:'cjs',minify:false,metafile:true,alias:{'@soterai/guard-core':path.join(root,'packages/guard-core/src/index.ts')}});
    if(result.metafile.outputs && Object.values(result.metafile.outputs).some(o=>o.imports.some(i=>i.external&&!i.path.startsWith('node:')&&!require('node:module').builtinModules.includes(i.path))))throw Error('External runtime dependency refused');
    const bytes=result.outputFiles[0].contents;await fs.writeFile(path.join(target,name),bytes,{flag:'wx'});receipt.push({name,sha256:sha(bytes),bytes:bytes.length});}
  await fs.writeFile(path.join(target,'receipt.json'),JSON.stringify({schemaVersion:1,status:'BUILT_NOT_INSTALLED',releaseReady:false,files:receipt},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'BUILT_NOT_INSTALLED',files:receipt}));}
main().catch(()=>{console.error('Owner bundle build unavailable.');process.exitCode=2;});
