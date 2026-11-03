'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n);
let source=fs.readFileSync(own('run-content-04.cjs'),'utf8');
const start=source.indexOf('function fullSuite('),end=source.indexOf('async function main()',start);assert(start>0&&end>start);
const replacement=`function fullSuite(proof){
 const full=read(own('full-suite-acceptance-04.json'));assert.equal(full.status,'PASS_CURRENT_FULL_SUITE_ALL_FROZEN_TEST_FILES_SHARDED');assert.equal(full.sourceProof.sha256,sha(fs.readFileSync(own('full-inputs-04.json'))));
 const expected=proof.files.filter(r=>r.path.startsWith('packages/vscode-extension/src/__tests__/')&&r.path.endsWith('.test.ts')).map(r=>r.path).sort();assert.deepEqual(full.shards.flatMap(r=>r.files).sort(),expected);assert.equal(new Set(expected).size,expected.length);
 const allowed=['unit-shard-01-02','unit-shard-02-02','unit-shard-03-02','unit-shard-04-02','unit-shard-05-02','unit-shard-06-04','unit-shard-07-04','unit-shard-08-04'],counts={tests:0,pass:0,fail:0,cancelled:0,skipped:0};
 for(const shard of full.shards){assert(allowed.includes(shard.name));const lines=output(shard.name).toString().split(String.fromCharCode(10)).map(s=>s.trim());for(const key of Object.keys(counts)){const rows=lines.filter(s=>s.startsWith('# '+key+' '));assert.equal(rows.length,1);const pieces=rows[0].split(' ');assert.equal(pieces.length,3);assert(/^[0-9]+$/.test(pieces[2]));counts[key]+=Number(pieces[2]);}}
 for(const[k,v]of Object.entries(counts))assert.equal(full.counts[k],v);assert.equal(counts.fail,0);assert.equal(counts.cancelled,0);assert.equal(counts.skipped,4);assert.equal(counts.tests,counts.pass+counts.skipped);assert(counts.tests>=4783);return counts;
}
`;
source=source.slice(0,start)+replacement+source.slice(end);
source=source.replace("console.error('F31b exact content inspection refused: '+(error instanceof Error?error.name:'UnknownFailure'))","console.error(error)");
fs.writeFileSync(own('run-content-05.cjs'),source,{flag:'wx'});
// Exercise exact current input/closure/TAP admission without extraction side effects first.
const prefix=source.slice(0,source.indexOf('async function main()'));
new Function('require','__dirname',prefix+"\nconsole.log(JSON.stringify(fullSuite(inputs())));")(require,__dirname);
