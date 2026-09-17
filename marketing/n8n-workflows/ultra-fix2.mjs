import { login, api, WF_ID } from './ultra-common.mjs';
import fs from 'node:fs';

const cookie = await login();
const cur = await api(cookie, `/rest/workflows/${WF_ID}`);
const d = cur.data.data;
const byName = Object.fromEntries(d.nodes.map((n) => [n.name, n]));

// 1. Respond (Blocked): leading "=" हटाओ — plain text + {{ }} placeholders
byName['Respond (Blocked)'].parameters.message =
  'Blocked by SoterAI Security. Your message looked like a prompt-injection or policy violation, so it was stopped before the AI agent. Verdict: {{ $json.verdictCode ?? "CONTENT_BLOCKED" }} | Risk: {{ $json.riskLevel ?? "n/a" }}. Please rephrase your support question.';

// 2. Respond (Success): pure expression
byName['Respond (Success)'].parameters.message = '={{ $json.outputText }}';

// 3. PII Redactor: safeText खाली हो तो chatInput fallback
byName['PII Redactor'].parameters.piiText = '={{ $json.safeText ?? $json.chatInput ?? $json.text }}';

// 4. Normalize Request: session-safe version
byName['Normalize Request'].parameters.jsCode =
  "const chat=$('When chat message received').first().json;const guard=$('Soter Input Guard').first().json;const pii=$input.first().json;const clean=pii.safeText??pii.redactedText??pii.outputText??guard.safeText??chat.chatInput??'';return [{json:{sessionId:chat.sessionId??guard.sessionId??pii.sessionId??null,chatInput:chat.chatInput??'',safeText:guard.safeText??chat.chatInput??'',cleanText:clean,verdictCode:guard.verdictCode??null,riskLevel:guard.riskLevel??null}}];";

// 5. Bug ticket: sessionId Normalize से लो (LLM output में नहीं होता)
byName['Create Bug Ticket'].parameters.jsCode =
  "const item=$input.first().json;const t=item.text??item.output??'';const sev=/P1/i.test(t)?'P1':/P2/i.test(t)?'P2':'P3';const id='BUG-'+Math.floor(1000+Math.random()*9000);const sess=$('Normalize Request').first().json.sessionId??item.sessionId??null;return [{json:{text:'Thanks - filed '+id+' (severity '+sev+'). '+String(t).slice(0,900),sessionId:sess}}];";

// 6. Handoff ticket: same session fix
byName['Create Handoff Ticket'].parameters.jsCode =
  "const item=$input.first().json;const t=item.text??item.output??'Thanks - a human will reply within 4 business hours.';const id='HLP-'+Math.floor(1000+Math.random()*9000);const sess=$('Normalize Request').first().json.sessionId??item.sessionId??null;return [{json:{text:String(t).slice(0,900)+' Ticket: '+id,sessionId:sess}}];";

// 7. Output Guard: sessionId fallback via Normalize node
byName['Soter Output Guard'].parameters.sessionId =
  "={{ $json.sessionId ?? $('Normalize Request').first().json.sessionId }}";

const patchBody = {
  versionId: d.versionId,
  name: 'SoterAI Security Chatbot (Real-Time)',
  nodes: d.nodes,
  connections: d.connections,
  settings: { executionOrder: 'v1' },
  staticData: null,
  pinData: {},
};
const upd = await api(cookie, `/rest/workflows/${WF_ID}`, { method: 'PATCH', body: JSON.stringify(patchBody) });
console.log('PATCH', upd.status);
if (upd.status !== 200) { console.log(JSON.stringify(upd.data).slice(0, 2000)); process.exit(1); }
const act = await api(cookie, `/rest/workflows/${WF_ID}/activate`, { method: 'POST', body: JSON.stringify({ versionId: upd.data.data.versionId }) });
console.log('ACTIVATE', act.status);
fs.writeFileSync('marketing/n8n-workflows/03-ultra-pro-saas-helpdesk.json', JSON.stringify({ name: 'SoterAI Guardrails for SaaS Support — Prompt-Injection & PII Shield (Groq + SoterAI)', nodes: d.nodes, connections: d.connections }, null, 2));
console.log('SAVED + DEPLOYED http://localhost:5678/workflow/' + WF_ID);
