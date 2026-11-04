'use strict';
// INERT read-only observer helper. Importing does not read host state or launch.
// Unit doubles are component controls only. Native use requires a separately
// approved future round and actual unmodified VS Code API objects.
const assert = require('node:assert/strict');
function collectTrustSnapshot(vscode) {
  const config = vscode.workspace.getConfiguration('security.workspace.trust');
  const enabled = config.get('enabled');
  const startupPrompt = config.get('startupPrompt');
  const emptyWindow = config.get('emptyWindow');
  const folderCount = vscode.workspace.workspaceFolders?.length ?? 0;
  assert(typeof vscode.workspace.isTrusted === 'boolean');
  assert(typeof vscode.window.state.focused === 'boolean');
  assert(typeof enabled === 'boolean' && typeof emptyWindow === 'boolean');
  assert(['always', 'once', 'never'].includes(startupPrompt));
  assert(Number.isSafeInteger(folderCount) && folderCount >= 0 && folderCount <= 1);
  return Object.freeze({
    status: 'OBSERVED_FIXED_NATIVE_TRUST_METADATA',
    isTrusted: vscode.workspace.isTrusted,
    windowFocused: vscode.window.state.focused,
    enabled, startupPrompt, emptyWindow, folderCount,
    processQueries: 0, productCalls: 0, settingsWrites: 0, signalsRequested: 0,
  });
}
module.exports = { collectTrustSnapshot };
