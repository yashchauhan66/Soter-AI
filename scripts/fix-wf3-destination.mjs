// scripts/fix-wf3-destination.mjs
const N8N_URL = 'http://localhost:5678';
const EMAIL = 'admin@soterai.in';
const PASSWORD = 'Soterai123!';

async function main() {
  const loginRes = await fetch(`${N8N_URL}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD })
  });
  const cookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie()[0] : loginRes.headers.get('set-cookie');
  
  for (const id of ['yPo9aUdAAuDyxE82', 'pr7spuBgwmK94nGt']) {
    const res = await fetch(`${N8N_URL}/rest/workflows/${id}`, { headers: { Cookie: cookie.split(';')[0] } });
    const wf = (await res.json()).data;
    
    // 1. Update Parse node
    const parseNode = wf.nodes.find(n => n.name.includes('Parse Agent Output'));
    if (parseNode) {
      parseNode.parameters.jsCode = parseNode.parameters.jsCode.replace(
        "toolDestination: 'database'",
        "toolDestination: 'internal'"
      );
      console.log(`[${id}] Updated Parse Agent Output toolDestination to 'internal'`);
    }

    // 2. Update Soter Tool Call Check
    const gate = wf.nodes.find(n => n.name.includes('Refund Gate'));
    if (gate) {
      gate.parameters.toolDestination = 'internal';
      console.log(`[${id}] Updated Refund Gate toolDestination to 'internal'`);
    }

    // 3. Save
    const patchRes = await fetch(`${N8N_URL}/rest/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie.split(';')[0] },
      body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
    });
    const updated = await patchRes.json();
    
    // 4. Activate
    const actRes = await fetch(`${N8N_URL}/rest/workflows/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie.split(';')[0] },
      body: JSON.stringify({ versionId: updated.data.versionId })
    });
    console.log(`[${id}] Saved & Activated HTTP ${actRes.status}`);
  }
}

main().catch(console.error);
