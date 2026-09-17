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

const wfId = 'zC0IhnQkfnj0gPlU';

// Clean PERFECT workflow
const perfectWorkflow = {
  name: '🛡️ SoterAI Security Chatbot (REAL-TIME! Fixed!)',
  nodes: [
    {
      parameters: {},
      id: 'chat-trigger',
      name: 'When chat message received',
      type: '@n8n/n8n-nodes-langchain.chatTrigger',
      typeVersion: 1.1,
      position: [-940, 300],
      webhookId: 'soter-chat-1',
      notes: '💬 User types here',
      notesInFlow: true,
    },
    {
      parameters: {
        action: 'inputGuard',
        inputText: '={{ $json.chatInput }}',
        metadata: '={"source":"soterai-test"}',
        onThreat: 'BLOCK',
        advancedOptions: {},
      },
      id: 'soter-input',
      name: '🛡️ Soter Input Guard',
      type: 'n8n-nodes-soterai.soterGuard',
      typeVersion: 1,
      position: [-640, 300],
      credentials: { soterApi: { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' } },
      notes: '🚫 Blocks threats',
      notesInFlow: true,
    },
    {
      parameters: {
        respondWith: 'text',
        message: '🚫 BLOCKED BY SOTERAI SECURITY! Your message looks malicious (prompt injection/jailbreak detected!).',
        options: {},
      },
      id: 'respond-blocked',
      name: 'Respond (Blocked)',
      type: '@n8n/n8n-nodes-langchain.chat',
      typeVersion: 1,
      position: [-340, 100],
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.safeText ?? $json.chatInput }}',
      },
      id: 'llm-chain',
      name: 'Basic LLM Chain',
      type: '@n8n/n8n-nodes-langchain.chainLlm',
      typeVersion: 1.4,
      position: [-340, 500],
    },
    {
      parameters: {},
      id: 'groq-model',
      name: 'Groq Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [-340, 700],
      credentials: { groqApi: { id: 'XmUzUqvZQolaSspy', name: 'Groq account' } },
    },
    {
      parameters: {
        action: 'outputGuard',
        outputText: '={{ $json.text }}',
        onThreat: 'REDACT',
        advancedOptions: {},
      },
      id: 'soter-output',
      name: '🛡️ Soter Output Guard',
      type: 'n8n-nodes-soterai.soterGuard',
      typeVersion: 1,
      position: [60, 500],
      credentials: { soterApi: { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' } },
    },
    {
      parameters: {
        respondWith: 'text',
        message: '={{ $json.outputText }}',
        options: {},
      },
      id: 'respond-success',
      name: 'Respond (Success)',
      type: '@n8n/n8n-nodes-langchain.chat',
      typeVersion: 1,
      position: [360, 500],
    },
  ],
  connections: {
    'When chat message received': { main: [[{ node: '🛡️ Soter Input Guard', type: 'main', index: 0 }]] },
    '🛡️ Soter Input Guard': {
      main: [
        [{ node: 'Respond (Blocked)', type: 'main', index: 0 }],
        [{ node: 'Basic LLM Chain', type: 'main', index: 0 }],
      ],
    },
    'Basic LLM Chain': { main: [[{ node: '🛡️ Soter Output Guard', type: 'main', index: 0 }]] },
    '🛡️ Soter Output Guard': { main: [[{ node: 'Respond (Success)', type: 'main', index: 0 }]] },
    'Groq Chat Model': { ai_languageModel: [[{ node: 'Basic LLM Chain', type: 'ai_languageModel', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
};

// Upload the perfect workflow
const upd = await api(`/rest/workflows/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify(perfectWorkflow),
});
console.log('UPDATED:', upd.status);

// Get versionId and activate
const getWf = await api(`/rest/workflows/${wfId}`);
const activate = await api(`/rest/workflows/${wfId}/activate`, {
  method: 'POST',
  body: JSON.stringify({ versionId: getWf.data.data.versionId }),
});

console.log('ACTIVATED:', activate.status, activate.data);
console.log('✅ WORKFLOW IS READY FOR TESTING NOW!');
console.log('👉 URL: http://localhost:5678/workflow/' + wfId);