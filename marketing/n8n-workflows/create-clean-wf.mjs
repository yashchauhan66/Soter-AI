import fs from 'fs';

const BASE = 'http://localhost:5678';

const loginRes = await fetch(`${BASE}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }),
});
if (!loginRes.ok) {
  console.error('LOGIN FAILED:', loginRes.status);
  process.exit(1);
}
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] ?? '';
console.log('LOGIN OK');

const api = (path, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(opts.headers || {}) } })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

const wf = {
  name: '🛡️ SoterAI Security Chatbot (Real-Time)',
  nodes: [
    {
      parameters: {},
      id: 'a1f0c1e0-0001-4a10-9f01-soterchat00001',
      name: 'When chat message received',
      type: '@n8n/n8n-nodes-langchain.chatTrigger',
      typeVersion: 1.1,
      position: [-940, 300],
      webhookId: 'soterai-chat-trigger',
      notes: '💬 Real-time chat entry',
      notesInFlow: true,
    },
    {
      parameters: {
        action: 'inputGuard',
        inputText: '={{ $json.chatInput }}',
        onThreat: 'BLOCK',
        metadata: '={"source": "soterai-security-chatbot"}',
        advancedOptions: {},
      },
      id: 'a1f0c1e0-0002-4a10-9f01-soterchat00002',
      name: '🛡️ Soter Input Guard',
      type: 'n8n-nodes-soterai.soterGuard',
      typeVersion: 1,
      position: [-680, 300],
      credentials: { soterApi: { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' } },
      notes: '🛡️ Blocks prompt injection, jailbreaks, PII',
      notesInFlow: true,
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
          conditions: [
            {
              id: 'cond-blocked',
              leftValue: '={{ $json.blocked }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'isTrue' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'a1f0c1e0-0003-4a10-9f01-soterchat00003',
      name: 'Threat Detected?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [-420, 300],
      notes: '⚠️ True = blocked path, False = safe path',
      notesInFlow: true,
    },
    {
      parameters: {
        respondWith: 'text',
        respondBody:
          '🚫 Blocked by SoterAI Security: your message was flagged as a potential prompt injection / policy violation (threat score: {{ $json.threatScore ?? "n/a" }}).',
        options: {},
      },
      id: 'a1f0c1e0-0004-4a10-9f01-soterchat00004',
      name: 'Respond (Blocked)',
      type: '@n8n/n8n-nodes-langchain.chat',
      typeVersion: 1,
      position: [-140, 140],
      notes: '🚫 Friendly block message',
      notesInFlow: true,
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.sanitizedText ?? $json.chatInput }}',
      },
      id: 'a1f0c1e0-0005-4a10-9f01-soterchat00005',
      name: 'Basic LLM Chain',
      type: '@n8n/n8n-nodes-langchain.chainLlm',
      typeVersion: 1.4,
      position: [140, 460],
      notes: '🤖 Answers only sanitized safe messages',
      notesInFlow: true,
    },
    {
      parameters: {
        model: { __rl: true, value: 'gpt-4o', mode: 'list' },
        options: {},
      },
      id: 'a1f0c1e0-0006-4a10-9f01-soterchat00006',
      name: 'OpenAI Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1,
      position: [140, 660],
      notes: '🔑 Set your OpenAI credential here',
      notesInFlow: true,
    },
    {
      parameters: {
        action: 'outputGuard',
        outputText: '={{ $json.text }}',
        onThreat: 'REDACT',
        advancedOptions: {},
      },
      id: 'a1f0c1e0-0007-4a10-9f01-soterchat00007',
      name: '🛡️ Soter Output Guard',
      type: 'n8n-nodes-soterai.soterGuard',
      typeVersion: 1,
      position: [420, 460],
      credentials: { soterApi: { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' } },
      notes: '🛡️ Scans output for secrets / PII / toxic content',
      notesInFlow: true,
    },
    {
      parameters: {
        respondWith: 'text',
        respondBody: '={{ $json.outputText }}',
        options: {},
      },
      id: 'a1f0c1e0-0008-4a10-9f01-soterchat00008',
      name: 'Respond (Success)',
      type: '@n8n/n8n-nodes-langchain.chat',
      typeVersion: 1,
      position: [700, 460],
      notes: '✅ Final safe answer',
      notesInFlow: true,
    },
  ],
  connections: {
    'When chat message received': {
      main: [[{ node: '🛡️ Soter Input Guard', type: 'main', index: 0 }]],
    },
    '🛡️ Soter Input Guard': {
      main: [[{ node: 'Threat Detected?', type: 'main', index: 0 }]],
    },
    'Threat Detected?': {
      main: [
        [{ node: 'Respond (Blocked)', type: 'main', index: 0 }],
        [{ node: 'Basic LLM Chain', type: 'main', index: 0 }],
      ],
    },
    'OpenAI Chat Model': {
      ai_languageModel: [[{ node: 'Basic LLM Chain', type: 'ai_languageModel', index: 0 }]],
    },
    'Basic LLM Chain': {
      main: [[{ node: '🛡️ Soter Output Guard', type: 'main', index: 0 }]],
    },
    '🛡️ Soter Output Guard': {
      main: [[{ node: 'Respond (Success)', type: 'main', index: 0 }]],
    },
  },
  settings: { executionOrder: 'v1' },
};

const createRes = await api('/rest/workflows', { method: 'POST', body: JSON.stringify(wf) });
console.log('CREATE STATUS:', createRes.status);
if (createRes.status >= 400) {
  console.error('CREATE FAILED:', JSON.stringify(createRes.data).slice(0, 600));
  process.exit(1);
}
console.log('CREATED WORKFLOW ID:', createRes.data?.data?.id ?? createRes.data?.id);
console.log('NAME:', wf.name);