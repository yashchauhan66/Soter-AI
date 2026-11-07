const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifyBuild() {
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'dist/build-receipt.json'), 'utf8'));
  if (receipt.runtimeCount !== 3 || receipt.inventory.length !== 3) throw new Error('Incomplete build receipt');
  if (sha(path.join(root, 'package.json')) !== receipt.manifestSha256) throw new Error('Manifest/build mismatch');
  const expected = new Set(['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js']);
  for (const item of receipt.inventory) {
    if (!expected.delete(item.name) || sha(path.join(root, 'dist', item.name)) !== item.sha256) throw new Error('Runtime/build mismatch');
  }
  if (expected.size) throw new Error('Missing runtime');
  const attempt = path.resolve(root, receipt.attempt);
  if (!attempt.startsWith(path.join(root, 'builds') + path.sep)) throw new Error('Build attempt outside package');
  if (sha(path.join(attempt, 'package.json')) !== receipt.manifestSha256) throw new Error('Attempt manifest mismatch');
  for (const item of receipt.inventory) if (sha(path.join(attempt, 'dist', item.name)) !== item.sha256) throw new Error('Attempt/runtime mismatch');
  return { receipt, attempt };
}
module.exports = { verifyBuild };
if (require.main === module) {
  try { const {receipt} = verifyBuild(); console.log(JSON.stringify({status:'PASS',runId:receipt.runId,verifiedBundles:3})); }
  catch (error) { console.error(error); process.exitCode=1; }
}
