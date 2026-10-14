const fs=require('node:fs'),path=require('node:path');const original=fs.readFileSync(path.join(__dirname,'run-native-01.ps1'),'utf8');
const start=original.indexOf("$taskBootstrap=@'"),end=original.indexOf("\n'@",start);if(start<0||end<0)throw Error('Expected bootstrap here-string.');
const bootstrap=`$taskBootstrap=@'
const vscode = require('vscode');
const fs = require('node:fs/promises');
const actual = require('../dist/extension.js');
const driver = require('./host/index.js');
const recordFailure = async (stage,error) => {
  await fs.writeFile(process.env.SOTERAI_LITE_F05_EVIDENCE + '.driver-error.json',
    JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error ? error.name : 'UnknownFailure'})+'\\n',{flag:'wx'});
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
'@`;
fs.writeFileSync(path.join(__dirname,'run-native-02.ps1'),original.slice(0,start)+bootstrap+original.slice(end+3),{flag:'wx'});
console.log('Prepared owned-window cleanup for preactivation and run errors; no production byte changes.');
