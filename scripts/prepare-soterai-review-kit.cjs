'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { resolveRelease } = require('../packages/soterai-lite/scripts/release-artifact.cjs');
const repo = path.resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function main() {
  const [pointer, directory] = process.argv.slice(2); if (!pointer || !directory) throw Error();
  const output = path.resolve(repo, directory); if (!output.startsWith(repo + path.sep)) throw Error();
  const release = await resolveRelease({ repoRoot: repo, pointerPath: path.resolve(repo, pointer) });
  const build = JSON.parse(await fs.readFile(path.join(repo, release.buildReceiptPath), 'utf8'));
  await fs.mkdir(output);
  const files = [];
  async function write(name, bytes) {
    const target = path.join(output, name); if (!target.startsWith(output + path.sep)) throw Error();
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes, { flag: 'wx' });
    files.push({ path: name.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) });
  }
  await write('candidate.vsix', await fs.readFile(path.join(repo, release.artifactPath)));
  const source = new Map();
  for (const runtime of build.inventory) for (const input of runtime.inputs) {
    if (/^(?:packages\/(?:vscode-extension|guard-core|core|ide-common|ide-protocol|soterai-cli)\/src\/|apps\/local-ai-broker\/src\/)/.test(input.path)) source.set(input.path, input);
  }
  for (const input of source.values()) {
    const file = path.resolve(repo, input.path); if (!file.startsWith(repo + path.sep)) throw Error();
    const bytes = await fs.readFile(file); if (bytes.length !== input.bytes || sha(bytes) !== input.sha256) throw Error('Source changed');
    await write('source/' + input.path, bytes);
  }
  const guide = `# Independent review of SoterAI Secret Guard\n\nCandidate: ${release.identity} ${release.version}, Windows x64 preview.\nSHA-256: ${release.sha256}\n\nRun \`node verify.cjs ${release.sha256}\` before reviewing. This verifies packet bytes; it is not a security verdict.\n\nReview the exact VSIX and source snapshots without relying on builder ratings. Sources were copied from the package's build receipt; reproducible compilation has not been established independently. Install only into a new VS Code profile and use synthetic credentials. Source snapshots are static review inputs, not a complete dependency-installed checkout.\n\nCheck activation, live findings, reviewed copy and cancellation, source/preview edits, supported vault migration, a useful app run, interrupted upgrade/recovery and untrusted workspace behavior. Record what you actually observe and each unsupported/skipped case. Test actual supported Cline traffic separately with owner-controlled credentials; never include a real credential, raw private config or clipboard contents in a report.\n\nSecurity review should include stale approval/state, path aliases, malformed/encoded requests, output/log leaks, replay, withdrawal and useful benign controls. Accessibility review should include keyboard focus, names/state announcements, masked values and cancellation using a real screen reader.\n\nUse pilot-template.json, security-template.json and accessibility-template.json. Human independence and identity need actual evidence; five files or generated keys do not establish five people. No result is prefilled as passed.\n`;
  await write('REVIEW.md', Buffer.from(guide));
  const tasks = ['install-and-activate', 'guided-setup', 'recognized-secret-preview', 'cancel-without-copy', 'stale-source-refusal', 'vault-migration', 'supported-app-still-runs', 'upgrade-and-encrypted-recovery', 'coverage-understood'];
  await write('pilot-template.json', Buffer.from(JSON.stringify({ schemaVersion: 1, artifactSha256: release.sha256, participantId: null, independentParticipant: null, editorVersion: null, startedAt: null, completedAt: null, tasks: tasks.map(task => ({ task, status: 'NOT_RUN', seconds: null, notes: null })) }, null, 2) + '\n'));
  await write('security-template.json', Buffer.from(JSON.stringify({ schemaVersion: 1, artifactSha256: release.sha256, reviewerId: null, independentReviewer: null, scope: null, findings: null, testedControls: null, untestedScope: null, verdict: 'NOT_REVIEWED' }, null, 2) + '\n'));
  await write('accessibility-template.json', Buffer.from(JSON.stringify({ schemaVersion: 1, artifactSha256: release.sha256, reviewerId: null, readerName: null, readerVersion: null, editorVersion: null, results: null, untestedScope: null, verdict: 'NOT_REVIEWED' }, null, 2) + '\n'));
  const verify = `'use strict';\nconst fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');\nconst root=__dirname,m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')),expected=process.argv[2];\nif(!/^[a-f0-9]{64}$/.test(expected||'')||m.artifactSha256!==expected)throw Error('Trusted candidate hash required');\nfor(const item of m.files){if(typeof item.path!=='string'||!item.path.split('/').every(s=>s&&s!=='.'&&s!=='..')||/[\\\\:\\x00-\\x1f]/.test(item.path))throw Error('Invalid path');const file=path.resolve(root,item.path);if(!file.startsWith(root+path.sep))throw Error('Path escaped');const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1)throw Error('Ordinary file required');const b=fs.readFileSync(file);if(b.length!==item.bytes||crypto.createHash('sha256').update(b).digest('hex')!==item.sha256)throw Error('Packet mismatch');}\nconsole.log(JSON.stringify({status:'PACKET_BYTES_VERIFIED',artifactSha256:expected,files:m.files.length,humanAcceptance:false,releaseReady:false}));\n`;
  await write('verify.cjs', Buffer.from(verify));
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ schemaVersion: 1, artifactSha256: release.sha256, files }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'REVIEW_PACKET_PREPARED', artifactSha256: release.sha256, files: files.length, sourceFiles: source.size, humanResults: 0, releaseReady: false }));
}
main().catch(() => { console.error('Review kit preparation incomplete.'); process.exitCode = 2; });
