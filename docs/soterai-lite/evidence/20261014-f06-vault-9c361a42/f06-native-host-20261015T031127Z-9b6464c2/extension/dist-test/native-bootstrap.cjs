const vscode = require('vscode');
const fs = require('node:fs/promises');
const actual = require('../dist/extension.js');
const driver = require('./host/index.js');
const recordFailure = async (stage,error) => {
  await fs.writeFile(process.env.SOTERAI_LITE_F06_EVIDENCE + '.driver-error.json',
    JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error ? error.name : 'UnknownFailure',fixtureDiagnostic:typeof driver.setupDiagnostic==='function'?driver.setupDiagnostic():undefined})+'\n',{flag:'wx'});
};
exports.activate = async function(context) {
  let stage='beforeActivate';
  try { await driver.beforeActivate(context); stage='activate'; await actual.activate(context); }
  catch(error) {
    try { await recordFailure(stage,error); }
    finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); }
    return;
  }
  // Return activation before running commands which themselves await activation.
  setTimeout(async () => {
    try { await driver.run(context); }
    catch(error) { await recordFailure('run',error); }
    finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); }
  },1500);
};
exports.deactivate = actual.deactivate;