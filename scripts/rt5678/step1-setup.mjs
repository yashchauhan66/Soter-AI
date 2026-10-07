import fs from 'node:fs';
import path from 'node:path';
import { request, SNAPSHOT, LIVE_KEY, LIVE_BASE, INPUT_V3, OUTPUT_V3, saveState } from './helpers.mjs';

// Step 0..3: login, import snapshot, credential, upgrade to tv3.
// FIX: n8n flatted-parses runData; the ONLY thing broken was local parsing,
// never the live verdicts. Also fixes waitExecution to parse flatted.
const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
if (login.status !== 200) throw new Error('Login failed');
console.log('PASS - logged in to :5678');

const raw = fs.readFileSync(path.resolve(SNAPSHOT), 'utf8');
const arr = JSON.parse(raw);
const snap = Array.isArray(arr) ? arr[0] : arr;
const created = await request('/rest/workflows', {
  method: 'POST',
  body: { name: snap.name, nodes: snap.nodes, connections: snap.connections, settings: snap.settings },
});
const wf = created.data && created.data.data;
if (!wf || !wf.id) throw new Error('Import failed: ' + JSON.stringify(created.data).slice(0, 300));
console.log('PASS - imported id=' + wf.id + ' nodes=' + wf.nodes.length);
if (wf.nodes.filter((n) => String(n.type).includes('soterGuard')).length !== 2) throw new Error('snapshot missing SoterAI nodes');

const credRes = await request('/rest/credentials');
const creds = (credRes.data && credRes.data.data) || [];
let cred = creds.find((c) => c.type === 'soterApi');
if (!cred) {
  const mk = await request('/rest/credentials', {
    method: 'POST',
    body: { name: 'SoterAI Production Cloud', type: 'soterApi', data: { apiKey: LIVE_KEY, baseUrl: LIVE_BASE } },
  });
  cred = mk.data && mk.data.data;
  if (!cred || !cred.id) throw new Error('Cred create failed: ' + JSON.stringify(mk.data).slice(0, 300));
} else {
  // n8n 1.x/2.x: updating a credential created in another instance is rejected
  // (Cannot PUT). Create a fresh one with the LIVE key instead.
  const mk = await request('/rest/credentials', {
    method: 'POST',
    body: { name: 'SoterAI Production Cloud (live retest)', type: 'soterApi', data: { apiKey: LIVE_KEY, baseUrl: LIVE_BASE } },
  });
  cred = mk.data && mk.data.data;
  if (!cred || !cred.id) throw new Error('Cred create failed: ' + JSON.stringify(mk.data).slice(0, 300));
}
console.log('PASS - cred id=' + cred.id);
const CREF = { soterApi: { id: cred.id, name: cred.name } };

const editable = JSON.parse(JSON.stringify(wf));
for (const node of editable.nodes) {
  if (!String(node.type).includes('soterGuard')) continue;
  node.typeVersion = 3;
  if (node.name === 'Guard Input for Threats') node.parameters = JSON.parse(JSON.stringify(INPUT_V3));
  if (node.name === 'Verify Output for Safety') node.parameters = JSON.parse(JSON.stringify(OUTPUT_V3));
  node.credentials = JSON.parse(JSON.stringify(CREF));
}
const save = await request('/rest/workflows/' + wf.id, {
  method: 'PUT',
  body: { name: editable.name, nodes: editable.nodes, connections: editable.connections, settings: editable.settings },
});
if (save.status !== 200) throw new Error('Save failed: ' + JSON.stringify(save.data).slice(0, 300));
const savedWf = (save.data && save.data.data) || editable;
const sv = (savedWf.nodes || []).filter((n) => String(n.type).includes('soterGuard'));
if (!(sv.length === 2 && sv.every((n) => n.typeVersion === 3))) throw new Error('tv3 persist failed');
console.log('PASS - both SoterAI nodes at tv3: ' + sv.map((n) => n.name).join(', '));
saveState({ wfId: wf.id, CREF, savedWf });
console.log('STATE SAVED wfId=' + wf.id);
