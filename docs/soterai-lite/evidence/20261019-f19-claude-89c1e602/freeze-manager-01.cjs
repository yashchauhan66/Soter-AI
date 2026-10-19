'use strict';
const fs=require('node:fs'),path=require('node:path'),repo=path.resolve(__dirname,'../../../..'),tests=path.join(repo,'packages/vscode-extension/src/__tests__');
let source=fs.readFileSync(path.join(tests,'gatewayPolicyManager.test.ts'),'utf8');const end=source.indexOf('test("F16-M01');if(end<0)throw Error('Missing fixture boundary');source=source.slice(0,end);
source=source.replace('clineAck?:unknown','clineAck?:unknown;claudeAck?:unknown');
source=source.replace('ready:true,generation,clineToolSchemas:','ready:true,generation,claudeToolSchemas:Object.hasOwn(extra,"claudeAck")?extra.claudeAck:envs.at(-1)?.SOTERAI_CLAUDE_TOOL_SCHEMAS==="1",clineToolSchemas:');
source+=fs.readFileSync(path.join(__dirname,'manager-tests-01.ts.txt'),'utf8');
fs.writeFileSync(path.join(tests,'claudeGatewayManager.test.ts'),source,{flag:'wx'});for(const name of['claudeGatewayManager','claudeGatewayWire','claudeLegacyRoute'])fs.copyFileSync(path.join(tests,name+'.test.ts'),path.join(__dirname,name+'-frozen-01.ts.txt'),fs.constants.COPYFILE_EXCL);
