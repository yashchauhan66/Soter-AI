import { request } from './helpers.mjs';
import { parse } from 'flatted';
const relog = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
console.log('login', relog.status);
const one = await request('/rest/executions/243');
const parsed = parse(one.data.data.data);
const root = Array.isArray(parsed) ? parsed.find((x) => x && x.resultData) : parsed;
const g = root.resultData.runData['Guard Input for Threats'][0].data.main[1][0].json;
console.log('FULL guard json keys:', Object.keys(g).join(','));
console.log(JSON.stringify(g, null, 1).slice(0, 2500));

