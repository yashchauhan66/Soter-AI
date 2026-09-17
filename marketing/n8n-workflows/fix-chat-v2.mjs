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
console.log('VERSION:', data.versionId);
const chat = data.nodes.find((n) => n.name === 'When chat message received');
console.log('BEFORE:', JSON.stringify(chat.parameters));
chat.parameters.responseMode = 'responseNode';
chat.parameters.options = chat.parameters.options || {};
const body = { versionId: data.versionId, name: data.name, nodes: data.nodes, connections: data.connections, settings: data.settings, staticData: data.staticData ?? null, pinData: data.pinData ?? {} };
const upd = await api(`/rest/workflows/${wfId}`, { method: 'PATCH', body: JSON.stringify(body) });
console.log('PATCH:', upd.status);
if (upd.status !== 200) console.log(JSON.stringify(upd.data).slice(0,2000));
else console.log('FIXED OK - refresh UI now');
