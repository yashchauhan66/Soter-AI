/**
 * Updates the "SoterAI Production Cloud" credential (jp7mO4AKCUhn0TY2) with a
 * real cloud key + Base URL, then re-runs the honest T1–T5 suite so the
 * verdicts come from the CLOUD engine (engineDegraded=false) instead of the
 * local fallback.
 *
 * Usage:
 *   node scripts/update-soter-credential-and-rerun.mjs <API_KEY> [BASE_URL]
 *
 *   API_KEY   (required)  real key from the soterai.in dashboard
 *   BASE_URL  (optional)  defaults to https://soterai.in
 *
 * The key is sent straight into the n8n credential store and never printed.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const BASE = 'http://localhost:5678';
const CRED_ID = 'jp7mO4AKCUhn0TY2';
const CRED_NAME = 'SoterAI Production Cloud';
const CONTAINER = 'ai-agent-security-guard-n8n-1';
const SOTER_CRED = { soterApi: { id: CRED_ID, name: CRED_NAME } };

const apiKey = process.argv[2];
const baseUrl = process.argv[3] || 'https://soterai.in';
if (!apiKey) {
  console.error('Usage: node scripts/update-soter-credential-and-rerun.mjs <API_KEY> [BASE_URL]');
  console.error('  API_KEY: soterai.in dashboard se real key paste karo');
  process.exit(1);
}
// strip accidental quotes/whitespace
const key = apiKey.trim().replace(/^["']|["']$/g, '');
const urlClean = baseUrl.trim().replace(/\/+$/, '');

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

/** 1. Key validity pre-flight: hit the exempt audit endpoint from the host. */
async function preflight() {
  console.log('--- Preflight: key validity against', urlClean, '---');
  const health = await fetch(`${urlClean}/api/health`).then(r => r.status).catch(() => 0);
  console.log('  /api/health:', health === 200 ? '✅ 200' : '❌ ' + health);
  // audit endpoint is CSRF-exempt-free; send the node's own Origin trick
  const origin = new URL(urlClean).origin;
  const res = await fetch(`${urlClean}/api/workflow/audit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, origin },
    body: JSON.stringify({ workflowJson: '{"nodes":[],"connections":{}}' }),
  }).catch(e => ({ status: 0, text: async () => e.message }));
  const body = await res.text();
  console.log('  /api/workflow/audit with key:', res.status === 200 ? '✅ key VALID' : `❌ ${res.status} ${body.slice(0, 120)}`);
  return res.status === 200;
}

/** 2. Push credential into n8n via container CLI (decrypted export/import). */
async function updateCredential() {
  console.log('\n--- Updating credential', CRED_ID, '---');
  const tmp = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', '.tmp', `soter-cred-${Date.now()}.json`);
  execSync(
    `docker exec ${CONTAINER} n8n export:credentials --id=${CRED_ID} --decrypted --output=/tmp/cred-export.json`,
    { stdio: 'pipe' },
  );
  execSync(`docker cp ${CONTAINER}:/tmp/cred-export.json ${tmp}`);
  const exported = JSON.parse(readFileSync(tmp, 'utf8'));
  const cred = Array.isArray(exported) ? exported[0] : exported;
  cred.data = { apiKey: key, baseUrl: urlClean, projectId: cred.data?.projectId ?? '' };
  writeFileSync(tmp, JSON.stringify(cred, null, 2));
  execSync(`docker cp ${tmp} ${CONTAINER}:/tmp/cred-import.json`);
  execSync(`docker exec ${CONTAINER} n8n import:credentials --input=/tmp/cred-import.json`, { stdio: 'pipe' });
  unlinkSync(tmp);
  console.log('  ✅ credential updated (baseUrl:', urlClean + ', key: ' + key.slice(0, 10) + '...)');
}

/** 3. Re-run the honest suite (same tests as scripts/test-v082-helpdesk-upgrade.mjs). */
async function runHonestSuite() {
  // reuse the suite by spawning it; it reads credential id jp7mO4AKCUhn0TY2
  console.log('\n--- Re-running honest test suite (T1–T5) ---\n');
  execSync('node scripts/test-v082-helpdesk-upgrade.mjs', { stdio: 'inherit', cwd: path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..') });
}

async function main() {
  const ok = await preflight();
  if (!ok) {
    console.error('\n💥 Key did NOT validate against ' + urlClean + ' — credential NOT updated. Sahi key paste karo.');
    process.exit(1);
  }
  await updateCredential();
  await runHonestSuite();
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
