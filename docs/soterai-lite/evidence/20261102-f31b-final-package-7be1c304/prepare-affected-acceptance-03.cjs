'use strict';
// Metadata-only successor: choose actual successful phases without altering any oracle.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const own = name => path.join(__dirname, name);
let source = fs.readFileSync(own('verify-affected-02.cjs'), 'utf8');
function replaceOnce(before, after) {
  assert.equal(source.split(before).length - 1, 1, before);
  source = source.replace(before, () => after);
}
replaceOnce("read(own('affected-chain-result-02.json'))", "read(own('affected-chain-result-03.json'))");
replaceOnce('F31B_REMAINING_RETAINED_FUNCTIONAL_SECURITY_MCP_ROUND02_CLOSED_ROOT_AGGREGATION_PENDING', 'F31B_REMAINING_FUNCTIONAL_SECURITY_MCP_RETAINED_ROUND03_CLOSED_ROOT_AGGREGATION_PENDING');
replaceOnce("['affected-retained-f31b-02','affected-functional-security-f31b-02','affected-mcp-f31b-02']", "['affected-functional-security-f31b-03','affected-mcp-f31b-03','affected-retained-f31b-03']");
replaceOnce("(['ps51','editor'].includes(f.id)?'01':'02')", "(['ps51','editor'].includes(f.id)?'01':'03')");
replaceOnce("wrapper('affected-functional-security-f31b-02')", "wrapper('affected-functional-security-f31b-03')");
replaceOnce("'affected-chain-result-02.json','affected-continuation-02.json','prior-owner-absence-01.json','prior-owner-absence-02.json'", "'affected-chain-failure-02.json','affected-chain-consumption-03.json','affected-chain-result-03.json','affected-continuation-02.json','affected-continuation-03.json','prior-owner-absence-01.json','prior-owner-absence-02.json','prior-owner-absence-03.json','post-owner-absence-01.json'");
replaceOnce(" C.binding();for(const n of", " const absence=read(own('post-owner-absence-01.json'));assert.equal(absence.status,'MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS');assert.equal(absence.observations.length,2);assert(absence.observations.every(o=>o.markedCount===0));assert.equal(absence.signalsRequested,0);assert(Date.parse(absence.observedAt)>Date.parse(chain.observedAt));\n C.binding();for(const n of");
replaceOnce('final marked-owner observation remains separately required.', 'subsequent final marked-owner absence was observed twice. Historical round02 outer exec84707 close/EOF remains UNCONFIRMED; its failed phase is not reused.');
replaceOnce('current advisory authorization and human/independent gates remain incomplete.', 'current advisory results require review and human/independent gates remain incomplete.');
new vm.Script(source, { filename: 'verify-affected-03.cjs' });
fs.writeFileSync(own('verify-affected-03.cjs'), source, { flag: 'wx' });
console.log('Prepared actual round03 aggregator; no host or original assertion changed.');
