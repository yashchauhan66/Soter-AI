// Package a complete immutable attempt, never a partly refreshed operational dist.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const vsce = require('@vscode/vsce');
const { verifyBuild } = require('./verify-build.cjs');
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '../..');
async function main() {
  execFileSync(process.execPath, [path.join(__dirname,'build.cjs')], {stdio:'inherit',windowsHide:true});
  const {receipt,attempt} = verifyBuild();
  const output = path.resolve(root, process.argv[2] || 'soterai-lite-' + receipt.version + '-' + receipt.runId + '.vsix');
  if (!output.startsWith(repo + path.sep) || !output.endsWith('.vsix')) throw new Error('VSIX output must stay inside workspace');
  try { await fs.access(output); throw new Error('Existing artifact overwrite refused'); } catch(error) { if(error.code !== 'ENOENT') throw error; }
  const staging = path.join(attempt, 'package');
  await fs.mkdir(staging);
  const manifest = JSON.parse(await fs.readFile(path.join(attempt,'package.json'),'utf8'));
  delete manifest.scripts; delete manifest.devDependencies;
  await fs.writeFile(path.join(staging,'package.json'), JSON.stringify(manifest,null,2)+'\n', {flag:'wx'});
  for (const item of receipt.inventory) {
    await fs.mkdir(path.join(staging,'dist'),{recursive:true});
    await fs.copyFile(path.join(attempt,'dist',item.name),path.join(staging,'dist',item.name));
    const bytes=await fs.readFile(path.join(staging,'dist',item.name));
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256) throw new Error('Staged runtime mismatch');
  }
  const assets=['README.md','CHANGELOG.md','LICENSE.md','media/icon.svg','media/logo_circle_whiter.png',
    'media/walkthrough/demo.md','media/walkthrough/vault.md','media/walkthrough/integrate.md'];
  for(const asset of assets) {
    await fs.mkdir(path.dirname(path.join(staging,asset)),{recursive:true});
    await fs.copyFile(path.join(root,asset),path.join(staging,asset));
  }
  await vsce.createVSIX({cwd:staging,packagePath:output,dependencies:false,target:'win32-x64'});
  const bytes=await fs.readFile(output);
  const result={status:'PACKAGED_NOT_HOST_VERIFIED',output:path.relative(repo,output),
    bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    runId:receipt.runId,extensionSha256:receipt.inventory.find(i=>i.name==='extension.js').sha256,
    stagedManifestSha256:crypto.createHash('sha256').update(await fs.readFile(path.join(staging,'package.json'))).digest('hex')};
  await fs.writeFile(path.join(attempt,'package-receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
