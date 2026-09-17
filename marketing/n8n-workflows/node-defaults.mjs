import fs from 'node:fs';
const BASE = 'http://localhost:5678';
const l = await fetch(BASE + '/rest/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }) });
const c = l.headers.get('set-cookie').split(';')[0];
const r = await fetch(BASE + '/types/nodes.json', { headers: { Cookie: c } });
const all = await r.json();
const show = (name) => {
  const n = all.find((x) => x.name === name);
  if (!n) { console.log('NOT FOUND', name); return; }
  console.log('====', name, 'versions:', JSON.stringify(n.version));
  console.log('defaults:', JSON.stringify(n.defaults ?? null).slice(0, 600));
  const props = (n.properties ?? []).map((p) => `${p.name} [${p.type}${p.default !== undefined ? ' dflt=' + JSON.stringify(p.default) : ''}]`);
  console.log('props:\n  ' + props.slice(0, 60).join('\n  '));
};
show('@n8n/n8n-nodes-langchain.chatTrigger');
show('@n8n/n8n-nodes-langchain.chat');
show('@n8n/n8n-nodes-langchain.lmChatGroq');
