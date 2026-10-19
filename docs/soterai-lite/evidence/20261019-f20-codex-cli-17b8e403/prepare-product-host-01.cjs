'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const prior=path.resolve(__dirname,'../20261019-f19-claude-89c1e602'),write=(n,s)=>fs.writeFileSync(path.join(__dirname,n),s,{flag:'wx'});
const pin=JSON.parse(fs.readFileSync(path.join(__dirname,'installed-cli-public-inputs-02.json'),'utf8')),vendor=path.dirname(pin.files[0].path);
write('installed-public-inputs-01.json',JSON.stringify({status:'STATIC-ONLY_PIN_NOT_PRODUCT_ACCEPTANCE',version:'0.160.1',vendor,files:pin.files.map(f=>({...f,relative:path.relative(vendor,f.path).replaceAll('\\','/')}))},null,2)+'\n');
let guard=fs.readFileSync(path.join(prior,'matrix-guards-01.cjs'),'utf8').replaceAll('F19','F20A');
const start=guard.indexOf(' const expectedNative='),end=guard.indexOf('if(!allowed)',start);assert.ok(start>0&&end>start);
guard=guard.slice(0,start)+[
 " const expectedNative=path.resolve(root,'public-vendor/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');",
 " if(path.resolve(executable).toLowerCase()===expectedNative.toLowerCase()&&!options.shell&&path.resolve(cwd).toLowerCase()===path.resolve(root,'workspace').toLowerCase()",
 "  &&options.env&&inside(options.env.CODEX_HOME||'')&&/^codex-cli-[a-f0-9-]{36}$/.test(path.basename(options.env.CODEX_HOME||''))",
 "  &&argv.length===14&&argv.slice(0,11).join('|')==='exec|--strict-config|--skip-git-repo-check|--ephemeral|--color|never|--json|-m|f20-fixture|-c|model_provider=\"soterai_fixture\"'",
 "  &&argv[11]==='-c'&&typeof argv[12]==='string'&&/^model_providers[.]soterai_fixture=\\{name=\"SoterAI synthetic loopback\",base_url=\"http:\\/\\/127[.]0[.]0[.]1:[0-9]+\\/v1\",wire_api=\"responses\",requires_openai_auth=false,request_max_retries=0,stream_max_retries=0,stream_idle_timeout_ms=5000,supports_websockets=false\\}$/.test(argv[12])",
 "  &&typeof argv[13]==='string'&&Buffer.byteLength(argv[13])<=4096)allowed=true;",
 ""].join('\n')+guard.slice(end);
assert.equal(guard.split("?'mcp':'ticket'").length,2);guard=guard.replace("?'mcp':'ticket'","?'mcp':base==='codex.exe'?'codex-cli':'ticket'");write('matrix-guards-01.cjs',guard);
let script=fs.readFileSync(path.join(prior,'run-product-matrix-01.ps1'),'utf8').replaceAll('F19','F20A').replaceAll('f19','f20a');
const anchor="$taskVendorCopy=Join-Path $taskExtensions 'anthropic.claude-code-2.1.301-win32-x64'";assert.equal(script.split(anchor).length,2);
script=script.replace(anchor,"$taskVendorCopy=Join-Path $taskRoot 'public-vendor/npm/node_modules/@openai/codex'");
const a=script.indexOf("$taskVendorPackage=Join-Path"),b=script.indexOf("$taskProductManifest=Join-Path",a);assert.ok(a>0&&b>a);
script=script.slice(0,a)+"$taskVendorPackage=Join-Path $taskVendorCopy 'package.json'\n"+script.slice(b);
const roaming="$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming'";assert.equal(script.split(roaming).length,2);script=script.replace(roaming,"$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskRoot 'public-vendor'");
const claude=";$taskInfo.EnvironmentVariables['CLAUDE_CONFIG_DIR']=Join-Path $taskProfile 'claude'";assert.equal(script.split(claude).length,2);script=script.replace(claude,'');
script=script.replace('Vendor extension bootstrap only discovers pin; native CLI bytes execute. Vendor webview prompt route UNVERIFIED.','Pinned native CLI executes from an isolated public npm copy; Codex IDE route UNVERIFIED. Provider Responses traffic/context remain unmediated.');
write('run-product-matrix-01.ps1',script);
const facts=['product-matrix-01.cjs','matrix-guards-01.cjs','run-product-matrix-01.ps1'].map(name=>{const bytes=fs.readFileSync(path.join(__dirname,name));return {path:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
write('native-product-freeze-01.json',JSON.stringify({status:'FROZEN_BEFORE_EXECUTION',expected:18,files:facts,independence:'LOW',scope:'Actual exact VSIX owner controller and pinned Codex CLI text/MCP route; known unmediated supplied-context disclosure explicitly asserted; no score/catalog promotion, IDE/clean-install/human/OS claims.'},null,2)+'\n');
console.log(JSON.stringify({status:'FROZEN_BEFORE_EXECUTION',expected:18}));
