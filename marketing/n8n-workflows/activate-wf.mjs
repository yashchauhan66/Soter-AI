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
const versionId = wf.data?.data?.versionId;
console.log('versionId =', versionId);

const activateRes = await api(`/rest/workflows/${wfId}/activate`, {
  method: 'POST',
  body: JSON.stringify({ versionId }),
});
console.log('Activate status:', activateRes.status);
console.log('Activate result:', JSON.stringify(activateRes.data).slice(0, 300));