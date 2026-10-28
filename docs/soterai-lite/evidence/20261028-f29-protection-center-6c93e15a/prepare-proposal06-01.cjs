'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {own,read,guard,sha}=require('./current-native-guard-03.cjs');
const put=(name,text)=>fs.writeFileSync(own(name),text,{flag:'wx'});
const replace=(text,from,to,count)=>{assert.equal(text.split(from).length-1,count,from);return text.split(from).join(to);};
(async()=>{
 await guard();
 const receipt=read(own('palette-entrypoints-component-07.txt.result.json'));assert.equal(receipt.exitCode,0);assert.equal(sha(fs.readFileSync(own('palette-entrypoints-component-07.txt'))),receipt.sha256.toLowerCase());
 const old=fs.readFileSync(own('run-code-renderer-observer-05.cjs'),'utf8');
 let observer=replace(old,'const FOCUS = ["View: Focus on Protected items View", "View: Focus on Activity View", "View: Focus on Coverage View"];','const {paletteQueries}=require("./palette-entrypoints-06.cjs");\nconst QUERIES=paletteQueries(require("./vsix-extracted-02/extension/package.json"));\nconst FOCUS=QUERIES.focus;',1);
 observer=replace(observer,'await palette("SoterAI: Open Protection Center");','await palette(QUERIES.open);',2);
 observer=replace(observer,'inputMethod: "REAL_OWNED_RENDERER_KEYBOARD_ONLY_NO_MOUSE_NO_DOM_FOCUS", observations: [],','inputMethod: "REAL_OWNED_RENDERER_KEYBOARD_ONLY_NO_MOUSE_NO_DOM_FOCUS", commandQueries: QUERIES, observations: [],',1);
 put('run-code-renderer-observer-06.cjs',observer);
 let runner=fs.readFileSync(own('run-f29-native-06.cjs'),'utf8');
 for(const [from,to]of [['extra05-approval-01.json','extra06-approval-01.json'],['extra05-consumption-01.json','extra06-consumption-01.json'],['PROPOSAL05.md','PROPOSAL06.md'],['f29-native-run-start-06.json','f29-native-run-start-07.json'],['f29-native-run-failure-06.json','f29-native-run-failure-07.json'],['renderer-binding-06.json','renderer-binding-07.json'],['run-code-renderer-observer-05.cjs','run-code-renderer-observer-06.cjs']]){assert(runner.includes(from));runner=runner.split(from).join(to);}
 runner=replace(runner,'fact(own("palette-keyboard-fixture-05.cjs"))','fact(own("palette-keyboard-fixture-05.cjs")),fact(own("palette-entrypoints-06.cjs"))',1);
 put('run-f29-native-07.cjs',runner);
 let chain=fs.readFileSync(own('run-f29-native-chain-05.cjs'),'utf8');
 for(const [from,to]of [['f29-native-chain-result-04.json','f29-native-chain-result-05.json'],['f29-native-run-start-06.json','f29-native-run-start-07.json'],['f29-native-run-failure-06.json','f29-native-run-failure-07.json'],['native-run-05','native-run-06'],['PROPOSAL05.md','PROPOSAL06.md'],['extra05-approval-01.json','extra06-approval-01.json'],['run-f29-native-chain-05.cjs','run-f29-native-chain-06.cjs'],['run-f29-native-06.cjs','run-f29-native-07.cjs'],['run-code-renderer-observer-05.cjs','run-code-renderer-observer-06.cjs'],['f29-native-launch-manifest-05.json','f29-native-launch-manifest-06.json'],['f29-native-chain-result-05.json','f29-native-chain-result-06.json'],['f29-native-chain-failure-05.json','f29-native-chain-failure-06.json']]){assert(chain.includes(from));chain=chain.split(from).join(to);}
 // Keep the prerequisite at actual failed extra05, whose Code/wrapper closure is verified.
 chain=replace(chain,"const previous=read(own('f29-native-chain-result-06.json'))","const previous=read(own('f29-native-chain-result-05.json'))",1);
 chain=replace(chain,"'palette-keyboard-fixture-05.cjs','palette-keyboard-fixture-05.test.cjs'","'palette-entrypoints-06.cjs','palette-entrypoints-06.test.cjs','palette-entrypoints-component-07.txt.result.json','palette-contract-trace-06.json','focus-category-trace-06.json','palette-keyboard-fixture-05.cjs','palette-keyboard-fixture-05.test.cjs'",1);
 chain=chain.replaceAll('EXPLICIT_SINGLE_EXTRA05','EXPLICIT_SINGLE_EXTRA06');put('run-f29-native-chain-06.cjs',chain);
 let launcher=fs.readFileSync(own('start-native-chain-06.ps1'),'utf8');
 for(const [from,to]of [['native-chain-owner-05.json','native-chain-owner-06.json'],['native-chain-stdout-05.txt','native-chain-stdout-06.txt'],['native-chain-stderr-05.txt','native-chain-stderr-06.txt'],['extra05-approval-01.json','extra06-approval-01.json'],['run-f29-native-chain-05.cjs','run-f29-native-chain-06.cjs'],['EXPLICIT_SINGLE_EXTRA05','EXPLICIT_SINGLE_EXTRA06']]){assert(launcher.includes(from));launcher=launcher.split(from).join(to);}
 put('start-native-chain-07.ps1',launcher);
 const result={status:'PROPOSAL06_HARNESS_PREPARED_NOT_AUTHORIZED_NOT_RUN',observedAt:new Date().toISOString(),currentInputs:1024,componentChecks:6,productionChanged:false,vsixSha256:'47dfb6a3f475f53b7bb5ca4a21f3ada524a1a6e64622c90f1325e529fa85b253',sourceProofSha256:'0a8331e1fbe3b41f0153e7564ae9ee1c2ec25c77db8ec46196c4c6e280dc540f',files:['run-code-renderer-observer-06.cjs','run-f29-native-07.cjs','run-f29-native-chain-06.cjs','start-native-chain-07.ps1'].map(name=>({name,bytes:fs.statSync(own(name)).size,sha256:sha(fs.readFileSync(own(name)))})),delta:'Fixture palette queries only: derive existing visible Control Panel alias and focus categories from exact shipped manifest. All30 native oracles, actual keyboard focus/arrows/Enter/Escape/revoke ordering, budgets, source, VSIX and custody unchanged.',native06:'F26a_USER_DEFERRED_NOT_RUN',signalsRequested:0};
 put('proposal06-preparation-01.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
