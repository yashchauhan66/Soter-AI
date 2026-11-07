// Test operational wrapper: creates only an isolated synthetic review editor.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const root = process.cwd();
const ext = path.join(root, 'packages/vscode-extension');
const out = path.join(root, process.argv[2] === 'final' ? '.tmp/pv-final/ui-review-final' : '.tmp/pv-final/ui-review');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const reportPath = path.join(ext, 'verification/project-privacy-verification.json');
const report = JSON.parse(fs.readFileSync(reportPath));
if (!report.suites.some(s => s.id === 'claude-code-public-control')) {
  report.suites.push({id:'claude-code-public-control',kind:'extension-host',
    scope:'Claude Code 2.1.292 CLI attempt: INCOMPLETE; Not logged in · Please run /login; zero API tokens and no completed read.',passed:0,failed:0,skipped:1});
  report.generatedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report,null,2)+'\n');
}
if(fs.existsSync(out)) throw Error('Existing review directory refused.');
for(const name of ['extension/dist','extension/dist-test/host','extension/media','extension/verification','profile/User','workspace','extensions'])
  fs.mkdirSync(path.join(out,name),{recursive:true});
for(const name of ['package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js','dist-test/host/index.js','media/icon.svg','media/logo_circle_whiter.png','verification/project-privacy-verification.json'])
  fs.copyFileSync(path.join(ext,name),path.join(out,'extension',name));
fs.writeFileSync(path.join(out,'workspace/.synthetic-privacy-host'),'synthetic-only-v1');
fs.writeFileSync(path.join(out,'workspace/public.ts'),"export const greeting = 'Synthetic UI review';\n");
fs.writeFileSync(path.join(out,'workspace/.env'),'DATABASE_URL=SYNTHETIC_NOT_A_SECRET\nPORT=3000\n');
fs.writeFileSync(path.join(out,'workspace/.aiignore'),Array.from({length:35},(_,i)=>`restricted-${i}.txt`).join('\n')+'\n');
fs.writeFileSync(path.join(out,'profile/User/settings.json'),JSON.stringify({
  'telemetry.telemetryLevel':'off','update.mode':'none','extensions.autoUpdate':false,'extensions.autoCheckUpdates':false,
  'soterai.cloud.enabled':false,'soterai.autoVaultMigration.enabled':false,'soterai.broker.autoStart':false,
  'soterai.projectPrivacy.enabled':true,'soterai.projectPrivacy.professionalUi':true,
  'soterai.projectPrivacy.atomicSensitivePolicy':true,'soterai.projectPrivacy.safeViewComposition':true,
  'soterai.projectPrivacy.safePublication':false,'soterai.projectPrivacy.syntheticRuntime':false},null,2));
const code=path.join(ext,'.vscode-test/vscode-win32-x64-archive-1.104.0/Code.exe');
const env={};
for(const key of ['SystemRoot','WINDIR','TEMP','TMP','COMSPEC']) if(process.env[key]) env[key]=process.env[key];
Object.assign(env,{USERPROFILE:path.join(out,'profile'),APPDATA:path.join(out,'profile/AppData/Roaming'),LOCALAPPDATA:path.join(out,'profile/AppData/Local'),
  SOTERAI_HOST_PROJECT_PRIVACY:'1',SOTERAI_PRIVACY_SHOW:'1',SOTERAI_PRIVACY_HOST_EVIDENCE:path.join(out,'ui-ready.json'),
  SOTERAI_PRIVACY_BUNDLE_SHA256:sha(path.join(out,'extension/dist/extension.js'))});
const args=[`--extensionDevelopmentPath=${path.join(out,'extension')}`,`--extensionTestsPath=${path.join(out,'extension/dist-test/host/index.js')}`,
  `--user-data-dir=${path.join(out,'profile')}`,`--extensions-dir=${path.join(out,'extensions')}`,
  '--disable-extensions','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',path.join(out,'workspace')];
const stdout=fs.openSync(path.join(out,'stdout.txt'),'a'),stderr=fs.openSync(path.join(out,'stderr.txt'),'a');
const child=spawn(code,args,{cwd:path.join(out,'workspace'),env,detached:true,windowsHide:false,stdio:['ignore',stdout,stderr]});
child.on('error',e=>{fs.writeFileSync(path.join(out,'launch-error.txt'),String(e));process.exitCode=1;});
child.unref();fs.closeSync(stdout);fs.closeSync(stderr);
fs.writeFileSync(path.join(out,'launch.json'),JSON.stringify({createdAt:new Date().toISOString(),pid:child.pid,extensionSha256:env.SOTERAI_PRIVACY_BUNDLE_SHA256,
  scope:'Visible synthetic review editor only. Existing Code processes untouched. No debug listener. No completed test assertion from persistent mode.'},null,2));
console.log(out);
