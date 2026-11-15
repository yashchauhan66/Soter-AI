'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const { createHash } = require('node:crypto');
const { resolveRelease } = require('../packages/soterai-lite/scripts/release-artifact.cjs');
const { archive } = require('../tools/soterai-lite-packager/package.cjs');
const repo = path.resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function parseOsvBatch(payload, expectedCount) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!record(payload) || !Number.isSafeInteger(expectedCount) || expectedCount < 1
      || !Array.isArray(payload.results) || payload.results.length !== expectedCount) throw Error('Invalid OSV batch');
  return payload.results.map(item => {
    if (!record(item) || Object.hasOwn(item, 'next_page_token')
        && (typeof item.next_page_token !== 'string' || item.next_page_token.length !== 0)
        || Object.hasOwn(item, 'vulns') && !Array.isArray(item.vulns)) throw Error('Incomplete OSV component result');
    return (item.vulns ?? []).map(finding => {
      if (!record(finding) || typeof finding.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(finding.id)) throw Error('Invalid OSV finding');
      return finding.id;
    });
  });
}
async function main() {
  const [pointer, directory] = process.argv.slice(2); if (!pointer || !directory) throw Error();
  const output = path.resolve(repo, directory); if (!output.startsWith(repo + path.sep)) throw Error();
  const release = await resolveRelease({ repoRoot: repo, pointerPath: path.resolve(repo, pointer) });
  const bytes = await fs.readFile(path.join(repo, release.artifactPath));
  const entries = await archive(bytes), sbomBytes = entries.get('extension/SBOM.cdx.json'), sbom = JSON.parse(sbomBytes);
  const components = sbom.components.map(item => ({ name: item.name, version: item.version })).sort((a, b) => a.name.localeCompare(b.name));
  const publicPackages = new Set(['@babel/parser', 'jsonc-parser', 'yaml']);
  if (components.length !== 3 || components.some(item => !publicPackages.has(item.name) || !/^\d+\.\d+\.\d+$/.test(item.version)) || new Set(components.map(item => item.name)).size !== 3) throw Error();
  const body = Buffer.from(JSON.stringify({ queries: components.map(item => ({ package: { name: item.name, ecosystem: 'npm' }, version: item.version })) }));
  await fs.mkdir(output); await fs.writeFile(path.join(output, 'request.json'), body, { flag: 'wx' });
  const result = { schemaVersion: 1, status: 'LOOKUP_INCOMPLETE', artifactSha256: release.sha256, sbomSha256: sha(sbomBytes), components,
    authentication: false, endpoint: 'https://api.osv.dev/v1/querybatch', releaseReady: false };
  try {
    const response = await new Promise((resolve, reject) => {
      const request = https.request(result.endpoint, { method: 'POST', timeout: 12000, headers: { 'content-type': 'application/json', 'content-length': body.length } }, response => {
        const chunks = []; let size = 0;
        response.on('data', chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) response.destroy(Error()); else chunks.push(chunk); });
        response.on('error', reject);
        response.on('end', () => response.complete && response.statusCode === 200 ? resolve(Buffer.concat(chunks)) : reject(Error()));
      });
      request.on('timeout', () => request.destroy(Error())); request.on('error', reject); request.end(body);
    });
    const payload = JSON.parse(response);
    const advisories = parseOsvBatch(payload, components.length);
    await fs.writeFile(path.join(output, 'response.json'), response, { flag: 'wx' });
    result.advisories = advisories; result.advisoryCount = advisories.flat().length;
    result.status = result.advisoryCount ? 'SHIPPED_ADVISORIES_FOUND' : 'NO_KNOWN_SHIPPED_MATCHES'; result.responseSha256 = sha(response);
    if (sha(await fs.readFile(path.join(repo, release.artifactPath))) !== release.sha256) throw Error();
  } catch { result.status = 'LOOKUP_INCOMPLETE'; process.exitCode = 2; }
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
module.exports = { parseOsvBatch };
if (require.main === module) main().catch(() => { console.error('Shipped advisory lookup incomplete.'); process.exitCode = 2; });
