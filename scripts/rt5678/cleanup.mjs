import { request } from './helpers.mjs';
// Delete the partial import from the failed step1 run using the DELETE route that works.
const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
console.log('login', login.status);
const all = await request('/rest/workflows');
const list = (all.data && all.data.data) || [];
console.log('workflows:', list.map((w) => w.id + ' :: ' + w.name).join('\n  '));
for (const w of list.filter((w) => w.id === '93AJwJFRw11jsKeq')) {
  const d = await request('/api/v1/workflows/' + w.id, { method: 'DELETE' });
  console.log('public-api delete', w.id, '->', d.status, JSON.stringify(d.data).slice(0, 200));
}
