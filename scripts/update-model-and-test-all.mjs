// scripts/update-model-and-test-all.mjs
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
  console.log('=== Step 1: Logging in to n8n ===');
  const cookie = await login();

  const targetWorkflows = [
    { type: 'invoice', id: 'YinZzcLxVc9AZFt6', name: 'FinTech Invoice Agent' },
    { type: 'inbox', id: 'MFLTJ9xU4w3SlxwW', name: 'Safe Executive Inbox' },
    { type: 'ecom', id: 'yPo9aUdAAuDyxE82', name: 'E-Commerce Refund Agent' }
  ];

  console.log('\n=== Step 2: Updating All 3 Workflows to use model "openai/gpt-oss-20b" & RAG LOCAL engine ===');
  for (const target of targetWorkflows) {
    const res = await fetch(`${N8N_URL}/rest/workflows/${target.id}`, { headers: { Cookie: cookie } });
    const full = await res.json();
    const wf = full.data;

    wf.nodes.forEach(n => {
      // Groq Model
      if (n.type === '@n8n/n8n-nodes-langchain.lmChatGroq') {
        n.parameters = {
          ...(n.parameters || {}),
          model: 'openai/gpt-oss-20b',
          options: { temperature: 0.2 }
        };
        console.log(`  [${target.name}] Updated ${n.name} model to "openai/gpt-oss-20b"`);
      }
      // RAG Scanner LOCAL engine
      if (n.name.includes('RAG Scanner')) {
        n.parameters.detectionEngine = 'LOCAL';
        console.log(`  [${target.name}] Set ${n.name} detectionEngine=LOCAL`);
      }
      // Webhook responseMode
      if (n.type === 'n8n-nodes-base.webhook') {
        n.parameters.responseMode = 'responseNode';
      }
      // Output Guard
      if (n.name.includes('Output Guard')) {
        n.parameters.action = 'outputGuard';
        if (!n.parameters.outputText) {
          n.parameters.outputText = '={{ $json.finalReply || $json.toolContent || $json.output || $json.text || "Approved response" }}';
        }
      }
      // Memory Buffer
      if (n.name.includes('Memory Buffer')) {
        n.parameters.sessionIdType = 'customKey';
        n.parameters.sessionKey = "={{ $('Customer Chat Trigger').first().json.sessionId || 'session-default' }}";
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
    console.log(`  [${target.name}] Saved & Activated HTTP ${actRes.status}`);
  }

  console.log('\n=== Step 3: Executing Live Real-World Tests ===');

  // WORKFLOW 1 TEST
  console.log('\n>>> Testing Workflow 1: Invoice & Vendor Payout (/webhook/invoice-intake)...');
  const res1 = await fetch(`${N8N_URL}/webhook/invoice-intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceId: 'INV-2026-9042',
      fileName: 'acme_cloud_servers.pdf',
      invoiceText: `ACME CLOUD HOSTING LLC\nInvoice #: INV-2026-9042\nTotal Amount Due: $1,650.00\nPayment Terms: Net 15`
    })
  });
  console.log('Workflow 1 Response HTTP', res1.status, await res1.text());

  // WORKFLOW 2 TEST
  console.log('\n>>> Testing Workflow 2: Safe Executive Inbox (/webhook/inbox-sentinel)...');
  const res2 = await fetch(`${N8N_URL}/webhook/inbox-sentinel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: 'sarah.connor@enterprisepartners.com',
      subject: 'Partnership Inquiry for Q4',
      message: 'Hi CEO, I would love to set up a quick 15-minute call next Tuesday at 2:00 PM EST to discuss our joint integration.'
    })
  });
  console.log('Workflow 2 Response HTTP', res2.status, await res2.text());

  // Check executions
  console.log('\n=== Step 4: Inspecting Recent Execution Status ===');
  const exRes = await fetch(`${N8N_URL}/rest/executions?limit=3`, { headers: { Cookie: cookie } });
  const data = await exRes.json();
  const list = data.data.results || data.data;
  list.forEach(e => console.log('Execution ID:', e.id, 'Workflow:', e.workflowId, 'Status:', e.status));
}

main().catch(console.error);
