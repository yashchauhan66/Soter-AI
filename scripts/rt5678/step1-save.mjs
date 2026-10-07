import fs from 'node:fs';
import path from 'node:path';
import { request, loadState, saveState } from './helpers.mjs';

// Mint a Public API key (session auth) then save the upgraded workflow via PUT /api/v1/workflows/:id.
const st = loadState();
const WF_ID = st.wfId || 'ra1LSDqUJn1M4a5s';
const savedWf = st.savedWf;
if (!savedWf) throw new Error('no savedWf in state — rerun step1-direct first');

const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
if (login.status !== 200) throw new Error('Login failed');

const sc = await request('/rest/api-keys/scopes');
const avail = new Set((sc.data && sc.data.data) || []);
const wanted = ['workflow:read', 'workflow:update'];
const scopes = wanted.filter((s) => avail.has(s));
console.log('minting key with scopes:', scopes.join(','));
const mk = await request('/rest/api-keys', { method: 'POST', body: { label: 'soter-rt5678-' + Date.now(), expiresAt: null, scopes } });
if (mk.status !== 200) throw new Error('Key mint failed: ' + JSON.stringify(mk.data).slice(0, 300));
const KEY = mk.data.data.rawApiKey;
const KEY_ID = mk.data.data.id;
console.log('PASS - API key minted id=' + KEY_ID);

const put = await fetch('http://localhost:5678/api/v1/workflows/' + WF_ID, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({
    name: savedWf.name,
    nodes: savedWf.nodes,
    connections: savedWf.connections,
    settings: { executionOrder: (savedWf.settings && savedWf.settings.executionOrder) || 'v1' },
  }),
});
const text = await put.text();
console.log('public PUT status:', put.status);
if (!put.ok) throw new Error('Public save failed: ' + text.slice(0, 500));
const out = JSON.parse(text);
const sv = (out.nodes || []).filter((n) => String(n.type).includes('soterGuard'));
console.log('PASS - saved via Public API:', sv.map((n) => n.name + '@tv' + n.typeVersion).join(', '));
st.savedWf = out;
saveState({ ...st, apiKeyId: KEY_ID });
console.log('STATE UPDATED (apiKeyId kept for cleanup at the end)');
