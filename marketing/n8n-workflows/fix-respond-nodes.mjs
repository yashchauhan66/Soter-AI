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

for (const node of data.nodes) {
  if (node.name === 'Respond (Blocked)') {
    node.parameters = {
      respondWith: 'text',
      message:
        '🚫 Blocked by SoterAI Security: your message was flagged as a potential prompt injection / policy violation (threat score: {{ $json.threatScore ?? "n/a" }}).',
      options: {},
    };
  }
  if (node.name === 'Respond (Success)') {
    node.parameters = {
      respondWith: 'text',
      message: '={{ $json.outputText }}',
      options: {},
    };
  }
}

const upd = await api(`/rest/workflows/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({ name: data.name, nodes: data.nodes, connections: data.connections, settings: data.settings }),
});
console.log('UPDATE:', upd.status);

const wf2 = await api(`/rest/workflows/${wfId}`);
const activateRes = await api(`/rest/workflows/${wfId}/activate`, {
  method: 'POST',
  body: JSON.stringify({ versionId: wf2.data.data.versionId }),
});
console.log('ACTIVATE:', activateRes.status, JSON.stringify(activateRes.data).slice(0, 200));