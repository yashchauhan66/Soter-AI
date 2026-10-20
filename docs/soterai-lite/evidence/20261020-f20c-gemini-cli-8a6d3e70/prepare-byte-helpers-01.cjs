const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const prior=path.resolve(__dirname,'../20261019-f20b-codex-ide-c7a309e2'),read=n=>fs.readFileSync(path.join(prior,n),'utf8'),write=(n,t)=>fs.writeFileSync(path.join(__dirname,n),t,{flag:'wx'});
write('evidence-lib-01.cjs',read('evidence-lib-01.cjs'));
const owned=[
 'apps/local-ai-broker/src/GeminiGenerateContentSchema.ts','apps/local-ai-broker/src/GeminiProviderTarget.ts','apps/local-ai-broker/src/GatewayBoundary.ts','apps/local-ai-broker/src/GatewayPolicy.ts','apps/local-ai-broker/src/BrokerServer.ts','apps/local-ai-broker/src/cli.ts',
 ...['GeminiCliAdapter','GeminiCliAdapterPolicy','GeminiCliPinData','GeminiCliRuntimePin','GeminiGenerateContentBridge','GeminiHttpBridge'].map(n=>'packages/vscode-extension/src/adapters/'+n+'.ts'),
 ...['geminiCliAdapterLifecycle','geminiCliAdapterPolicy','geminiCliAdapterRegistration','geminiCliRuntimePin','geminiGatewayManager','geminiGenerateContentBridge','geminiGenerateContentSchema','geminiGenerateContentWire','geminiHttpBridge','claudeGatewayManager','codexResponsesManager','gatewayPolicyManager','mcp-canary-boundary','ownedBrokerManager'].map(n=>'packages/vscode-extension/src/__tests__/'+n+'.test.ts'),
 ...['request-1','request-2','cancel-result'].map(n=>'packages/vscode-extension/src/__tests__/fixtures/gemini-cli-0.55.1-'+n+'.json'),
 'packages/vscode-extension/src/broker/BrokerManager.ts','packages/vscode-extension/src/extension.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','packages/soterai-lite/README.md','docs/vscode-extension-readiness.md','docs/soterai-lite/FEATURE-QUEUE.json'];
let index=read('prepare-index-01.cjs').replaceAll('c0c9dce010c90c0b419c7979d65ace2677c87c8f','7dddc21c0b9863c6317ecc0e9299079f1642dedd').replaceAll('f20b','f20c').replaceAll('F20B separately pinned IDE native text Responses and F04 integration','F20C separately pinned Gemini CLI native text GenerateContent and F04 integration');
const a=index.indexOf('const ownSources='),b=index.indexOf('const modified=',a);assert(a>0&&b>a);index=index.slice(0,a)+'const ownSources=new Set('+JSON.stringify(owned)+');\n'+index.slice(b);
index=index.replaceAll('20261019-f20a-responses-45ae291c','20261019-f20b-codex-ide-c7a309e2');
write('prepare-index-01.cjs',index);
write('verify-source-01.cjs',read('verify-source-01.cjs').replaceAll('f20b','f20c').replaceAll('F20B','F20C'));
let close=read('close-source-01.ps1').replaceAll('f20b','f20c').replaceAll('F20B','F20C').replace('feat(lite): add separately pinned Codex IDE safe-read and text gateway','feat(lite): add pinned Gemini CLI safe-read and text gateway').replace('docs(lite): verify Codex IDE bytes and activate separate Gemini card','docs(lite): verify Gemini bytes and activate hygiene card');
write('close-source-01.ps1',close);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',ownedSourcePaths:owned.length}));
