'use strict';
// INERT ATTACH-ONLY test instrumentation. No browser/process launch, DOM click,
// value assignment, product import, vscode mock or native prompt interception.
const fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const http = require('node:http');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, bound, label) {
  const start = Date.now();
  while (Date.now() - start < bound) { const value = await fn(); if (value) return value; await wait(80); }
  throw Error(label);
}
async function exactOwnedWebSocket(endpoint) {
  const raw = await new Promise((resolve, reject) => {
    let settled = false, bytes = 0; const chunks = [];
    const finish = (error, value) => { if (settled) return; settled = true; error ? reject(error) : resolve(value); };
    const request = http.get({ hostname: '127.0.0.1', port: Number(endpoint.port), path: '/json/version',
      timeout: 5000, agent: false }, response => {
      if (response.statusCode !== 200 || response.headers.location) {
        response.resume(); finish(Error('Owned CDP version endpoint cannot redirect')); return;
      }
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 65536) { request.destroy(); finish(Error('Bounded CDP response exceeded')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (!response.complete || response.aborted) finish(Error('Incomplete CDP version response'));
        else finish(undefined, Buffer.concat(chunks));
      });
      response.on('error', error => finish(error));
    });
    request.on('timeout', () => { request.destroy(); finish(Error('Bounded owned CDP version timeout')); });
    request.on('error', error => finish(error));
  });
  const value = JSON.parse(raw.toString('utf8')), websocket = new URL(value.webSocketDebuggerUrl);
  assert.equal(websocket.protocol, 'ws:'); assert.equal(websocket.hostname, '127.0.0.1');
  assert.equal(websocket.port, endpoint.port);
  assert(/^\/devtools\/browser\/[a-z0-9-]{1,128}$/i.test(websocket.pathname));
  assert(!websocket.username && !websocket.password && !websocket.search && !websocket.hash);
  return websocket.href;
}
function pin(row) {
  const stat = fs.lstatSync(row.path);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size === row.bytes);
  const raw = fs.readFileSync(row.path);
  assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256);
  return raw;
}
// F32_COMPLETION_HANDSHAKE_BEGIN
function rendererCompletion(b) {
  const file = path.join(b.gate, b.phase + '-observer-results.json');
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 2 * 1024 * 1024);
  const raw = fs.readFileSync(file), value = JSON.parse(raw.toString('utf8'));
  assert.equal(value.schemaVersion, 1); assert.equal(value.feature, 'F32'); assert.equal(value.phase, b.phase);
  assert.equal(value.status, b.phase === 'upgrade-old' ? 'PASS_SCOPED_OLD_INSTALLED_SEED' : 'PASS_SCOPED_OBSERVER_API');
  assert.equal(value.failed, 0); assert.equal(value.notRun, 0); assert.equal(value.signalsRequested, 0);
  assert(Array.isArray(value.observations)); assert.equal(value.passed, value.observations.length);
  assert(typeof value.completionNonce === 'string' && /^[a-f0-9]{32}$/.test(value.completionNonce));
  return { completionNonce: value.completionNonce, observerResult: { path: file, bytes: raw.length, sha256: sha(raw) } };
}
// F32_COMPLETION_HANDSHAKE_END
let observedStage='PRELUDE',safeTrustMetadata,modalPhase,modalDiagnostic;
// Fixed closed set only. The shared until() helper reports its own line, so the
// caller's wait is identified by this code instead of by a stack frame.
const MODAL_PHASES = new Set(['WAIT_DIALOG_TEXT', 'WAIT_DIALOG_CLOSE']);
function safeRendererDiagnostic(error){
 const result={stage:observedStage};
 const stack=error instanceof Error&&typeof error.stack==='string'?error.stack.slice(0,8192):'';
 const match=stack.match(/(?:renderer\.cjs|installed-renderer-proposed-0[1-9]\.cjs):([0-9]{1,6}):([0-9]{1,5})/);
 if(match){result.sourceLine=Number(match[1]);result.sourceColumn=Number(match[2]);}
 if(safeTrustMetadata)result.trust=safeTrustMetadata;
 if(MODAL_PHASES.has(modalPhase))result.modalPhase=modalPhase;
 if(modalDiagnostic)result.modal=modalDiagnostic;
 return result;
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
  let browser, completedRendererResult;
  const observations = [];
  try {
    const websocket = await exactOwnedWebSocket(endpoint);
    // Pass validated same-loopback WS directly: no library HTTP discovery or
    // redirects. Pinned Playwright WS transport still follows handshake redirects;
    // current owned vendor must not redirect. No universal transport fence claim.
    browser = await chromium.connectOverCDP(websocket, { timeout: 15000, noDefaults: true, artifactsDir: b.gate });
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
    const ALLOWED_MODALS = {
      'Review SoterAI changes before removal': ['Review restoration'],
      'Apply this terminal profile change to the selected project?': ['Use checked PowerShell profile', 'Restore previous terminal profile'],
      'Apply these reviewed editor associations only to the selected project?': ['Use masked environment editor', 'Restore project associations'],
      'Move these values into the encrypted vault and replace them with placeholders?': ['Migrate securely'],
      'Migrate 1 secret(s) from .env into the protected vault? An encrypted backup (outside the workspace) will be created.': ['Migrate & Backup'],
    };
    // Typed, non-secret snapshot: booleans and small integers only. Dialog text is
    // matched locally against the frozen set above and is never stored or returned.
    async function snapshotModal(step) {
      const raw = await page.evaluate(() => ({
        documentFocused: document.hasFocus(),
        texts: [...document.querySelectorAll('.monaco-dialog-box')].filter(e => e.getClientRects().length > 0).map(e => e.textContent || ''),
        quickInputVisible: [...document.querySelectorAll('.quick-input-widget')].some(e => e.getClientRects().length > 0),
      }));
      const keys = Object.keys(ALLOWED_MODALS);
      return {
        documentFocused: raw.documentFocused === true,
        visibleDialogCount: Math.min(raw.texts.length, 9),
        expectedIndex: keys.indexOf(step.contains),
        expectedTextPresent: raw.texts.some(text => text.includes(step.contains)),
        matchedAllowedIndex: keys.findIndex(key => raw.texts.some(text => text.includes(key))),
        quickInputVisible: raw.quickInputVisible === true,
      };
    }
    async function modalWait(phase, step, fn) {
      modalPhase = phase;
      try { return await fn(); }
      catch (error) {
        // Best effort only; a closed page must not mask the original failure.
        modalDiagnostic = await snapshotModal(step).catch(() => undefined);
        throw error;
      }
    }
    async function nativeModal(step) {
      const allowed = ALLOWED_MODALS;
      assert(Object.hasOwn(allowed, step.contains), 'Only frozen native dialogs are authorized');
      assert(step.cancel === true && step.button === undefined || allowed[step.contains].includes(step.button));
      await modalWait('WAIT_DIALOG_TEXT', step, () => until(async () => await dialog.isVisible() && (await dialog.innerText()).includes(step.contains),
        15000, 'Exact native dialog text not observed'));
      observations.push({ kind: 'native-modal', contains: step.contains, button: step.button ?? 'ESCAPE_CANCEL' });
      if (step.cancel === true) await page.keyboard.press('Escape');
      else { assert(typeof step.button === 'string'); await keyboardButton(step.button); }
      await modalWait('WAIT_DIALOG_CLOSE', step, () => until(async () => !await dialog.isVisible() || !(await dialog.innerText()).includes(step.contains),
        8000, 'Native modal did not finish or transition to the next actual review'));
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
    async function minimalOnboarding() {
      assert.equal(b.phase, 'primary');
      const original = JSON.parse(pin(b.product.manifest).toString('utf8'));
      const walkthrough = original.contributes.walkthroughs.filter(row => row.id === 'soterai.gettingStarted');
      assert.equal(walkthrough.length, 1); assert.equal(walkthrough[0].title, 'Get started with SoterAI Guard');
      const container = original.contributes.viewsContainers.activitybar.filter(row => row.id === 'soterai-explorer');
      const views = original.contributes.views['soterai-explorer'].filter(row => row.id === 'soterai-protection-coverage');
      assert.equal(container.length, 1); assert.equal(views.length, 1);
      const query = container[0].title + ': Focus on ' + views[0].name + ' View';
      let keyboardActions = 0, typedCharacters = 0;
      const press = async key => { keyboardActions++; await page.keyboard.press(key); };
      const visibleText = async text => {
        for (const item of await page.getByText(text, { exact: true }).all()) if (await item.isVisible()) return true;
        return false;
      };
      // Observe the genuinely automatic first-run walkthrough, never force it
      // through observer API or claim a hidden title as a visible wizard.
      await until(() => visibleText(walkthrough[0].title), 20000, 'Default native walkthrough not visible');
      await until(() => visibleText('See your first safety result'), 10000, 'Native first-step content not visible');
      await press('Control+Shift+P');
      const input = page.locator('.quick-input-widget input');
      await until(async () => await input.isVisible() && await input.evaluate(element => element === element.ownerDocument.activeElement),
        8000, 'Actual palette input must own focus');
      await press('Control+A'); keyboardActions++; typedCharacters += query.length + 1;
      await page.keyboard.type('>' + query, { delay: 4 });
      await until(async () => await input.inputValue() === '>' + query, 8000, 'Actual complete focus query differs');
      const widget = page.locator('.quick-input-widget');
      await until(async () => (await widget.innerText()).replace(/\s+/g, ' ').includes(query), 8000, 'Exact Coverage focus result missing');
      await press('Enter');
      const tree = await until(async () => {
        // Exact native pane ID first; unique actual accessible Coverage label is
        // the reviewed fallback used by existing F29 native-tree instrumentation.
        const candidates = [];
        for (const candidate of await page.locator('[role="tree"]').all()) {
          if (!await candidate.isVisible()) continue;
          const match = await candidate.evaluate(element => {
            const pane = element.closest('.pane');
            return pane?.id === 'soterai-protection-coverage' ||
              (element.getAttribute('aria-label') || '').trim() === 'Coverage' ||
              pane?.querySelector('.title-label')?.textContent?.trim() === 'Coverage';
          });
          if (match) candidates.push(candidate);
        }
        return candidates.length === 1 ? candidates[0] : undefined;
      }, 10000, 'One exact native Coverage tree required');
      await press('Home');
      let found = false;
      for (let index = 0; index < 64; index++) {
        const selected = await tree.evaluate(element => {
          const id = element.getAttribute('aria-activedescendant') || element.ownerDocument.activeElement?.getAttribute('aria-activedescendant');
          const row = id ? element.ownerDocument.getElementById(id) : element.querySelector('[role="treeitem"][aria-selected="true"]');
          return row?.textContent || row?.getAttribute('aria-label') || '';
        });
        if (selected.includes('Verify my setup')) { found = true; break; }
        await press('ArrowDown');
      }
      assert(found, 'Actual keyboard selection must reach Verify my setup');
      // Actual SetupVerification.ts has withProgress and no native confirmation.
      // Enter uses existing native tree action; no observer executeCommand call.
      await press('Enter');
      await until(async () => {
        const text = await tree.innerText();
        return text.includes('Synthetic checks: CURRENT') && text.includes('secret-matching: PASS (3/3)') &&
          text.includes('output-redactor: PASS (10/10)') && text.includes('gateway-loopback: NOT_TESTED (0/6)');
      }, 20000, 'Actual minimal synthetic self-check results not rendered');
      const elapsedMs = Date.now() - b.launchWallMs;
      assert(elapsedMs >= 0 && elapsedMs < 120000);
      return {
        elapsedMs, timedFrom: 'OWNED_CODE_SPAWN_WALL_CLOCK', walkthroughVisible: true,
        firstStepVisible: true, verifyInvokedBy: 'REAL_NATIVE_TREE_ENTER',
        syntheticChecks: 'CURRENT_3_OF_3_MATCHING_10_OF_10_OUTPUT_GATEWAY_NOT_TESTED',
        keyboardActions, typedCharacters,
        logicalPath: ['AUTOMATIC_NATIVE_WALKTHROUGH_OBSERVED', 'REAL_PALETTE_FOCUS_COVERAGE', 'REAL_TREE_VERIFY_SETUP_ENTER'],
        humanUsability: 'NOT_TESTED', fullOptionalWalkthrough: 'NOT_TESTED',
        adminPrompts: 'OUTER_NATIVE_OBSERVATION_REQUIRED', extraProductInstalls: 'OUTER_CLI_INVENTORY_REQUIRED',
      };
    }
    // Only trust UI for the exact owned synthetic workspace. Primary/restart
    // allow trust; untrusted chooses restricted mode. No workspace-trust flag bypass.
    observedStage='NATIVE_TRUST_UI';
    safeTrustMetadata=await page.evaluate(()=>({documentFocused:document.hasFocus(),visibleNativeDialogCount:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).length,trustWordsPresent:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).some(e=>/trust the authors/i.test(e.textContent||''))}));
    write(path.join(b.gate,b.phase+'-renderer-trust-before.json'),safeTrustMetadata);
    if (b.trustChoice) {
      assert(['Yes, I trust the authors', "No, I don't trust the authors"].includes(b.trustChoice));
      await until(async () => await dialog.isVisible() && /trust the authors/i.test(await dialog.innerText()),
        30000, 'Fresh synthetic trust dialog not observed');
      safeTrustMetadata=await page.evaluate(()=>({documentFocused:document.hasFocus(),visibleNativeDialogCount:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).length,trustWordsPresent:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).some(e=>/trust the authors/i.test(e.textContent||''))}));
      assert((await dialog.innerText()).includes(path.basename(b.workspace)));
      await keyboardButton(b.trustChoice);
      observations.push({ kind: 'native-initial-trust', choice: b.trustChoice });
      write(path.join(b.gate,b.phase+'-trust-choice.json'), {status:'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE',choice:b.trustChoice,workspaceName:path.basename(b.workspace),signalsRequested:0});
    }
    observedStage='NATIVE_PRODUCT_UI';
    let next = 1;
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline) {
      if (fs.existsSync(path.join(b.gate, b.phase + '-observer-failure.json'))) throw Error('Observer failed');
      if (fs.existsSync(path.join(b.gate, b.phase + '-observer-results.json'))) {
        completedRendererResult = {
          ...rendererCompletion(b),
          schemaVersion: 1, feature: 'F32', phase: b.phase, status: 'OBSERVED_REAL_KEYBOARD',
          observations, productPromptInterception: false, productApiReplacement: false,
          domActions: 'READ_ONLY_OBSERVATION', signalsRequested: 0,
        };
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
      let onboarding;
      for (const step of request.steps) {
        if (step.kind === 'optionalWorkspacePicker') await optionalFolderPicker();
        else if (step.kind === 'modal') await nativeModal(step);
        else if (step.kind === 'minimalOnboarding') onboarding = await minimalOnboarding();
        else throw Error('Unrecognized UI step refuses input');
      }
      write(requestFile + '.done.json', { status: 'OBSERVED_REAL_KEYBOARD', nonce: request.nonce,
        ...(onboarding ? { onboarding } : {}), signalsRequested: 0 });
      next++;
    }
    throw Error('Bounded renderer phase expired; no signals or retry');
  } finally {
    // connectOverCDP transport disconnect only. The product's normal Close owns
    // withdrawal; reviewed local Playwright core binding must verify this first.
    if (browser) await browser.close();
    // Publish only after the attach-only CDP transport has disconnected.
    if (completedRendererResult) write(path.join(b.gate, b.phase + '-renderer-results.json'), completedRendererResult);
  }
}
if (require.main === module) run().catch(error => {
  // No prompt text, raw result, synthetic value, exception message or stack.
  process.stderr.write(JSON.stringify({ feature: 'F32', status: 'FAIL_OR_INCOMPLETE_NO_RETRY',
    errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeRendererDiagnostic(error), signalsRequested: 0 }) + '\n');
  process.exitCode = 1;
});
module.exports = { run, safeRendererDiagnostic };
