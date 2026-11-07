const vscode = require('vscode');
const fs = require('node:fs/promises');
const actual = require('../dist/extension.js');
exports.activate = function(context) {
  actual.activate(context);
  setTimeout(async () => {
    try { await require('./host/index.js').run(context); }
    catch(error) {
      await fs.writeFile(process.env.SOTERAI_LITE_F04_EVIDENCE + '.driver-error.json',
        JSON.stringify({status:'FAIL',errorName:error instanceof Error ? error.name : 'UnknownFailure'})+'\n',{flag:'wx'});
    } finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); }
  }, 1500);
};
exports.deactivate = actual.deactivate;