const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const write=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'}),replace=(s,a,b)=>{assert(s.includes(a),a);return s.replace(a,b);};
let parent=fs.readFileSync(path.join(__dirname,'../20261019-f20a-responses-45ae291c/matrix-guards-01.cjs'),'utf8').replaceAll('F20A','F20C');
const begin=parent.indexOf(' const expectedNative='),end=parent.indexOf('if(!allowed)',begin);assert(begin>0&&end>begin);
parent=parent.slice(0,begin)+` const expectedNode=path.resolve('C:/Program Files/nodejs/node.exe'),expectedGuard=path.resolve(root,'extension/dist-test/host/gemini-product-child-guards-01.cjs'),expectedEntry=path.resolve(root,'public-vendor/npm/node_modules/@google/gemini-cli/bundle/gemini.js');
 if(path.resolve(executable).toLowerCase()===expectedNode.toLowerCase()&&!options.shell&&path.resolve(cwd).toLowerCase()===path.resolve(root,'workspace').toLowerCase()
  &&options.env&&options.env.SOTERAI_FIXTURE_ROOT===root&&inside(options.env.GEMINI_CLI_HOME||'')&&/^gemini-cli-[a-f0-9-]{36}$/.test(path.basename(options.env.GEMINI_CLI_HOME||''))
  &&argv.length===9&&argv[0]==='--require'&&path.resolve(argv[1]).toLowerCase()===expectedGuard.toLowerCase()&&path.resolve(argv[2]).toLowerCase()===expectedEntry.toLowerCase()
  &&argv.slice(3,8).join('|')==='--model|gemini-3.5-flash|--output-format|json|--prompt'&&typeof argv[8]==='string'&&Buffer.byteLength(argv[8])<=4096)allowed=true;
`+parent.slice(end);
parent=replace(parent,"base==='codex.exe'?'codex-cli':'ticket'","base==='node.exe'?'gemini-cli':'ticket'");
write('gemini-product-parent-guards-01.cjs',parent);
let child=fs.readFileSync(path.join(__dirname,'native-guards-05.cjs'),'utf8');
child=replace(child,"const root=path.resolve(process.env.SOTERAI_FIXTURE_ROOT)","const diagnostics=path.resolve(process.env.SOTERAI_FIXTURE_DIAGNOSTICS);const root=path.resolve(process.env.SOTERAI_FIXTURE_ROOT)");
child=replace(child,"/^f20c-feasibility-[a-f0-9-]+$/","/^f20c-product-[a-zA-Z0-9-]+$/");
child=replace(child,"const allowed=address=>","const ports=process.env.SOTERAI_FIXTURE_PORTS.split(',').map(Number);if(!ports.length||ports.some(p=>!Number.isInteger(p)||p<1||p>65535)||!diagnostics.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw Error('Invalid scoped diagnostics/ports');const allowed=address=>");
child=replace(child,"Number(address.port)===port","ports.includes(Number(address.port))");
child=replace(child,"path.join(root,'guard-live-01.jsonl')","path.join(diagnostics,'guard-live-01.jsonl')");
child=replace(child,"path.join(root,'home/.gemini/projects.json.lock')","path.join(process.env.GEMINI_CLI_HOME,'.gemini/projects.json.lock')");
child=replace(child,"path.join(root,'retained-empty-project-locks')","path.join(diagnostics,'retained-empty-project-locks')");
child=replace(child,"path.join(root,'guard-report-01.json')","path.join(diagnostics,'guard-report-01.json')");
write('gemini-product-child-guards-01.cjs',child);
write('product-guards-freeze-01.json',JSON.stringify({status:'FROZEN_NOT_EXECUTED',scope:'Same exact empty synthetic-lock archive rule; fresh product root/owned home and per-native diagnostics. Child allows only the explicitly listed loopback MCP/gateway/provider ports, exact original public WASM, no native addon/alternate process/signal. Parent permits only reviewed broker/DPAPI/version probes and fixed exact installed Node Gemini argv. No OS or all-descendant claim.',files:['gemini-product-parent-guards-01.cjs','gemini-product-child-guards-01.cjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex')}))},null,2)+'\n');
