'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {typePaletteQuery}=require('./palette-keyboard-fixture-05.cjs');
function fixture({readyAfter=0,losePrefix=false,neverFocused=false}={}){
 const events=[];let probes=0,focused=false,value='>old command';
 const input={isVisible:async()=>{probes++;return probes>readyAfter;},evaluate:async()=>{focused=!neverFocused&&probes>readyAfter;return focused;},inputValue:async()=>value};
 const page={locator:selector=>{assert.equal(selector,'.quick-input-widget input');return input;},keyboard:{press:async key=>{assert(focused,'Key sent before actual input focus');assert.equal(key,'Control+A');events.push({key});},type:async(text,options)=>{assert(focused);assert.deepEqual(options,{delay:5});events.push({typed:text});value=losePrefix?'>terAI: Open Protection Center':text;}}};
 const budgets=[];const until=async(check,budget,message)=>{budgets.push(budget);for(let n=0;n<8;n++){const count=events.length;if(await check())return;if(!focused)assert.equal(events.length,count);await Promise.resolve();}throw Error(message);};
 return{page,until,events,budgets,get value(){return value;}};
}
test('delayed native input receives no key until visible focus, then the exact full command',async()=>{const f=fixture({readyAfter:3});await typePaletteQuery(f.page,'SoterAI: Open Protection Center',f.until);assert.deepEqual(f.events,[{key:'Control+A'},{typed:'>SoterAI: Open Protection Center'}]);assert.equal(f.value,'>SoterAI: Open Protection Center');assert.deepEqual(f.budgets,[8000,8000]);});
test('never-focused input refuses without typing or Enter',async()=>{const f=fixture({neverFocused:true});await assert.rejects(typePaletteQuery(f.page,'SoterAI: Open Protection Center',f.until),/not visible and focused/);assert.deepEqual(f.events,[]);});
test('recorded real missing-prefix value is rejected before Enter',async()=>{const previous=JSON.parse(fs.readFileSync(path.join(__dirname,'f29-protection-center-native-20261028T123619Z-44aa23dd/f29-renderer-observations-01.json'),'utf8'));assert.equal(previous.failureUi.quickInput[0].input,'>terAI: Open Protection Center');const f=fixture({losePrefix:true});await assert.rejects(typePaletteQuery(f.page,'SoterAI: Open Protection Center',f.until),/complete command input differs/);assert(!f.events.some(event=>event.key==='Enter'));});
test('reopening with an old query uses only keyboard selection and replacement',async()=>{const f=fixture();await typePaletteQuery(f.page,'View: Focus on Activity View',f.until);assert.equal(f.value,'>View: Focus on Activity View');assert.equal(f.events[0].key,'Control+A');});
test('the fixture never activates a command; observer must check actual results first',async()=>{const f=fixture();await typePaletteQuery(f.page,'View: Focus on Coverage View',f.until);assert.equal(f.events.length,2);assert(!f.events.some(event=>event.key==='Enter'));});
