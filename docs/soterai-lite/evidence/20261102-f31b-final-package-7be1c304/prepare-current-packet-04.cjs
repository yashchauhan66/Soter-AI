'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n);
let source=fs.readFileSync(own('prepare-current-packet-03.cjs'),'utf8');
const token="['1088','1098'],";assert(source.includes(token));source=source.replace(token,'');
source=source.replace("guard=guard.replace(\"['compiler-02'","guard=guard.replace(/\\b1088\\b/g,'1098');\n+guard=guard.replace(\"['compiler-02'");
source=source.replace("put('run-content-03.cjs',content);","assert.equal(fs.readFileSync(own('run-content-03.cjs'),'utf8'),content);");
source=source.replaceAll('current-native-admission-03.cjs','current-native-admission-04.cjs');
// Keep failed03 and its precise expected-hash corruption; all other03 outputs were absent.
source=source.replace("console.log('PASS: current1098 packet", "console.log('PASS: corrected numeric-token current1098 packet");
assert(source.includes("guard=guard.replace(/\\b1088\\b/g,'1098')"));assert(!source.includes(token));
// A plus sign in the generated source would be invalid outside a string; guard it explicitly.
source=source.replace('\n+guard=','\nguard=');
fs.writeFileSync(own('prepare-current-packet-04.generated.cjs'),source,{flag:'wx'});
require(own('prepare-current-packet-04.generated.cjs'));
const runner=fs.readFileSync(own('run-affected-01.cjs'),'utf8');assert(runner.includes('current-native-admission-03.cjs'));
fs.writeFileSync(own('run-affected-02.cjs'),runner.replace('current-native-admission-03.cjs','current-native-admission-04.cjs'),{flag:'wx'});
