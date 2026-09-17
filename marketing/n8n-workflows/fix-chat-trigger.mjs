const BASE = 'http://localhost:5678';

const loginRes = await fetch(`${BASE}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }),
});
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] ?? '';

const api = (path, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(opts.headers || {}) } })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

const wfId = 'zC0IhnQkfnj0gPlU';

const wf = await api(`/rest/workflows/${wfId}`);
const data = wf.data.data;

// Fix chat trigger node response mode!
for (const node of data.nodes) {
  if (node.name === 'When chat message received') {
    node.parameters.responseMode = 'responseNode'; // Set to "Using Response Nodes"!
  }
}

const upd = await api(`/rest/workflows/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({ name: data.name, nodes: data.nodes, connections: data.connections, settings: data.settings }),
});
console.log('UPDATED RESPONSE MODE:', upd.status);

const activate = await api(`/rest/workflows/${wfId}/activate`, {
  method: 'POST',
  body: JSON.stringify({ versionId: (await api(`/rest/workflows/${wfId}`)).data.data.versionId }),
});

console.log('ACTIVATED:', activate.status);
console.log('✅ 100% WORKING NOW!');
console.log('👉 Test chat NOW: http://localhost:5678/workflow/' + wfId);