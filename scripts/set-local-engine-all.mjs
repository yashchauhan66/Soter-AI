// scripts/set-local-engine-all.mjs
const N8N_URL = 'http://localhost:5678';
const EMAIL = 'admin@soterai.in';
const PASSWORD = 'Soterai123!';

async function login() {
  const res = await fetch(`${N8N_URL}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD })
  });
  const cookie = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie');
  return cookie.split(';')[0];
}

async function main() {
  const cookie = await login();

  const targetWorkflows = [
    { type: 'invoice', id: 'YinZzcLxVc9AZFt6', name: 'FinTech Invoice Agent' },
    { type: 'inbox', id: 'MFLTJ9xU4w3SlxwW', name: 'Safe Executive Inbox' },
    { type: 'ecom', id: 'yPo9aUdAAuDyxE82', name: 'E-Commerce Refund Agent' }
  ];

  for (const target of targetWorkflows) {
    const res = await fetch(`${N8N_URL}/rest/workflows/${target.id}`, { headers: { Cookie: cookie } });
    const full = await res.json();
    const wf = full.data;

    wf.nodes.forEach(n => {
      // Set detectionEngine to LOCAL for all soter nodes
      if (n.type === 'n8n-nodes-soterai.soterGuard') {
        n.parameters.detectionEngine = 'LOCAL';
        console.log(`  [${target.name}] Set LOCAL engine on ${n.name}`);
      }
      // Groq Model
      if (n.type === '@n8n/n8n-nodes-langchain.lmChatGroq') {
        n.parameters.model = 'openai/gpt-oss-20b';
      }
    });

    const patchRes = await fetch(`${N8N_URL}/rest/workflows/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
    });
    const updated = await patchRes.json();
    const actRes = await fetch(`${N8N_URL}/rest/workflows/${target.id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ versionId: updated.data.versionId })
    });
    console.log(`  [${target.name}] Activated HTTP ${actRes.status}`);
  }
}

main().catch(console.error);
