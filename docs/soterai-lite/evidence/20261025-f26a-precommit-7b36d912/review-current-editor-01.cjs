// Installed executable/application metadata and exact API witnesses only.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const priorPath = 'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/host-version-review-01.json', priorRaw = fs.readFileSync(priorPath);
if (sha(priorRaw) !== '5753c649112077de63fe26fabfb10491b4dc278de4ffc4aa6436b29057a155de') throw Error('Sealed prior installed-source review differs.');
const prior = JSON.parse(priorRaw), facts = [prior.currentHost.executable, ...prior.currentHost.applicationFiles];
for (const record of facts) {
 if (!record.path.startsWith('C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\')) throw Error('Unreviewed application path.');
 const stat = fs.lstatSync(record.path); if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.bytes || stat.size > 536870912) throw Error('Installed application identity differs.');
 const raw = fs.readFileSync(record.path); if (sha(raw) !== record.sha256) throw Error('Installed editor changed; fresh version inspection required.');
}
const appPackage = JSON.parse(fs.readFileSync(facts.find(item => /\\package[.]json$/.test(item.path)).path, 'utf8'));
const product = JSON.parse(fs.readFileSync(facts.find(item => /\\product[.]json$/.test(item.path)).path, 'utf8'));
if (appPackage.version !== '1.143.1' || product.commit !== prior.currentHost.commit) throw Error('Installed application version/commit differs.');
const engine = JSON.parse(fs.readFileSync('packages/vscode-extension/package.json', 'utf8')).engines.vscode;
if (engine !== '^1.85.0') throw Error('Reviewed extension engine changed.');
const source = fs.readFileSync(prior.apiReview.source.path, 'utf8');
const checks = prior.apiReview.checks.map(item => {
 if (typeof item.exactWitness !== 'string' || source.slice(item.utf16Offset, item.utf16Offset + item.exactWitness.length) !== item.exactWitness) throw Error('Current installed API witness differs: ' + item.api);
 return { ...item, assessment: 'Fresh exact installed-source witness only; current F26a exact-artifact native evidence remains required.' };
});
if (checks.length !== 20) throw Error('Expected twenty current installed API witnesses.');
const value = { schemaVersion: 1, status: 'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING', currentFeature: 'F26a', independence: 'LOW',
 observedAt: new Date().toISOString(), scope: 'Fresh read-only exact current executable+four installed application files and20API source witnesses. No Code launch, normal user-data profile, download, login, update or native behavior claim.',
 currentHost: { ...prior.currentHost, extensionEngine: engine }, priorReview: { path: priorPath, bytes: priorRaw.length, sha256: sha(priorRaw) },
 apiReview: { source: prior.apiReview.source, checks }, required: 'Current full/backend/21driver/newfour-runtimeVSIX/content and actual newownerhook34+all20affected families; do not substitute static API presence for execution.' };
const file = path.join(__dirname, 'host-version-review-01.json'); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: value.status, host: appPackage.version, files: facts.length, apiWitnesses: checks.length, bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) }));
