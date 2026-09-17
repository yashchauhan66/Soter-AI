import { login, api, WF_ID } from './ultra-common.mjs';

const cookie = await login();
const wf = await api(cookie, `/rest/workflows/${WF_ID}`);
const d = wf.data.data;
console.log('=== CONNECTIONS ===');
console.log(JSON.stringify(d.connections, null, 1).slice(0, 4000));
console.log('\n=== NODE IDS (unique?) ===');
const ids = d.nodes.map((n) => n.id);
console.log('total:', ids.length, 'unique:', new Set(ids).size);
console.log('\n=== SWITCH FULL PARAMS ===');
const sw = d.nodes.find((n) => n.name === 'Intent Router');
console.log(JSON.stringify(sw.parameters, null, 1).slice(0, 2500));
