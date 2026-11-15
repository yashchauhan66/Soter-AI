'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { scanDirectory, scanExitCode } = require('../../packages/soterai-cli/dist/ci/scan.js');
const { publicCiSummary, githubSummary } = require('../../packages/soterai-cli/dist/ci/report.js');
const { readStable } = require('../../packages/soterai-cli/dist/security/bounded.js');

// A finite single-file Node build; no application execution, credentials or publishing.
async function checkExample(sourceRoot, output) {
  await fs.mkdir(output);
  const reports = path.join(output, 'reports'), artifact = path.join(output, 'artifact');
  await fs.mkdir(reports);
  const source = await scanDirectory(sourceRoot, { mode: 'source' });
  if (!source.scannedFiles) { source.status = 'incomplete'; source.diagnostics.push({ code: 'ROOT_UNAVAILABLE' }); delete source.snapshotSha256; }
  let buildComplete = false;
  try {
    const code = await readStable(path.join(sourceRoot, 'app.js'), 131072);
    if (!code.length) throw Error();
    await fs.mkdir(artifact);
    await fs.writeFile(path.join(artifact, 'app.bundle.cjs'), code, { flag: 'wx' });
    buildComplete = true;
  } catch { /* Missing/invalid builds become an incomplete artifact scan below. */ }
  const built = await scanDirectory(artifact, { mode: 'artifact' });
  if (!buildComplete) { built.status = 'incomplete'; built.diagnostics.push({ code: 'READ_FAILED' }); delete built.snapshotSha256; }
  await fs.writeFile(path.join(reports, 'source.json'), JSON.stringify(publicCiSummary(source), null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(reports, 'artifact.json'), JSON.stringify(publicCiSummary(built), null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(reports, 'summary.md'), '# Finite Node example security check\n\nThis checks the example source and its actual single-file output. It does not certify the whole repository.\n\n' + githubSummary(source) + '\n' + githubSummary(built), { flag: 'wx' });
  return { exitCode: Math.max(scanExitCode(source), scanExitCode(built)), source: publicCiSummary(source), artifact: publicCiSummary(built) };
}
module.exports = { checkExample };
if (require.main === module) {
  if (process.argv.length !== 3) { process.stderr.write('Use check.cjs <new-output-directory>\n'); process.exitCode = 2; }
  else checkExample(path.resolve(__dirname, '../aws-soterai/app'), path.resolve(process.argv[2]))
    .then(result => { process.exitCode = result.exitCode; process.stdout.write(JSON.stringify(result) + '\n'); })
    .catch(() => { process.stderr.write('Example verification incomplete; no admission claimed.\n'); process.exitCode = 2; });
}
