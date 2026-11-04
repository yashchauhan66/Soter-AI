'use strict';
// INERT ATTACH-ONLY test instrumentation. No browser/process launch, DOM click,
// value assignment, product import, vscode mock or native prompt interception.
const fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, bound, label) {
  const start = Date.now();
  while (Date.now() - start < bound) { const value = await fn(); if (value) return value; await wait(80); }
  throw Error(label);
}
function pin(row) {
  const stat = fs.lstatSync(row.path);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size === row.bytes);
  const raw = fs.readFileSync(row.path);
  assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256);
  return raw;
}
async function run() {
  assert.equal(process.argv.length, 3);
  const b = read(process.argv[2]);
  assert.equal(b.feature, 'F32'); assert.equal(b.status, 'REVIEWED_ONE_NORMAL_ROUND');
  for (const row of b.rendererPins) pin(row);
  const endpoint = new URL(b.endpoint);
  assert.equal(endpoint.protocol, 'http:'); assert.equal(endpoint.hostname, '127.0.0.1');
  assert(/^[1-9][0-9]{3,4}$/.test(endpoint.port) && Number(endpoint.port) <= 65535);
  assert.equal(endpoint.pathname, '/'); assert(!endpoint.search && !endpoint.hash && !endpoint.username && !endpoint.password);
  const owner = JSON.parse(pin(b.ownerReceipt).toString('utf8').replace(/^\uFEFF/, ''));
  const custody = JSON.parse(pin(b.listenerCustody).toString('utf8').replace(/^\uFEFF/, ''));
  assert.equal(owner.pid, b.codePid); assert.equal(owner.signalsRequested, 0);
  assert.equal(custody.rootCodePid, b.codePid); assert.equal(custody.localAddress, '127.0.0.1');
  assert.equal(custody.localPort, Number(endpoint.port)); assert.equal(custody.signals, 0);
  assert(custody.owningProcess === b.codePid || custody.codeProcessTreePids.includes(custody.owningProcess));
  assert.equal(path.resolve(custody.profile).toLowerCase(), path.resolve(b.profile).toLowerCase());
  // These exact local modules must be frozen in rendererPins before admission.
  const { chromium } = require(b.playwrightEntry);
  let browser;
  const observations = [];
  try {
    browser = await chromium.connectOverCDP(endpoint.origin, { timeout: 15000, noDefaults: true, artifactsDir: b.gate });
    const candidates = [];
    for (const candidate of browser.contexts().flatMap(context => context.pages())) {
      if (/^vscode-file:\/\/vscode-app\//.test(candidate.url()) &&
          (await candidate.title()).includes(path.basename(b.workspace))) candidates.push(candidate);
    }
    assert.equal(candidates.length, 1, 'Exact owned workbench renderer required');
    const page = candidates[0]; page.setDefaultTimeout(8000); await page.bringToFront();
    const dialog = page.locator('.monaco-dialog-box');
    async function keyboardButton(text) {
      const target = dialog.getByRole('button', { name: text, exact: true });
      assert.equal(await target.count(), 1);
      for (let index = 0; index < 16; index++) {
        const focused = await target.evaluate(element => element === element.ownerDocument.activeElement);
        if (focused) { await page.keyboard.press('Enter'); return; }
        await page.keyboard.press('Tab');
      }
      throw Error('Exact native button did not receive real keyboard focus');
    }
    async function nativeModal(step) {
      const allowed = {
        'Review SoterAI changes before removal': ['Review restoration'],
        'Apply this terminal profile change to the selected project?': ['Use checked PowerShell profile', 'Restore previous terminal profile'],
        'Apply these reviewed editor associations only to the selected project?': ['Use masked environment editor', 'Restore project associations'],
        'Move these values into the encrypted vault and replace them with placeholders?': ['Migrate securely'],
      };
      assert(Object.hasOwn(allowed, step.contains), 'Only frozen native dialogs are authorized');
      assert(step.cancel === true && step.button === undefined || allowed[step.contains].includes(step.button));
      await until(async () => await dialog.isVisible() && (await dialog.innerText()).includes(step.contains),
        15000, 'Exact native dialog text not observed');
      observations.push({ kind: 'native-modal', contains: step.contains, button: step.button ?? 'ESCAPE_CANCEL' });
      if (step.cancel === true) await page.keyboard.press('Escape');
      else { assert(typeof step.button === 'string'); await keyboardButton(step.button); }
      await until(async () => !await dialog.isVisible() || !(await dialog.innerText()).includes(step.contains),
        8000, 'Native modal did not finish or transition to the next actual review');
    }
    async function optionalFolderPicker() {
      // The profile owner may select its sole root without a picker; association
      // owner currently presents the real native workspace picker. If the next
      // modal is already visible, there is no picker to bypass.
      const widget = page.locator('.quick-input-widget');
      const next = await until(async () => {
        if (await dialog.isVisible()) return 'modal';
        if (await widget.isVisible()) return 'picker';
      }, 15000, 'Expected native workspace review UI missing');
      if (next === 'modal') return;
      const text = await widget.innerText();
      assert(text.includes(path.basename(b.workspace)), 'Selected synthetic workspace absent from picker');
      const options = widget.locator('.quick-input-list .monaco-list-row');
      assert.equal(await options.count(), 1, 'Exactly one actual selected-workspace choice required');
      assert((await options.first().innerText()).includes(path.basename(b.workspace)));
      await page.keyboard.press('Enter');
      observations.push({ kind: 'native-workspace-picker', selected: path.basename(b.workspace) });
    }
    // Only trust UI for the exact owned synthetic workspace. Primary/restart
    // allow trust; untrusted chooses restricted mode. No workspace-trust flag bypass.
    if (b.trustChoice) {
      assert(['Yes, I trust the authors', "No, I don't trust the authors"].includes(b.trustChoice));
      await until(async () => await dialog.isVisible() && /trust the authors/i.test(await dialog.innerText()),
        30000, 'Fresh synthetic trust dialog not observed');
      assert((await dialog.innerText()).includes(path.basename(b.workspace)));
      await keyboardButton(b.trustChoice);
      observations.push({ kind: 'native-initial-trust', choice: b.trustChoice });
    }
    let next = 1;
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline) {
      if (fs.existsSync(path.join(b.gate, b.phase + '-observer-failure.json'))) throw Error('Observer failed');
      if (fs.existsSync(path.join(b.gate, b.phase + '-observer-results.json'))) {
        write(path.join(b.gate, b.phase + '-renderer-results.json'), {
          schemaVersion: 1, feature: 'F32', phase: b.phase, status: 'OBSERVED_REAL_KEYBOARD',
          observations, productPromptInterception: false, productApiReplacement: false,
          domActions: 'READ_ONLY_OBSERVATION', signalsRequested: 0,
        });
        return;
      }
      const requestFile = path.join(b.gate, b.phase + '-ui-' + next + '.json');
      if (!fs.existsSync(requestFile)) { await wait(80); continue; }
      const request = read(requestFile);
      assert.equal(request.schemaVersion, 1); assert.equal(request.feature, 'F32'); assert.equal(request.phase, b.phase);
      assert.equal(request.number, next); assert(/^[a-f0-9]{32}$/.test(request.nonce));
      assert(request.syntheticOnly === true && request.signalsRequested === 0);
      assert.equal(request.workspaceName, path.basename(b.workspace));
      assert(Array.isArray(request.steps) && request.steps.length <= 8);
      for (const step of request.steps) {
        if (step.kind === 'optionalWorkspacePicker') await optionalFolderPicker();
        else if (step.kind === 'modal') await nativeModal(step);
        else throw Error('Unrecognized UI step refuses input');
      }
      write(requestFile + '.done.json', { status: 'OBSERVED_REAL_KEYBOARD', nonce: request.nonce, signalsRequested: 0 });
      next++;
    }
    throw Error('Bounded renderer phase expired; no signals or retry');
  } finally {
    // connectOverCDP transport disconnect only. The product's normal Close owns
    // withdrawal; reviewed local Playwright core binding must verify this first.
    if (browser) await browser.close();
  }
}
if (require.main === module) run().catch(error => {
  // No prompt text, raw result, synthetic value, exception message or stack.
  process.stderr.write(JSON.stringify({ feature: 'F32', status: 'FAIL_OR_INCOMPLETE_NO_RETRY',
    errorName: error instanceof Error ? error.name : 'UnknownFailure', signalsRequested: 0 }) + '\n');
  process.exitCode = 1;
});
module.exports = { run };
