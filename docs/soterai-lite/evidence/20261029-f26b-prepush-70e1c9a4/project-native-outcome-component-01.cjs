'use strict';
// Cross-language component input only. Retained native result is never overwritten or re-graded.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const own=n=>path.join(__dirname,n),[input,output]=process.argv.slice(2);assert(['native-prepush-08.host.ts.txt','native-prepush-09.host.ts.txt'].includes(input));assert(/^native-outcome-(?:before|after)-projection-01\.json$/.test(output));
const tree=ts.createSourceFile(input,fs.readFileSync(own(input),'utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);let expression;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='summary'){assert(node.initializer&&ts.isObjectLiteralExpression(node.initializer));const prop=node.initializer.properties.find(p=>p.name?.getText(tree)==='driverFailure');assert(prop);expression=ts.isShorthandPropertyAssignment(prop)?prop.name.getText(tree):prop.initializer.getText(tree);}ts.forEachChild(node,visit);}visit(tree);assert(expression);
const serialize=value=>JSON.parse(JSON.stringify(vm.runInNewContext('({driverFailure:('+expression+')})',{driverFailure:value},{timeout:1000})));
const result={scope:'SIMULATED_SERIALIZATION_COMPONENT_ONLY_NOT_NATIVE_ACCEPTANCE',input,expression,success:serialize(undefined),ordinaryFailure:serialize('NativePrePushComponentFailure'),busyFailure:serialize('STOP_UNCONFIRMED')};
fs.writeFileSync(own(output),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'ACTUAL_PRODUCER_PROPERTY_EXTRACTED_COMPONENT_PROJECTION_ONLY',input,output,successPropertyPresent:Object.hasOwn(result.success,'driverFailure')}));
