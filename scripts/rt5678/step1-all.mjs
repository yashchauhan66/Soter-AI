import { request, LIVE_KEY, LIVE_BASE, INPUT_V3, OUTPUT_V3, saveState } from './helpers.mjs';

// Step 0..3 merged: login, fetch original, live credential, build + save upgraded nodes.
const WF_ID = 'ra1LSDqUJn1M4a5s';
const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
if (login.status !== 200) throw new Error('Login failed');
console.log('PASS - logged in to :5678');

const got = await request('/rest/workflows/' + WF_ID);
if (got.status !== 200) throw new Error('Fetch original failed');
const wf = got.data.data;
console.log('PASS - fetched id=' + wf.id + ' nodes=' + wf.nodes.length);

// Live credential via PATCH (n8n 2.x needs name+type+data).
const credId = 'jp7mO4AKCUhn0TY2';
const upd = await request('/rest/credentials/' + credId, {
  method: 'PATCH',
  body: { name: 'SoterAI Production Cloud', type: 'soterApi', data: { apiKey: LIVE_KEY, baseUrl: LIVE_BASE } },
});
if (upd.status !== 200) throw new Error('Cred update failed: ' + JSON.stringify(upd.data).slice(0, 300));
console.log('PASS - live key + baseUrl on credential ' + credId);
const CREF = { soterApi: { id: credId, name: 'SoterAI Production Cloud' } };

// Build upgraded copy.
const editable = JSON.parse(JSON.stringify(wf));
for (const node of editable.nodes) {
  if (!String(node.type).includes('soterGuard')) continue;
  node.typeVersion = 3;
  if (node.name === 'Guard Input for Threats') node.parameters = JSON.parse(JSON.stringify(INPUT_V3));
  if (node.name === 'Verify Output for Safety') node.parameters = JSON.parse(JSON.stringify(OUTPUT_V3));
  node.credentials = JSON.parse(JSON.stringify(CREF));
}

// Mint Public API key for the save (n8n 2.x removed PUT /rest/workflows/:id).
const sc = await request('/rest/api-keys/scopes');
const avail = new Set((sc.data && sc.data.data) || []);
const scopes = ['workflow:read', 'workflow:update'].filter((s) => avail.has(s));
const mk = await request('/rest/api-keys', { method: 'POST', body: { label: 'soter-rt5678-' + Date.now(), expiresAt: null, scopes } });
if (mk.status !== 200) throw new Error('Key mint failed: ' + JSON.stringify(mk.data).slice(0, 300));
const KEY = mk.data.data.rawApiKey;
const KEY_ID = mk.data.data.id;
console.log('PASS - API key minted id=' + KEY_ID);

// Save via official Public API.
const put = await fetch('http://localhost:5678/api/v1/workflows/' + WF_ID, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({
    name: editable.name,
    nodes: editable.nodes,
    connections: editable.connections,
    settings: { executionOrder: (editable.settings && editable.settings.executionOrder) || 'v1' },
  }),
});
const text = await put.text();
console.log('public PUT status:', put.status);
if (!put.ok) throw new Error('Public save failed: ' + text.slice(0, 500));
const out = JSON.parse(text);
const sv = (out.nodes || []).filter((n) => String(n.type).includes('soterGuard'));
if (!(sv.length === 2 && sv.every((n) => n.typeVersion === 3))) throw new Error('tv3 persist failed');
console.log('PASS - both SoterAI nodes at tv3: ' + sv.map((n) => n.name).join(', '));
saveState({ wfId: WF_ID, CREF, savedWf: out, apiKeyId: KEY_ID });
console.log('STATE SAVED wfId=' + WF_ID);
