const BASE = 'http://localhost:5678';
export const SOTER_CRED = { id: 'x3vattjpwqEVrl2j', name: 'SoterAI account' };
export const GROQ_CRED = { id: 'XmUzUqvZQolaSspy', name: 'Groq account' };
export const WF_ID = 'zC0IhnQkfnj0gPlU';
export async function login() {
  const r = await fetch(`${BASE}/rest/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.in', password: 'Soterai123!' }),
  });
  const cookie = r.headers.get('set-cookie')?.split(';')[0] ?? '';
  console.log('LOGIN', r.status);
  return cookie;
}
export async function api(cookie, path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => null);
  return { status: r.status, data: j };
}
export const KB = [
  'kb-billing-001 | Update payment method & retry failed invoice: Go to Settings > Billing > Payment method, add a valid card, then click Pay now on the failed invoice. Invoices retry automatically every 24h for 3 days.',
  'kb-sso-002 | SSO / SAML login loop fix: Clear IdP stale session, re-check ACS URL https://app.example.com/sso/callback, Entity ID app-example, and clock skew under 60s. Then retry in incognito.',
  'kb-api-003 | API 401/403 troubleshooting: 401 means expired or revoked key — rotate in Settings > API keys. 403 means missing scope — add the required scope and retry. Never paste secret keys in chat.',
  'kb-export-004 | CSV export limits: Exports cap at 100k rows per file. Narrow the date range or split by workspace.',
  'kb-refund-005 | Refund policy: Refunds go to the original payment method within 5-10 business days after approval. Only billing admins can approve refunds.',
].join('\n');
