const vscode = require('vscode');
const fs = require('node:fs/promises');
let actual, driver;
const startup = async stage => {
 try {
  const selected = process.env.SOTERAI_LITE_F06_PHASE;
  const phase = ['primary', 'restart', 'save', 'reload'].includes(selected) ? selected : 'invalid';
  await fs.appendFile(process.env.SOTERAI_LITE_F06_EVIDENCE+'.startup.jsonl',
   JSON.stringify({phase, timestamp:new Date().toISOString(), stage})+'\n');
 } catch {}
};
const close = async () => {
 await startup('close-start');
 await vscode.commands.executeCommand('workbench.action.closeWindow');
 await startup('close-end');
};
const failure = async (stage,error) => fs.writeFile(process.env.SOTERAI_LITE_F06_EVIDENCE+'.driver-error.json',
 JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure',setup:typeof driver?.setupDiagnostic==='function'?driver.setupDiagnostic():undefined})+'\n',{flag:'wx'});
exports.activate = async function(context) {
 try {
  await startup('activation-enter');
  await startup('actual-require-start'); actual = require('../dist/extension.js'); await startup('actual-require-end');
  await startup('driver-require-start'); driver = require('./host/index.js'); await startup('driver-require-end');
  await startup('before-activate-start'); if (typeof driver.beforeActivate === 'function') await driver.beforeActivate(context); await startup('before-activate-end');
  await startup('actual-activate-start'); await actual.activate(context); await startup('actual-activate-end');
 }
 catch(error) { await startup('activation-error'); try { await failure('activate',error); } finally { await close(); } return; }
 setTimeout(async()=>{try { await startup('driver-run-start'); await driver.run(context); await startup('driver-run-end'); } catch(error) { await startup('driver-error'); await failure('run',error); }
 finally { await close(); }},1500);
};
exports.deactivate = function(...args) { return typeof actual?.deactivate === 'function' ? actual.deactivate(...args) : undefined; };