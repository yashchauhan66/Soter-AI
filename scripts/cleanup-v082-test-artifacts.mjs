/**
 * Cleanup #2: delete ONLY the temp workflows created by today's v0.8.2 test
 * session (soter-t4-*, soter-t5-*, soter-dbg-*, "(test copy)", "... dbg").
 * Older test workflows from previous sessions are deliberately left alone.
 */
const BASE = 'http://localhost:5678';
const KEEP_ID = 'ra1LSDqUJn1M4a5s';
let cookies = '';

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookies) headers['cookie'] = cookies;
  if (options.body && typeof options.body === 'object') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { ...options, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookies = setCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: { raw: text } }; }
}

let apiKey = null;
async function api(path, method = 'GET', body = null) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': apiKey, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: { raw: text.slice(0, 200) } }; }
}

async function main() {
  const login = await request('/rest/login', {
    method: 'POST',
    body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' },
  });
  if (login.status !== 200) throw new Error('login failed');

  const scopes = (await request('/rest/api-keys/scopes')).data.data;
  const wanted = ['workflow:delete'].filter(s => scopes.includes(s));
  const mk = await request('/rest/api-keys', {
    method: 'POST',
    body: { label: `soter-cleanup2-${Date.now()}`, expiresAt: null, scopes: wanted },
  });
  if (mk.status !== 200) throw new Error('key mint failed: ' + JSON.stringify(mk.data).slice(0, 200));
  apiKey = mk.data.data.rawApiKey;
  const keyId = mk.data.data.id;

  try {
    // Public API list returns 403 under project scoping — list via the
    // authenticated session instead, delete via the Public API (per-ID works).
    const list = await request('/rest/workflows?limit=250');
    console.log('Session list status:', list.status, '| count:', list.data?.data?.length ?? 'n/a');
    const strays = (list.data?.data || []).filter(w =>
      w.id !== KEEP_ID &&
      (w.name.startsWith('soter-t4-') || w.name.startsWith('soter-t5-') || w.name.startsWith('soter-dbg-') ||
        w.name.includes('(test copy)') || w.name.endsWith(' dbg')),
    );
    console.log(`Today's temp artifacts found: ${strays.length}`);
    let deleted = 0;
    for (const w of strays) {
      const d = await api(`/workflows/${w.id}`, 'DELETE');
      if (d.status === 200) { deleted++; console.log('  🗑️ ', w.id, w.name.slice(0, 60)); }
      else console.log('  ⚠️ delete failed:', w.id, d.status, JSON.stringify(d.data).slice(0, 100));
    }
    console.log(`\nDeleted ${deleted}/${strays.length}`);
  } finally {
    const del = await request(`/rest/api-keys/${keyId}`, { method: 'DELETE' });
    console.log(del.status === 200 ? '🧹 API key deleted' : '⚠️ key cleanup status ' + del.status);
  }
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
