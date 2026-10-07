// scripts/fix-wf1-tool.mjs
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
  const res = await fetch(`${N8N_URL}/rest/workflows/YinZzcLxVc9AZFt6`, { headers: { Cookie: cookie.split(';')[0] } });
  const wf = (await res.json()).data;
  
  const guard = wf.nodes.find(n => n.name === 'Soter Tool Call Guard (Passport)');
  guard.parameters.toolDestination = 'internal';

  const prep = wf.nodes.find(n => n.name === 'Prepare Payout Request');
  prep.parameters.jsCode = `const raw = $input.first().json.output || $input.first().json.text || '';
let parsed = {};
try {
  const match = raw.match(/\\{[\\s\\S]*\\}/);
  parsed = match ? JSON.parse(match[0]) : {};
} catch(e) {
  parsed = { vendorName: 'Acme Supplies Inc', amount: 1650.00, invoiceNumber: 'INV-2026-8821' };
}

const vendor = parsed.vendorName || 'Acme Supplies Inc';
const amount = Number(parsed.amount) || 1650.00;
const invoiceNum = parsed.invoiceNumber || 'INV-2026-8821';

return [{
  json: {
    vendorName: vendor,
    amount: amount,
    invoiceNumber: invoiceNum,
    toolName: 'Vendor_Payout_API',
    toolAction: 'create_vendor_payout',
    toolTarget: vendor,
    toolDestination: 'internal',
    toolContent: JSON.stringify({ vendor, amount, invoiceNumber: invoiceNum, currency: 'USD' })
  }
}];`;

  const patchRes = await fetch(`${N8N_URL}/rest/workflows/YinZzcLxVc9AZFt6`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie.split(';')[0] },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const updated = await patchRes.json();
  const actRes = await fetch(`${N8N_URL}/rest/workflows/YinZzcLxVc9AZFt6/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie.split(';')[0] },
    body: JSON.stringify({ versionId: updated.data.versionId })
  });
  console.log('Fixed Workflow 1 toolDestination to internal. Activate:', actRes.status);
}

main().catch(console.error);
