import { login, api } from './ultra-common.mjs';
import crypto from 'node:crypto';

const cookie = await login();

// Minimal workflow: chat trigger -> chat respond only
const chatId = crypto.randomUUID();
const respId = crypto.randomUUID();
const body = {
  name: 'MINIMAL CHAT PROBE',
  nodes: [
    { id: chatId, name: 'When chat message received', type: '@n8n/n8n-nodes-langchain.chatTrigger', typeVersion: 1.1, position: [0, 0], webhookId: 'probe-chat-xyz', parameters: { responseMode: 'responseNode', options: {} } },
    { id: respId, name: 'Respond', type: '@n8n/n8n-nodes-langchain.chat', typeVersion: 1, position: [300, 0], parameters: { message: 'hello probe ok', options: {} } },
  ],
  connections: { 'When chat message received': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1' },
  staticData: null,
  pinData: {},
};
const created = await api(cookie, '/rest/workflows', { method: 'POST', body: JSON.stringify(body) });
console.log('CREATE', created.status, JSON.stringify(created.data).slice(0, 400));
const wid = created.data?.data?.id;
if (!wid) process.exit(1);
const w = await api(cookie, `/rest/workflows/${wid}`);
const act = await api(cookie, `/rest/workflows/${wid}/activate`, { method: 'POST', body: JSON.stringify({ versionId: w.data.data.versionId }) });
console.log('ACTIVATE', act.status, JSON.stringify(act.data).slice(0, 800));
await new Promise((r) => setTimeout(r, 2000));
const t = await fetch('http://localhost:5678/webhook/probe-chat-xyz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId: 'p1', chatInput: 'hi' }) });
console.log('PROBE WEBHOOK:', t.status, (await t.text()).slice(0, 400));
// cleanup
await api(cookie, `/rest/workflows/${wid}/deactivate`, { method: 'POST', body: JSON.stringify({ versionId: act.data?.data?.versionId ?? w.data.data.versionId }) }).catch(() => {});
const del = await api(cookie, `/rest/workflows/${wid}`, { method: 'DELETE' });
console.log('CLEANUP DELETE:', del.status);
