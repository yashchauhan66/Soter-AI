// Offline manifest/assets migration; never runs an installer or touches profiles.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const lite = path.join(root, 'packages/soterai-lite');
const legacy = path.join(root, 'packages/vscode-extension');
const identity = JSON.parse(fs.readFileSync(path.join(root, 'docs/soterai-lite/release-identity.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(legacy, 'package.json'), 'utf8'));
const writeJson = (file, value) => {
  const staged = path.join(path.dirname(file), '.tmp-' + path.basename(file) + '-' + crypto.randomBytes(6).toString('hex'));
  fs.writeFileSync(staged, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(staged, file);
};
const manifest = { ...source, name: identity.liteName, publisher: identity.publisher,
  displayName: identity.liteDisplayName, version: identity.liteVersion, preview: true,
  description: 'Local managed secret protection for cooperative AI tools, with approved masked reads and bundled broker. No VM or account required.',
  repository: { ...source.repository, directory: 'packages/soterai-lite' },
  files: ['dist/extension.js', 'dist/local-ai-broker.js', 'dist/soterai-mcp-server.js',
    'media/icon.svg', 'media/logo_circle_whiter.png', 'media/walkthrough/*.md',
    'README.md', 'CHANGELOG.md', 'LICENSE.md'],
  scripts: { typecheck: 'tsc --noEmit -p tsconfig.json', lint: 'npm run typecheck',
    test: 'node --import tsx --test ../vscode-extension/src/__tests__/**/*.test.ts',
    build: 'node scripts/build.cjs', bundle: 'node scripts/build.cjs',
    'vscode:prepublish': 'node scripts/verify-build.cjs',
    package: 'node scripts/package.cjs',
    'vscode:package': 'npm run package' }
};
writeJson(path.join(lite, 'package.json'), manifest);
for (const relative of ['LICENSE.md', 'media/icon.svg', 'media/logo_circle_whiter.png',
  'media/walkthrough/demo.md', 'media/walkthrough/vault.md', 'media/walkthrough/integrate.md']) {
  const destination = path.join(lite, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(legacy, relative), destination);
}
writeJson(path.join(root, 'packages/soterai-full/package.json'), {
  name: identity.fullName, displayName: identity.fullDisplayName, version: identity.fullVersion,
  publisher: identity.publisher, private: true, preview: true,
  description: 'Dependency-only Full isolation scaffold; no VM/controller implementation shipped.',
  license: source.license, engines: source.engines,
  extensionDependencies: [identity.liteId],
  contributes: { configuration: { title: identity.fullDisplayName, properties: {
    'soterai.full.scaffoldOnly': { type: 'boolean', default: true,
      description: 'Full is a scaffold only. This setting enables no isolation or controller.' }
  } } }
});
const rootFile = path.join(root, 'package.json');
const rootManifest = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
if (!rootManifest.workspaces.includes('!packages/vscode-extension')) rootManifest.workspaces.push('!packages/vscode-extension');
for (const key of ['vscode:package', 'openvsx:package']) rootManifest.scripts[key] = 'npm --prefix packages/soterai-lite run vscode:package';
for (const key of ['vscode:publish', 'openvsx:publish']) rootManifest.scripts[key] = 'node scripts/soterai-lite-publish-owner.cjs';
// Publishing remains a separate owner action; no publish is executed here.
writeJson(rootFile, rootManifest);
const lockFile = path.join(root, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
lock.packages[''].workspaces = rootManifest.workspaces;
delete lock.packages['packages/vscode-extension'];
lock.packages['packages/soterai-lite'] = { name: manifest.name, version: manifest.version,
  license: manifest.license, devDependencies: manifest.devDependencies, engines: manifest.engines };
lock.packages['node_modules/' + manifest.name] = { resolved: 'packages/soterai-lite', link: true };
for (const directory of ['core', 'soterai-full']) {
  const current = JSON.parse(fs.readFileSync(path.join(root, 'packages', directory, 'package.json'), 'utf8'));
  lock.packages['packages/' + directory] = { name: current.name, version: current.version, license: current.license };
  lock.packages['node_modules/' + current.name] = { resolved: 'packages/' + directory, link: true };
}
writeJson(lockFile, lock);
console.log(JSON.stringify({ status: 'PREPARED_NOT_VERIFIED', identity: identity.liteId,
  version: manifest.version, historicalSourcePreserved: true, extraInstalls: 0 }));
