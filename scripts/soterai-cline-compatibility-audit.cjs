'use strict';
// Inspect public vendor code only. No profile, account, configuration or credential reads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const output = path.join(repo, 'docs/soterai-lite/evidence/20261113-production-readiness/cline-public-review.json');
if (fs.existsSync(output)) throw Error('Existing evidence is preserved');
const roots = [
  path.join(repo, 'docs/soterai-lite/evidence/20261106-v01-cline-01/public-vendor'),
  'C:\\Users\\USER\\.vscode\\extensions\\saoudrizwan.claude-dev-4.1.26',
];
const terms = ['providers.json', 'cline_mcp_settings.json', 'global-settings.json', 'openai-compatible', 'hooksEnabled', 'optOutOfRemoteConfig', 'PreToolUse', 'TaskStart', 'openAiHeaders', 'read_files', 'execute_command'];
const artifacts = roots.map(root => {
  if (!fs.existsSync(path.join(root, 'package.json'))) return { available: false };
  const manifestRaw = fs.readFileSync(path.join(root, 'package.json'));
  const manifest = JSON.parse(manifestRaw);
  const bytes = fs.readFileSync(path.join(root, 'dist/extension.js'));
  if (manifestRaw.length > 65536 || bytes.length > 32 * 1024 * 1024) throw Error('Unsupported artifact size');
  const source = bytes.toString('utf8');
  const findings = terms.map(term => {
    const offsets = []; let position = 0;
    while ((position = source.indexOf(term, position)) >= 0) { offsets.push(position); position += term.length; }
    const selected = offsets.length > 4 ? [...offsets.slice(0, 2), ...offsets.slice(-2)] : offsets;
    return { term, count: offsets.length, snippets: selected.map(position => source.slice(Math.max(0, position - 170), position + 500)
      .replace(/[A-Za-z0-9_+/-]{80,}/g, '[LONG_LITERAL_OMITTED]').replace(/(?:sk-|AIza|ghp_)[A-Za-z0-9_-]{12,}/g, '[CREDENTIAL_LITERAL_OMITTED]')) };
  });
  return { available: true, publisher: manifest.publisher, name: manifest.name, version: manifest.version,
    main: manifest.main, engine: manifest.engines?.vscode,
    manifestSha256: crypto.createHash('sha256').update(manifestRaw).digest('hex'), runtimeSha256: crypto.createHash('sha256').update(bytes).digest('hex'), runtimeBytes: bytes.length,
    commands: manifest.contributes?.commands?.map(item => item.command), findings };
});
fs.writeFileSync(output, JSON.stringify({ schemaVersion: 1, scope: 'PUBLIC_SOURCE_ONLY', nativeExecution: false, providerTrafficTested: false, artifacts }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(artifacts.map(({ findings, ...publicMetadata }) => publicMetadata)));
