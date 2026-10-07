import { request, loadState } from './helpers.mjs';
// Verify the stored credential now carries the LIVE key (decrypt check via test endpoint is not exposed,
// so verify by fetching the credential record + running a live guard call in T1).
const st = JSON.parse((await import('node:fs')).readFileSync('.tmp/rt5678-state.json', 'utf8'));
console.log('wfId', st.wfId, 'CREF', JSON.stringify(st.CREF));
const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
console.log('login', login.status);
const one = await request('/rest/credentials/jp7mO4AKCUhn0TY2');
console.log('cred updatedAt', one.data && one.data.data && one.data.data.updatedAt);
// clean up probe credential created during probing
const del = await request('/rest/credentials/Rh9OnHiMCFfKE74h', { method: 'DELETE' });
console.log('probe-cred delete', del.status);
const creds = await request('/rest/credentials');
console.log('creds now', ((creds.data && creds.data.data) || []).map((c) => c.type + ':' + c.name).join(' | '));

