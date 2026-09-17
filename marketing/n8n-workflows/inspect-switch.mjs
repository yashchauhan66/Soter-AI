import { login } from './ultra-common.mjs';
const cookie = await login();
const r = await fetch('http://localhost:5678/types/nodes.json', { headers: { Cookie: cookie } });
const all = await r.json();
const sw = all.find((n) => n.name === 'n8n-nodes-base.switch');
console.log('switch maxVersion:', JSON.stringify(sw?.version));
const props = (sw?.properties ?? []).filter((p) => {
  const v = p.displayOptions?.show?.['@version'];
  return !v || (Array.isArray(v) && v.some((x) => Number(x) >= 3));
});
for (const p of props) {
  console.log('---', p.name, '| type:', p.type, '| default:', JSON.stringify(p.default));
  if (p.options) console.log('   options:', JSON.stringify(p.options).slice(0, 3000));
}