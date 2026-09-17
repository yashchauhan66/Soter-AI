import { login, api } from './ultra-common.mjs';
const ULTRA = 'tPx0UyZaEqcay8cA';
const OLD = 'zC0IhnQkfnj0gPlU';
const cookie = await login();

// 1. Old workflow deactivate (frees shared webhookId)
const oldWf = await api(cookie, `/rest/workflows/${OLD}`);
console.log('OLD active:', oldWf.data?.data?.active);
if (oldWf.data?.data?.active) {
  const de = await api(cookie, `/rest/workflows/${OLD}/deactivate`, { method: 'POST', body: '{}' });
  console.log('OLD DEACTIVATE', de.status);
}

// 2. Ultra: unique webhookId + clean chat params, rename to best name
const wf = await api(cookie, `/rest/workflows/${ULTRA}`);
const d = wf.data.data;
for (const n of d.nodes) {
  if (n.name === 'When chat message received') {
    n.parameters = { responseMode: 'responseNode', webhookId: 'soter-ultra-helpdesk', options: {} };
  }
}
const bestName = 'SoterAI Guarded Helpdesk — Ultra-Pro SaaS Support';
const upd = await api(cookie, `/rest/workflows/${ULTRA}`, { method: 'PATCH', body: JSON.stringify({ versionId: d.versionId, name: bestName, nodes: d.nodes, connections: d.connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} }) });
console.log('PATCH', upd.status);
const act = await api(cookie, `/rest/workflows/${ULTRA}/activate`, { method: 'POST', body: JSON.stringify({ versionId: upd.data?.data?.versionId }) });
console.log('ACTIVATE', act.status, JSON.stringify(act.data).slice(0, 400));
