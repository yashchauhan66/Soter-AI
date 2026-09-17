import { login, api } from './ultra-common.mjs';
const WF = 'tPx0UyZaEqcay8cA';
const cookie = await login();
const wf = await api(cookie, `/rest/workflows/${WF}`);
const d = wf.data.data;
for (const n of d.nodes) {
  if (n.type === 'n8n-nodes-base.code') {
    n.parameters.mode = 'runOnceForAllItems';
  }
  if (n.name === 'When chat message received') {
    n.parameters.webhookId = 'soter-ultra-helpdesk';
  }
  if (n.name === 'PII Redactor') {
    n.parameters.piiText = '={{ $json.safeText ?? $json.chatInput }}';
  }
}
const body = { versionId: d.versionId, name: d.name, nodes: d.nodes, connections: d.connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} };
const upd = await api(cookie, `/rest/workflows/${WF}`, { method: 'PATCH', body: JSON.stringify(body) });
console.log('PATCH', upd.status, JSON.stringify(upd.data).slice(0, 300));
