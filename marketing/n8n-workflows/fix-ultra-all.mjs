import { login, api } from './ultra-common.mjs';
const WF = 'tPx0UyZaEqcay8cA';
const cookie = await login();
const wf = await api(cookie, `/rest/workflows/${WF}`);
const d = wf.data.data;

const normCode = `const items = $input.all();
const out = [];
for (const item of items) {
  const chat = $('When chat message received').all()[0]?.json ?? {};
  const guard = $('Soter Input Guard').all()[0]?.json ?? {};
  const pii = item.json ?? {};
  const clean = pii.safeText ?? pii.redactedText ?? pii.outputText ?? guard.safeText ?? chat.chatInput ?? '';
  out.push({ json: {
    sessionId: chat.sessionId ?? null,
    chatInput: chat.chatInput ?? '',
    safeText: guard.safeText ?? chat.chatInput ?? '',
    cleanText: clean,
    verdictCode: guard.verdictCode ?? null,
    riskLevel: guard.riskLevel ?? null,
  }});
}
return out;`;

const incidentCode = `const items = $input.all();
const chat = $('When chat message received').all()[0]?.json ?? {};
return items.map((item) => {
  const g = item.json ?? {};
  return { json: {
    event: 'soter_block',
    sessionId: chat.sessionId ?? null,
    chatInput: chat.chatInput ?? null,
    verdictCode: g.verdictCode ?? null,
    riskLevel: g.riskLevel ?? null,
    riskScore: g.riskScore ?? null,
    timestamp: new Date().toISOString(),
  }};
});`;

const bugCode = `const items = $input.all();
const norm = $('Normalize Request').all()[0]?.json ?? {};
return items.map((item) => {
  const t = item.json?.text ?? item.json?.output ?? '';
  const sev = /P1/i.test(t) ? 'P1' : /P2/i.test(t) ? 'P2' : 'P3';
  const id = 'BUG-' + Math.floor(1000 + Math.random() * 9000);
  return { json: { text: 'Thanks - filed ' + id + ' (severity ' + sev + '). Summary: ' + String(t).slice(0, 900) + ' Ticket: ' + id, sessionId: norm.sessionId ?? null } };
});`;

const handoffCode = `const items = $input.all();
const norm = $('Normalize Request').all()[0]?.json ?? {};
return items.map((item) => {
  const t = item.json?.text ?? item.json?.output ?? 'Thanks - a human will reply within 4 business hours.';
  const id = 'HLP-' + Math.floor(1000 + Math.random() * 9000);
  return { json: { text: String(t).slice(0, 900) + ' Ticket: ' + id, sessionId: norm.sessionId ?? null } };
});`;

for (const n of d.nodes) {
  if (n.name === 'When chat message received') {
    n.parameters = { responseMode: 'responseNode', webhookId: 'soter-ultra-helpdesk', options: {} };
  }
  if (n.name === 'Normalize Request') { n.parameters.mode = 'runOnceForAllItems'; n.parameters.jsCode = normCode; }
  if (n.name === 'Security Incident Log') { n.parameters.mode = 'runOnceForAllItems'; n.parameters.jsCode = incidentCode; }
  if (n.name === 'Create Bug Ticket') { n.parameters.mode = 'runOnceForAllItems'; n.parameters.jsCode = bugCode; }
  if (n.name === 'Create Handoff Ticket') { n.parameters.mode = 'runOnceForAllItems'; n.parameters.jsCode = handoffCode; }
  if (n.name === 'Intent Router') {
    n.typeVersion = 3.2;
    n.parameters = {
      rules: { values: [
        { operation: 'regex', value2: '(?i)(bug|error|crash|broken|not working|500|stack ?trace|fails?|exception)', outputKey: 'bug' },
        { operation: 'regex', value2: '(?i)(human|real person|agent|someone from support|call me|escalate)', outputKey: 'human' },
      ]},
      options: { fallbackOutput: 'general', renameFallbackOutput: 'general' },
      mode: 'expression',
      inputField: '={{ $json.cleanText }}',
    };
  }
}

const body = { versionId: d.versionId, name: 'Ultra-Pro SaaS Helpdesk — SoterAI Guarded Support', nodes: d.nodes, connections: d.connections, settings: { executionOrder: 'v1' }, staticData: null, pinData: {} };
const upd = await api(cookie, `/rest/workflows/${WF}`, { method: 'PATCH', body: JSON.stringify(body) });
console.log('PATCH', upd.status);
if (upd.status !== 200) console.log(JSON.stringify(upd.data).slice(0, 2000));
else console.log('NEW NAME:', upd.data?.data?.name);
