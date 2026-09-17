const BASE = 'http://localhost:5678';
const loginRes = await fetch(`${BASE}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }),
});
const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] ?? '';
const r = await fetch(`${BASE}/types/nodes.json`, { headers: { Cookie: cookie } });
const arr = await r.json();
import fs from 'node:fs';
const ct = arr.find((x) => x.name === '@n8n/n8n-nodes-langchain.chatTrigger');
const ch = arr.find((x) => x.name === '@n8n/n8n-nodes-langchain.chat');
fs.writeFileSync('marketing/n8n-workflows/ct-full.json', JSON.stringify(ct, null, 2));
fs.writeFileSync('marketing/n8n-workflows/chat-full.json', JSON.stringify(ch, null, 2));
console.log('saved both');
// print responseMode prop
for (const def of [ct, ch]) {
  const props = def.properties || [];
  const rm = props.filter((p) => JSON.stringify(p).toLowerCase().includes('responsemode') || p.name === 'responseMode');
  console.log('===', def.name, 'responseMode props:', JSON.stringify(rm, null, 2).slice(0, 3000));
}
// also list all prop names of chatTrigger
console.log('chatTrigger props:', (ct.properties || []).map((p) => p.name).join(','));
console.log('chat props:', (ch.properties || []).map((p) => p.name).join(','));
