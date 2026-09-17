import { login, api, WF_ID, SOTER_CRED, GROQ_CRED, KB } from './ultra-common.mjs';
import { buildA } from './ultra-nodes-a.mjs';
import { buildB } from './ultra-nodes-b.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
const uid = () => crypto.randomUUID();
const cookie = await login();
const A = buildA(uid, SOTER_CRED);
const B = buildB(uid, GROQ_CRED, SOTER_CRED, KB);
const nodes = [A.nChat, A.nInputGuard, A.nIncident, A.nBlocked, A.nPii, A.nNorm, B.nRouter, B.nGroq, B.nLlmG, B.nLlmB, B.nTicket, B.nLlmH, B.nHandoff, B.nOut, B.nOk, B.nSticky];
const C = (node, type = 'main', index = 0) => ({ node, type, index });
const connections = {
  'When chat message received': { main: [[C('Soter Input Guard')]] },
  'Soter Input Guard': { main: [[C('PII Redactor')], [C('Security Incident Log')]] },
  'Security Incident Log': { main: [[C('Respond (Blocked)')]] },
  'PII Redactor': { main: [[C('Normalize Request')]] },
  'Normalize Request': { main: [[C('Intent Router')]] },
  'Intent Router': { main: [[C('Bug Triage LLM')], [C('Handoff Reply LLM')], [C('KB Answer LLM')]] },
  'Groq Chat Model': { ai_languageModel: [[C('KB Answer LLM', 'ai_languageModel'), C('Bug Triage LLM', 'ai_languageModel'), C('Handoff Reply LLM', 'ai_languageModel')]] },
  'KB Answer LLM': { main: [[C('Soter Output Guard')]] },
  'Bug Triage LLM': { main: [[C('Create Bug Ticket')]] },
  'Create Bug Ticket': { main: [[C('Soter Output Guard')]] },
  'Handoff Reply LLM': { main: [[C('Create Handoff Ticket')]] },
  'Create Handoff Ticket': { main: [[C('Soter Output Guard')]] },
  'Soter Output Guard': { main: [[C('Respond (Success)')]] },
};
const cur = await api(cookie, `/rest/workflows/${WF_ID}`);
console.log('FETCH', cur.status);
const patchBody = { versionId: cur.data.data.versionId, name: 'SoterAI Security Chatbot (Real-Time)', nodes, connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} };
const upd = await api(cookie, `/rest/workflows/${WF_ID}`, { method: 'PATCH', body: JSON.stringify(patchBody) });
console.log('PATCH', upd.status);
if (upd.status !== 200) { console.log(JSON.stringify(upd.data).slice(0, 3000)); process.exit(1); }
const act = await api(cookie, `/rest/workflows/${WF_ID}/activate`, { method: 'POST', body: JSON.stringify({ versionId: upd.data.data.versionId }) });
console.log('ACTIVATE', act.status);
fs.writeFileSync('marketing/n8n-workflows/03-ultra-pro-saas-helpdesk.json', JSON.stringify({ name: 'Ultra-Pro SaaS Helpdesk (SoterAI + Groq)', nodes, connections }, null, 2));
console.log('DEPLOYED http://localhost:5678/workflow/' + WF_ID);
