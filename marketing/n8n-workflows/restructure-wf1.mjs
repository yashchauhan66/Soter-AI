import fs from 'fs';

const BASE = 'http://localhost:5678';
const WF_ID = '3gKe7FyN9sf7K8PI';

// ---- Login ----
const loginRes = await fetch(`${BASE}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }),
});
if (!loginRes.ok) {
  console.error('LOGIN FAILED:', loginRes.status, await loginRes.text());
  process.exit(1);
}
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] ?? '';
console.log('LOGIN OK');

const api = (path, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(opts.headers || {}) } })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

// ---- Fetch current workflow ----
const wfRes = await api(`/rest/workflows/${WF_ID}`);
if (wfRes.status !== 200) {
  console.error('FETCH FAILED:', wfRes.status, JSON.stringify(wfRes.data));
  process.exit(1);
}
const wf = wfRes.data.data;

// Find existing Soter credentials from input guard
const guardNode = wf.nodes.find((n) => n.name.includes('Soter Input Guard'));
const soterCreds = guardNode?.credentials ?? null;
console.log('SOTER CREDS FOUND:', JSON.stringify(soterCreds));

// ---- Build clean real-time chat workflow ----
// Layout: Chat Trigger -> Soter Input Guard -> Threat? -> [Blocked Respond] / [LLM -> Soter Output Guard -> Respond Success]
const positions = {
  chat: [-940, 300],
  guardIn: [-680, 300],
  threat: [-420, 300],
  blocked: [-140, 140],
  llm: [140, 460],
  model: [140, 660],
  guardOut: [420, 460],
  respond: [700, 460],
};

const find = (name) => wf.nodes.find((n) => n.name === name);

const chatTrigger = find('When chat message received');
const threatNode = find('Threat Detected?');
const guardIn = find('🛡️ Soter Input Guard');
const guardOut = find('🛡️ Soter Output Guard');
const respondBlocked = find('Respond (Blocked)');
const respondSuccess = find('Respond (Success)');
const model = find('OpenAI Chat Model');
const llmChain = find('Basic LLM Chain');

const nodes = [
  {
    ...chatTrigger,
    position: positions.chat,
    notes: '💬 Real-time chat entry point',
    notesInFlow: true,
  },
  {
    ...guardIn,
    position: positions.guardIn,
    credentials: soterCreds,
    parameters: {
      action: 'inputGuard',
      inputText: '={{ $json.chatInput }}',
      onThreat: 'BLOCK',
      metadata: '={"source": "soterai-security-chatbot", "mode": "realtime"}',
      advancedOptions: {},
    },
    notes: '🛡️ Blocks prompt injection, jailbreaks, PII before the LLM sees it',
    notesInFlow: true,
  },
  {
    ...threatNode,
    position: positions.threat,
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
    notes: '⚠️ Routes malicious messages away from the LLM',
    notesInFlow: true,
  },
  {
    ...respondBlocked,
    position: positions.blocked,
    parameters: {
      respondWith: 'text',
      respondBody:
        '🚫 Blocked by SoterAI Security: your message was flagged as a potential prompt injection / policy violation (score: {{ $json.threatScore ?? "n/a" }}).',
      options: {},
    },
    notes: '🚫 Friendly block message with threat reason',
    notesInFlow: true,
  },
  {
    ...llmChain,
    position: positions.llm,
    parameters: {
      ...llmChain.parameters,
      promptType: 'define',
      text: '={{ $json.sanitizedText ?? $json.chatInput }}',
    },
    notes: '🤖 Answers only sanitized, verified-safe messages',
    notesInFlow: true,
  },
  {
    ...model,
    position: positions.model,
    notes: '🔑 Set your OpenAI credential here',
    notesInFlow: true,
  },
  {
    ...guardOut,
    position: positions.guardOut,
    credentials: soterCreds,
    parameters: {
      action: 'outputGuard',
      outputText: '={{ $json.text }}',
      onThreat: 'REDACT',
      advancedOptions: {},
    },
    notes: '🛡️ Scans LLM output for secrets / PII / toxic content before replying',
    notesInFlow: true,
  },
  {
    ...respondSuccess,
    position: positions.respond,
    parameters: {
      respondWith: 'text',
      respondBody: '={{ $json.outputText }}',
      options: {},
    },
    notes: '✅ Final safe answer back to the user',
    notesInFlow: true,
  },
];

const connections = {
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
};

// Rename workflow
const payload = {
  name: '🛡️ SoterAI Security Chatbot (Real-Time)',
  nodes,
  connections,
  settings: wf.settings ?? { executionOrder: 'v1' },
};

const updateRes = await api(`/rest/workflows/${WF_ID}`, {
  method: 'PUT',
  body: JSON.stringify(payload),
});

console.log('UPDATE STATUS:', updateRes.status);
if (updateRes.status !== 200) {
  console.error('UPDATE FAILED:', JSON.stringify(updateRes.data).slice(0, 500));
  process.exit(1);
}
console.log('WORKFLOW UPDATED SUCCESSFULLY!');
console.log('Nodes:', nodes.map((n) => n.name).join(' | '));