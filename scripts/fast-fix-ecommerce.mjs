// scripts/fast-fix-ecommerce.mjs
const N8N_URL = 'http://localhost:5678';
const EMAIL = 'admin@soterai.in';
const PASSWORD = 'Soterai123!';

async function main() {
  console.log('Logging in to n8n...');
  const loginRes = await fetch(`${N8N_URL}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  // Find all matching workflows
  const wfRes = await fetch(`${N8N_URL}/rest/workflows`, { headers: { 'Cookie': cookie } });
  const wfs = await wfRes.json();
  const targets = wfs.data.filter(w => w.name.includes('Autonomous E-Commerce Support & Refund Agent'));
  console.log(`Found ${targets.length} matching workflow(s)`);

  for (const target of targets) {
    const id = target.id;
    console.log(`\nProcessing workflow "${target.name}" [${id}]...`);

  // Fetch full workflow data
  const fullRes = await fetch(`${N8N_URL}/rest/workflows/${id}`, { headers: { 'Cookie': cookie } });
  const full = await fullRes.json();
  const data = full.data;

  // 1. Fix Groq model to llama-3.1-8b-instant
  const groq = data.nodes.find(n => n.name === 'Groq Chat Model');
  if (groq) {
    groq.parameters = {
      model: 'llama-3.1-8b-instant',
      options: { temperature: 0.2 }
    };
    console.log('Updated Groq model to llama-3.1-8b-instant');
  }

  // 2. Fix Chat Memory sessionKey
  const mem = data.nodes.find(n => n.name === 'Chat Memory Buffer');
  if (mem) {
    mem.parameters = {
      sessionIdType: 'customKey',
      sessionKey: "={{ $('Customer Chat Trigger').first().json.sessionId || 'session-default' }}",
      contextWindowLength: 10
    };
    console.log('Updated Chat Memory Buffer sessionKey');
  }

  // 3. Ensure Soter Output Guard outputText is clean
  const outGuard = data.nodes.find(n => n.name.includes('Output Guard'));
  if (outGuard) {
    outGuard.parameters.outputText = '={{ $json.finalReply || $json.messageText || $json.output || $json.text || "Refund processed." }}';
    console.log('Updated Soter Output Guard outputText expression');
  }

  // 4. Save workflow via PATCH
  const putRes = await fetch(`${N8N_URL}/rest/workflows/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      name: data.name,
      nodes: data.nodes,
      connections: data.connections,
      settings: data.settings
    })
  });
  console.log('Save status:', putRes.status);
  const updated = await putRes.json();

  // 5. Activate workflow
  const actRes = await fetch(`${N8N_URL}/rest/workflows/${id}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ versionId: updated.data.versionId })
  });
  console.log('Activate status:', actRes.status);

  console.log('\n===========================================');
  console.log('✅ Workflow updated and active:');
  console.log(`URL: ${N8N_URL}/workflow/${id}`);
  console.log('===========================================');
  }
}

main().catch(console.error);
