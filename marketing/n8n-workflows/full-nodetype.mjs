const BASE = 'http://localhost:5678';
const l = await fetch(BASE + '/rest/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }) });
const c = l.headers.get('set-cookie').split(';')[0];
const H = { Cookie: c };
const full = async (name, v) => {
  const r = await fetch(BASE + `/rest/node-types/${encodeURIComponent(name)}?version=${v}`, { headers: H });
  const t = await r.text();
  console.log(name, 'v'+v, '->', r.status, 'len', t.length);
  return t;
};
// try node-types endpoint variants
for (const [n, v] of [
  ['@n8n/n8n-nodes-langchain.chatTrigger', '1.1'],
  ['@n8n/n8n-nodes-langchain.chat', '1'],
  ['@n8n/n8n-nodes-langchain.chainLlm', '1.4'],
  ['n8n-nodes-base.switch', '3.2'],
]) {
  try { const t = await full(n, v); console.log(t.slice(0, 800), '\n---'); } catch (e) { console.log('ERR', n, e.message); }
}
