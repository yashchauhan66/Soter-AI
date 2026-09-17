import { login, api } from './ultra-common.mjs';
const cookie = await login();

// Find REAL chat URL format: query active-webhooks endpoint
const probes = [
  '/rest/active-workflows',
  '/rest/workflows/active',
  '/rest/webhooks',
  '/form/soter-ultra-helpdesk',
];
for (const p of probes) {
  const r = await fetch('http://localhost:5678' + p, { headers: { Cookie: cookie } });
  console.log(p, '->', r.status, (await r.text()).slice(0, 200).replace(/\s+/g, ' '));
}
