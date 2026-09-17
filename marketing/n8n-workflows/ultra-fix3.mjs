import { login, api, WF_ID } from './ultra-common.mjs';

const cookie = await login();

// --- 1. Switch fallback fix: renameFallbackOutput actually wants boolean|string? keep simple ---
let wf = await api(cookie, `/rest/workflows/${WF_ID}`);
let d = wf.data.data;
const sw = d.nodes.find((n) => n.name === 'Intent Router');
// Switch v3.x expression-mode had inputField; rules-mode uses per-condition leftValue — delete leftovers
delete sw.parameters.inputField;
delete sw.parameters.mode;
// fallback "general": keep rename but ensure explicit outputs count
sw.parameters.options = { fallbackOutput: 'extra', renameFallbackOutput: 'general' };

let patchBody = { versionId: d.versionId, name: d.name, nodes: d.nodes, connections: d.connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} };
let upd = await api(cookie, `/rest/workflows/${WF_ID}`, { method: 'PATCH', body: JSON.stringify(patchBody) });
console.log('PATCH switch-fix:', upd.status, upd.status !== 200 ? JSON.stringify(upd.data).slice(0, 1000) : 'ok');

// --- 2. deactivate → activate, capture REAL error ---
wf = await api(cookie, `/rest/workflows/${WF_ID}`);
d = wf.data.data;
console.log('deactivating...');
console.log('DEACT:', (await api(cookie, `/rest/workflows/${WF_ID}/deactivate`, { method: 'POST', body: JSON.stringify({ versionId: d.versionId }) })).status);
wf = await api(cookie, `/rest/workflows/${WF_ID}`);
d = wf.data.data;
const act = await api(cookie, `/rest/workflows/${WF_ID}/activate`, { method: 'POST', body: JSON.stringify({ versionId: d.versionId }) });
console.log('ACTIVATE:', act.status);
console.log(JSON.stringify(act.data).slice(0, 2500));

await new Promise((r) => setTimeout(r, 2000));
const t = await fetch('http://localhost:5678/webhook/soter-saas-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId: 't9', chatInput: 'hello' }) });
console.log('WEBHOOK TEST:', t.status, (await t.text()).slice(0, 300));
