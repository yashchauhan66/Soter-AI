import { login, api, WF_ID, SOTER_CRED, GROQ_CRED, KB } from './ultra-common.mjs';
import { buildA } from './ultra-nodes-a.mjs';
import { buildB } from './ultra-nodes-b.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';

const uid = () => crypto.randomUUID();
const cookie = await login();

// --- reusable chain: same nodes, but Manual Trigger instead of Chat Trigger, chat replies as Set ---
const A = buildA(uid, SOTER_CRED);
const B = buildB(uid, GROQ_CRED, SOTER_CRED, KB);

const testInput = process.argv[2] || 'My invoice failed, how do I update my payment method?';
const testSession = process.argv[3] || 'ui-safe-1';

const nStart = { id: uid(), name: 'Test Input', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [-1700, 300], parameters: { assignments: { assignments: [{ id: uid(), name: 'chatInput', type: 'string', value: testInput }, { id: uid(), name: 'sessionId', type: 'string', value: testSession }] }, options: {} } };

A.nInputGuard.parameters.inputText = '={{ $json.chatInput }}';
A.nInputGuard.parameters.sessionId = '={{ $json.sessionId }}';
A.nIncident.parameters.jsCode = "const g=$input.first().json;const c=$('Test Input').first().json;return [{json:{event:'soter_block',sessionId:c.sessionId??null,chatInput:c.chatInput??null,verdictCode:g.verdictCode??null,riskLevel:g.riskLevel??null,riskScore:g.riskScore??null,timestamp:new Date().toISOString()}}];";
A.nBlocked = { id: uid(), name: 'Blocked Reply', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [-980, 60], parameters: { assignments: { assignments: [{ id: uid(), name: 'reply', type: 'string', value: '=Blocked by SoterAI Security. Verdict: {{ $json.verdictCode }} | Risk: {{ $json.riskLevel }}. Please rephrase your support question.' }] }, options: {} } };
A.nNorm.parameters.jsCode = "const chat=$('Test Input').first().json;const guard=$('Soter Input Guard').first().json;const pii=$input.first().json;const clean=pii.safeText??pii.redactedText??pii.outputText??guard.safeText??chat.chatInput;return [{json:{sessionId:chat.sessionId??null,chatInput:chat.chatInput??'',safeText:guard.safeText??chat.chatInput??'',cleanText:clean,verdictCode:guard.verdictCode??null,riskLevel:guard.riskLevel??null}}];";
B.nOut.parameters.sessionId = '={{ $json.sessionId }}';
B.nOk = { id: uid(), name: 'Final Reply', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [320, 300], parameters: { assignments: { assignments: [{ id: uid(), name: 'reply', type: 'string', value: '={{ $json.outputText }}' }, { id: uid(), name: 'sessionId', type: 'string', value: '={{ $json.sessionId }}' }] }, options: {} } };
B.nSticky.parameters.content = '## TEST HARNESS (same chain as live chat workflow)\nTest Input -> Input Guard -> PII Redactor -> Router -> Groq -> Output Guard.';
B.nSticky.position = [-1700, 40];

const nodes = [nStart, A.nInputGuard, A.nIncident, A.nBlocked, A.nPii, A.nNorm, B.nRouter, B.nGroq, B.nLlmG, B.nLlmB, B.nTicket, B.nLlmH, B.nHandoff, B.nOut, B.nOk, B.nSticky];
const C = (node, type = 'main', index = 0) => ({ node, type, index });
const connections = {
  'Test Input': { main: [[C('Soter Input Guard')]] },
  'Soter Input Guard': { main: [[C('PII Redactor')], [C('Security Incident Log')]] },
  'Security Incident Log': { main: [[C('Blocked Reply')]] },
  'PII Redactor': { main: [[C('Normalize Request')]] },
  'Normalize Request': { main: [[C('Intent Router')]] },
  'Intent Router': { main: [[C('Bug Triage LLM')], [C('Handoff Reply LLM')], [C('KB Answer LLM')]] },
  'Groq Chat Model': { ai_languageModel: [[C('KB Answer LLM', 'ai_languageModel'), C('Bug Triage LLM', 'ai_languageModel'), C('Handoff Reply LLM', 'ai_languageModel')]] },
  'KB Answer LLM': { main: [[C('Soter Output Guard')]] },
  'Bug Triage LLM': { main: [[C('Create Bug Ticket')]] },
  'Create Bug Ticket': { main: [[C('Soter Output Guard')]] },
  'Handoff Reply LLM': { main: [[C('Create Handoff Ticket')]] },
  'Create Handoff Ticket': { main: [[C('Soter Output Guard')]] },
  'Soter Output Guard': { main: [[C('Final Reply')]] },
};

// find or create test-harness workflow
const list = await api(cookie, '/rest/workflows?limit=100');
const arr = list.data?.data ?? [];
let harness = arr.find((w) => w.name === 'SoterAI Ultra TEST HARNESS (do not publish)');
let hid;
if (!harness) {
  const created = await api(cookie, '/rest/workflows', { method: 'POST', body: JSON.stringify({ name: 'SoterAI Ultra TEST HARNESS (do not publish)', nodes, connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} }) });
  console.log('CREATE', created.status);
  if (created.status !== 200 && created.status !== 201) { console.log(JSON.stringify(created.data).slice(0, 1500)); process.exit(1); }
  hid = created.data?.data?.id;
} else {
  hid = harness.id;
  const cur = await api(cookie, `/rest/workflows/${hid}`);
  const upd = await api(cookie, `/rest/workflows/${hid}`, { method: 'PATCH', body: JSON.stringify({ versionId: cur.data.data.versionId, name: 'SoterAI Ultra TEST HARNESS (do not publish)', nodes, connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} }) });
  console.log('PATCH', upd.status);
  if (upd.status !== 200) { console.log(JSON.stringify(upd.data).slice(0, 2000)); process.exit(1); }
}
console.log('HARNESS http://localhost:5678/workflow/' + hid);

// execute it
const cur2 = await api(cookie, `/rest/workflows/${hid}`);
const run = await api(cookie, `/rest/workflows/${hid}/run`, { method: 'POST', body: JSON.stringify({ versionId: cur2.data.data.versionId }) });
console.log('RUN', run.status, JSON.stringify(run.data).slice(0, 400));
