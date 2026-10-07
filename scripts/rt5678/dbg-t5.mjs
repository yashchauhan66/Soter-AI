import { request, loadState, runAdHoc, firstVerdict, engineOf, verdictOf, INPUT_V3 } from './helpers.mjs';

const relog = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
console.log('login', relog.status);
const st = loadState();

// Same shape as step3 T5 battery: single guard node, expression input, no feeder node
const p = JSON.parse(JSON.stringify(INPUT_V3));
p.inputText = '={{ $json.text }}';
delete p.options.sessionId;
// Feeder-node variant: n8n expressions resolve against the previous node's
// output, which is how the real workflow delivers chatInput. Ad-hoc partial
// runs (destinationNode) don't carry that context, so a single guard node with
// an expression always sees empty input — hence engine=none/EMPTY_INPUT.
const wf = {
  name: 't5dbg',
  nodes: [
    { parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: "Where can I download my invoice?" } }];' }, id: 'n0', name: 'FeedText', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0] },
    { parameters: p, id: 'n1', name: 'Guard Input for Threats', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0], credentials: st.CREF },
  ],
  connections: { FeedText: { main: [[{ node: 'Guard Input for Threats', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1' },
};
const r = await runAdHoc(wf, 'Guard Input for Threats');
console.log('STATUS', r.status);
console.log('ERR', JSON.stringify(r.error).slice(0, 600));
const v = firstVerdict(r.runData, 'Guard Input for Threats');
console.log('VERDICT-KEYS', v ? Object.keys(v).join(',') : 'NULL');
if (v) {
  console.log('engine=', v.engine, '| verdict=', v.verdictCode, '| risk=', v.riskScore, '| branch=', v.branch);
  console.log('FULL:', JSON.stringify(v).slice(0, 900));
}
