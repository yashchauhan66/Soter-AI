import { request, loadState } from './helpers.mjs';
// Dump the full runData of the latest tcopy execution to find the real node-data shape.
const login = await request('/rest/login', { method: 'POST', body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' } });
console.log('login', login.status);
const ex = await request('/rest/executions?limit=3');
const list = (ex.data && ex.data.data && ex.data.data.results) || [];
console.log('latest:', list.map((e) => e.id + '/' + e.workflowName + '/' + e.status).join(' | '));
const id = list[0].id;
const full = await request('/rest/executions/' + id);
const d = full.data && full.data.data;
const rd = d && d.data && d.data.resultData && d.data.resultData.runData;
console.log('runData keys:', rd ? Object.keys(rd).join(', ') : 'NONE');
if (rd) {
  for (const k of Object.keys(rd)) {
    const entry = rd[k];
    console.log('---', k, 'tasks=', entry.length);
    for (let i = 0; i < entry.length; i++) {
      const t = entry[i];
      console.log('  task', i, 'execTime=', t.executionTime, 'source=', JSON.stringify((t.source || []).map((s) => s.previousNode)));
      const main = t.data && t.data.main;
      console.log('  outputs=', main ? main.length : 'none', main ? main.map((o) => (o ? o.length : 0)).join('/') : '');
      if (main) {
        for (let o = 0; o < main.length; o++) {
          const arr = main[o] || [];
          for (const item of arr.slice(0, 1)) {
            console.log('  out', o, 'json keys:', Object.keys(item.json || {}).join(','));
            console.log('  out', o, 'json:', JSON.stringify(item.json).slice(0, 800));
          }
        }
      }
    }
  }
}
