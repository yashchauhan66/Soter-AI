import { request, LIVE_KEY, LIVE_BASE, INPUT_V3, OUTPUT_V3, saveState } from './helpers.mjs';

// Step 0..3 against the ORIGINAL workflow (already on :5678 as ra1LSDqUJn1M4a5s).
const WF_ID = 'ra1LSDqUJn1M4a5s';
const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
if (login.status !== 200) throw new Error('Login failed');
console.log('PASS - logged in to :5678');

const got = await request('/rest/workflows/' + WF_ID);
if (got.status !== 200) throw new Error('Fetch original failed: ' + JSON.stringify(got.data).slice(0, 300));
const wf = got.data.data;
console.log('PASS - fetched original id=' + wf.id + ' nodes=' + wf.nodes.length);
const soterNodes = wf.nodes.filter((n) => String(n.type).includes('soterGuard'));
console.log('SoterAI nodes: ' + soterNodes.map((n) => n.name + '@tv' + n.typeVersion).join(', '));

// Credential: PATCH needs name+type+data.
const credId = 'jp7mO4AKCUhn0TY2';
const upd = await request('/rest/credentials/' + credId, {
  method: 'PATCH',
  body: { name: 'SoterAI Production Cloud', type: 'soterApi', data: { apiKey: LIVE_KEY, baseUrl: LIVE_BASE } },
});
if (upd.status !== 200) throw new Error('Cred update failed: ' + JSON.stringify(upd.data).slice(0, 300));
console.log('PASS - live key + baseUrl written to credential ' + credId);
const CREF = { soterApi: { id: credId, name: 'SoterAI Production Cloud' } };

// Upgrade both SoterAI nodes to tv3 (v0.8.2 panel shape).
const editable = JSON.parse(JSON.stringify(wf));
for (const node of editable.nodes) {
  if (!String(node.type).includes('soterGuard')) continue;
  node.typeVersion = 3;
  if (node.name === 'Guard Input for Threats') node.parameters = JSON.parse(JSON.stringify(INPUT_V3));
  if (node.name === 'Verify Output for Safety') node.parameters = JSON.parse(JSON.stringify(OUTPUT_V3));
  node.credentials = JSON.parse(JSON.stringify(CREF));
}
const save = await request('/rest/workflows/' + WF_ID, {
  method: 'PUT',
  body: { name: editable.name, nodes: editable.nodes, connections: editable.connections, settings: editable.settings },
});
if (save.status !== 200) throw new Error('Save failed: ' + JSON.stringify(save.data).slice(0, 400));
const savedWf = (save.data && save.data.data) || editable;
const sv = (savedWf.nodes || []).filter((n) => String(n.type).includes('soterGuard'));
if (!(sv.length === 2 && sv.every((n) => n.typeVersion === 3))) throw new Error('tv3 persist failed: ' + JSON.stringify(sv.map((n) => n.name + '@tv' + n.typeVersion)));
console.log('PASS - both SoterAI nodes at tv3: ' + sv.map((n) => n.name).join(', '));
saveState({ wfId: WF_ID, CREF, savedWf });
console.log('STATE SAVED wfId=' + WF_ID);
