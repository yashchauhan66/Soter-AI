'use strict';
const e=require('./evidence-lib-01.cjs'),input=e.read(e.own('source-inputs-04.json'));
e.assert.equal(input.parent,'0ef608959e35ec72d2d490322cbfeef8884c6069');
for(const record of input.records)e.current(record);
console.log(JSON.stringify({status:'PASS_CURRENT_INPUT_BYTES',files:input.records.length}));
