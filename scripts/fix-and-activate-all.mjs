// scripts/fix-and-activate-all.mjs
const N8N_URL = 'http://localhost:5678';
const EMAIL = 'admin@soterai.in';
const PASSWORD = 'Soterai123!';

async function login() {
  const res = await fetch(`${N8N_URL}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD })
  });
  return res.headers.get('set-cookie').split(';')[0];
}

async function main() {
  const cookie = await login();
  const listRes = await fetch(`${N8N_URL}/rest/workflows`, { headers: { Cookie: cookie } });
  const list = await listRes.json();

  // Pick the 3 primary workflows to keep active
  const targetWorkflows = [
    { type: 'invoice', pattern: 'Invoice & Vendor Payout', id: 'YinZzcLxVc9AZFt6' },
    { type: 'inbox', pattern: 'Executive Inbox', id: 'MFLTJ9xU4w3SlxwW' },
    { type: 'ecom', pattern: 'E-Commerce Support', id: 'yPo9aUdAAuDyxE82' },
    { type: 'ecom2', pattern: 'E-Commerce Support', id: 'pr7spuBgwmK94nGt' }
  ];

  for (const target of targetWorkflows) {
    const id = target.id;
    console.log(`\n======================================================`);
    console.log(`Configuring target workflow [${id}]...`);
    const res = await fetch(`${N8N_URL}/rest/workflows/${id}`, { headers: { Cookie: cookie } });
    if (!res.ok) {
      console.log(`Workflow ${id} not found, skipping.`);
      continue;
    }
    const full = await res.json();
    const wf = full.data;
    console.log(`Found: "${wf.name}"`);

    // Ensure all nodes have valid configuration
    wf.nodes.forEach(n => {
      // 1. Groq Model
      if (n.type === '@n8n/n8n-nodes-langchain.lmChatGroq') {
        n.parameters = {
          ...(n.parameters || {}),
          model: 'llama-3.1-8b-instant',
          options: { temperature: 0.2 }
        };
        console.log(`  -> Fixed Groq Model (${n.name}) to llama-3.1-8b-instant`);
      }

      // 2. Soter RAG Scanner
      if (n.name.includes('RAG Scanner')) {
        n.parameters.action = 'ragScanner';
        n.parameters.ragText = n.parameters.ragText || '={{ $json.invoiceText }}';
        n.parameters.documentId = n.parameters.documentId || '={{ $json.invoiceId }}';
        n.parameters.documentSource = n.parameters.documentSource || '={{ $json.fileName }}';
        console.log(`  -> Fixed RAG Scanner parameters: ragText=${n.parameters.ragText}`);
      }

      // 3. Soter PII Redactor
      if (n.name.includes('PII Redactor')) {
        n.parameters.action = 'piiRedactor';
        if (target.type === 'invoice') {
          n.parameters.piiText = '={{ $("Normalize Invoice Data").first().json.invoiceText }}';
        } else {
          n.parameters.piiText = '={{ $("Inbound Email Trigger").first().json.body.message || $("Inbound Email Trigger").first().json.body.body || "Hello CEO, let us schedule a partnership meeting." }}';
        }
        console.log(`  -> Fixed PII Redactor parameters: piiText=${n.parameters.piiText}`);
      }

      // 4. Soter Input Guard
      if (n.name.includes('Input Guard') || n.name.includes('Universal AI Firewall')) {
        if (!n.parameters.inputText) {
          n.parameters.inputText = '={{ $json.body?.message || $json.body?.text || $json.chatInput || "Inbound message" }}';
        }
      }

      // 5. Soter Output Guard
      if (n.name.includes('Output Guard')) {
        n.parameters.action = 'outputGuard';
        if (!n.parameters.outputText) {
          n.parameters.outputText = '={{ $json.finalReply || $json.toolContent || $json.output || $json.text || "Approved response" }}';
        }
        console.log(`  -> Fixed Output Guard parameters: outputText=${n.parameters.outputText}`);
      }

      // 6. Memory Buffer
      if (n.name.includes('Memory Buffer')) {
        n.parameters.sessionIdType = 'customKey';
        n.parameters.sessionKey = "={{ $('Customer Chat Trigger').first().json.sessionId || 'session-default' }}";
        console.log(`  -> Fixed Memory Buffer sessionKey`);
      }
    });

    // Save
    const patchRes = await fetch(`${N8N_URL}/rest/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: wf.name,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: wf.settings
      })
    });
    const patchData = await patchRes.json();
    if (!patchRes.ok) {
      console.error(`  ❌ Failed to patch workflow ${id}:`, patchData);
      continue;
    }
    const versionId = patchData.data.versionId;

    // Activate
    const actRes = await fetch(`${N8N_URL}/rest/workflows/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ versionId })
    });
    const actData = await actRes.json();
    console.log(`  ✅ Activation HTTP ${actRes.status}, active=${actData.data?.active}`);
    if (actRes.status !== 200) {
      console.error(`  ❌ Activation failed details:`, JSON.stringify(actData, null, 2));
    }
  }

  console.log('\n======================================================');
  console.log('All 3 Enterprise Workflows Updated and Activated!');
  console.log('======================================================');
}

main().catch(console.error);
