'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const test = require('node:test'), assert = require('node:assert/strict');
const { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');
const vendorPath = 'C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/261c84cb1e/resources/app/out/vs/workbench/workbench.desktop.main.js';
const source = fs.readFileSync(vendorPath, 'utf8');
function exactSlice(start, end, expectedOccurrences=1) {
  const from = source.indexOf(start); assert(from >= 0); assert.equal(source.split(start).length-1, expectedOccurrences);
  const to = source.indexOf(end, from + start.length); assert(to > from);
  return source.slice(from, to);
}
const enableSource = exactSlice('isWorkspaceTrustEnabled(){return this.environmentService.disableWorkspaceTrust?', '};l$e=I(');
const dialogSource = exactSlice('skipDialogs(){return this.environmentService.enableSmokeTestDriver&&this.logService.warn("DialogService: Dialog requested during smoke test.")', 'async confirm(e){',2);
const startupSource = exactSlice('async showModalOnStart(){', 'get startupPromptSetting(){');
const enabled = new Function('return function ' + enableSource)();
const skipDialogs = new Function('return function ' + dialogSource)();
const startup = new Function('Wx', 'return ' + startupSource.replace('async showModalOnStart()', 'async function()'))(() => false);
const fake = overrides => ({
  workspace: { isTrusted: false, workspaceFolders: [{}], getConfiguration: section => {
    assert.equal(section, 'security.workspace.trust');
    return { get: key => ({ enabled: true, startupPrompt: 'always', emptyWindow: false })[key] };
  } }, window: { state: { focused: true } }, ...overrides,
});
test('Exact vendor enablement does not special-case an extension development observer', () => {
  const base = { environmentService: { disableWorkspaceTrust: false, isExtensionDevelopment: true },
    configurationService: { getValue: key => { assert.equal(key,'security.workspace.trust.enabled'); return true; } } };
  assert.equal(enabled.call(base), true);
  base.environmentService.disableWorkspaceTrust = true; assert.equal(enabled.call(base), false);
  base.environmentService.disableWorkspaceTrust = false;
  base.configurationService.getValue = () => false; assert.equal(enabled.call(base), false);
});
test('Exact vendor dialog suppression needs development AND extensionTestsLocationURI', () => {
  const env = { enableSmokeTestDriver: false, isExtensionDevelopment: true, extensionTestsLocationURI: undefined };
  assert.equal(skipDialogs.call({ environmentService: env }), false);
  env.extensionTestsLocationURI = { testOnly: true };
  assert.equal(skipDialogs.call({ environmentService: env }), true);
  env.isExtensionDevelopment = false;
  assert.equal(skipDialogs.call({ environmentService: env }), false);
});
test('Exact vendor fresh untrusted local workspace with always prompt requests real trust UI', async () => {
  let requests = 0;
  await startup.call({ workspaceTrustManagementService: { isWorkspaceTrusted: () => false, canSetWorkspaceTrust: () => true },
    workspaceContextService: { getWorkspace: () => ({}), getWorkbenchState: () => 2 },
    startupPromptSetting: 'always', workspaceTrustRequestService: { requestWorkspaceTrustOnStartup: () => { requests++; } } });
  assert.equal(requests, 1);
});
test('Exact vendor already-trusted branch does not prompt', async () => {
  let updates = 0;
  await startup.call({ workspaceTrustManagementService: { isWorkspaceTrusted: () => true },
    updateWorkbenchIndicators: value => { assert.equal(value, true); updates++; } });
  assert.equal(updates, 1);
});
test('Exact current vendor constructor waits for native host focus before startup UI', () => {
  assert(source.includes('this.hostService.hasFocus)this.showModalOnStart();else{let S=this.hostService.onDidChangeFocus(y=>{y&&(S.dispose(),this.showModalOnStart())})'));
});
test('Snapshot records only fixed trust fields without copying API results or paths', () => {
  const got = collectTrustSnapshot(fake());
  assert.deepEqual(Object.keys(got), ['status','isTrusted','windowFocused','enabled','startupPrompt','emptyWindow','folderCount','processQueries','productCalls','settingsWrites','signalsRequested']);
  assert.equal(got.isTrusted, false); assert.equal(got.windowFocused, true); assert.equal(got.startupPrompt, 'always');
  assert(Object.isFrozen(got)); assert(!JSON.stringify(got).includes('SOTERAI_F32_SYNTHETIC'));
});
test('Snapshot distinguishes unfocused and trusted metadata without treating either as acceptance', () => {
  const api = fake(); api.window.state.focused = false; api.workspace.isTrusted = true;
  const got = collectTrustSnapshot(api); assert.equal(got.windowFocused,false); assert.equal(got.isTrusted,true);
  assert.equal(got.status,'OBSERVED_FIXED_NATIVE_TRUST_METADATA'); assert.equal(got.productCalls,0);
});
test('Snapshot refuses unknown startup settings and multiple workspace roots', () => {
  const api = fake(); api.workspace.getConfiguration = () => ({ get: key => ({enabled:true,startupPrompt:'future-unknown',emptyWindow:false})[key] });
  assert.throws(() => collectTrustSnapshot(api));
  const second = fake(); second.workspace.workspaceFolders = [{},{}]; assert.throws(() => collectTrustSnapshot(second));
});
