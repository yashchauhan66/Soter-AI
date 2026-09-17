import { login, api } from './ultra-common.mjs';
const WF = 'tPx0UyZaEqcay8cA';
const cookie = await login();

// How does chatTrigger receive messages in this n8n version?
// List chat-related REST routes via OpenAPI-ish probing: try chat send endpoints
const candidates = [
  ['POST /rest/chat/send', '/rest/chat/send'],
  ['POST /rest/workflows chat run', `/rest/workflows/${WF}/run`],
];
for (const [label, path] of candidates) {
  const r = await api(cookie, path, { method: 'POST', body: JSON.stringify({ chatInput: 'ping', sessionId: 'probe-1' }) });
  console.log(label, '->', r.status, JSON.stringify(r.data).slice(0, 300));
}

// Also: dump chatTrigger node full params + check active workflows list
const wf = await api(cookie, `/rest/workflows/${WF}`);
const d = wf.data.data;
console.log('\nCHAT NODE FULL:', JSON.stringify(d.nodes.find((n) => n.name === 'When chat message received'), null, 2).slice(0, 900));
const list = await api(cookie, '/rest/workflows?limit=20&active=true');
console.log('\nACTIVE COUNT:', JSON.stringify(list.data).slice(0, 400));
