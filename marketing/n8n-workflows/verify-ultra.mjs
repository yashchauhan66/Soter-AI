import { login, api } from './ultra-common.mjs';
const cookie = await login();
const det = await api(cookie, '/rest/workflows/tPx0UyZaEqcay8cA');
const d = det.data.data;
for (const n of d.nodes) {
  if (n.type === 'n8n-nodes-base.code') {
    console.log('CODE:', n.name, '|', n.parameters.mode, '|', String(n.parameters.jsCode).slice(0, 120));
  }
  if (n.name === 'When chat message received') {
    console.log('CHAT:', JSON.stringify(n.parameters));
  }
  if (n.name === 'Intent Router') {
    console.log('ROUTER:', JSON.stringify(n.parameters).slice(0, 600));
  }
}
