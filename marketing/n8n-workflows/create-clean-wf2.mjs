const BASE = 'http://localhost:5678';

const loginRes = await fetch(`${BASE}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }),
});
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] ?? '';
const api = (path, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(opts.headers || {}) } })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

const wf2 = {
  name: '🛡️ SoterAI Secure Autonomous Multi-Tool Agent',
  nodes: [
    { parameters: {}, id: 'wf2-001-manual', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-940, 300], notes: '🧪 Test: set task below', notesInFlow: true },
    {
      parameters: { values: { string: [{ name: 'task', value: 'Calculate 25 + 35' }] } },
      id: 'wf2-002-set',
      name: 'Set User Task',
      type: 'n8n-nodes-base.set',
      typeVersion: 2,
      position: [-680, 300],
      notes: '📝 Replace with your actual user task input',
      notesInFlow: true,
    },
    {
      parameters: { action: 'inputGuard', inputText: '={{ $json.task }}', onThreat: 'BLOCK', metadata: '={"source": "soterai-agent"}', advancedOptions: {} },
      id: 'wf2-003-guard',
      name: '🛡️ Soter Intent Guard',
      type: 'n8n-nodes-soterai.soterGuard',
      typeVersion: 1,
      position: [-420, 300],
      credentials: { soterApi: { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' } },
      notes: '🔒 Blocks malicious tasks / privilege escalation',
      notesInFlow: true,
    },
    {
      parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 }, conditions: [{ id: 'cond-1', leftValue: '={{ $json.blocked }}', rightValue: '', operator: { type: 'boolean', operation: 'isTrue' } }], combinator: 'and' }, options: {} },
      id: 'wf2-004-if',
      name: 'High Risk Action?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [-140, 300],
      notes: '⚠️ True = high risk path',
      notesInFlow: true,
    },
    {
      parameters: { method: 'POST', url: 'https://hooks.slack.com/services/REPLACE-ME', sendBody: true, specifyBody: 'json', jsonBody: '={ \"text\": \"⚠️ SOTERAI HELD A TASK FOR HUMAN REVIEW\", \"attachments\": [{ \"color\": \"warning\", \"text\": JSON.stringify($json, null, 2) }] }' },
      id: 'wf2-005-slack',
      name: 'Slack Approval Request',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [140, 140],
      notes: '📡 Replace webhook URL',
      notesInFlow: true,
    },
    {
      parameters: { operation: 'add', values: { number: [{ name: 'value1', value: '25' }, { name: 'value2', value: '35' }] } },
      id: 'wf2-006-calc',
      name: 'Example Tool: Calculator',
      type: 'n8n-nodes-base.calculator',
      typeVersion: 1,
      position: [140, 460],
      notes: '🧮 Replace with your tools: DB query, Email, API, etc!',
      notesInFlow: true,
    },
    {
      parameters: { action: 'outputGuard', outputText: '={{ JSON.stringify($json) }}', onThreat: 'REDACT', advancedOptions: {} },
      id: 'wf2-007-out',
      name: '🛡️ Soter Output Guard',
      type: 'n8n-nodes-soterai.soterGuard',
      typeVersion: 1,
      position: [420, 460],
      credentials: { soterApi: { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' } },
      notes: '🔒 Prevents leaks from tool output',
      notesInFlow: true,
    },
  ],
  connections: {
    'Manual Trigger': { main: [[{ node: 'Set User Task', type: 'main', index: 0 }]] },
    'Set User Task': { main: [[{ node: '🛡️ Soter Intent Guard', type: 'main', index: 0 }]] },
    '🛡️ Soter Intent Guard': { main: [[{ node: 'High Risk Action?', type: 'main', index: 0 }]] },
    'High Risk Action?': { main: [[{ node: 'Slack Approval Request', type: 'main', index: 0 }], [{ node: 'Example Tool: Calculator', type: 'main', index: 0 }]] },
    'Example Tool: Calculator': { main: [[{ node: '🛡️ Soter Output Guard', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
};

const create = await api('/rest/workflows', { method: 'POST', body: JSON.stringify(wf2) });
console.log('WF2 CREATED:', create.status, create.data?.data?.id);