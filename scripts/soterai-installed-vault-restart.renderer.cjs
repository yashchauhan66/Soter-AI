'use strict';
// Attach only to this newly launched isolated editor's ephemeral loopback CDP.
// Modal confirmations are answered by actual VS Code UI button clicks.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const vaultStages = [
  { name: 'vault-migrate-cancel', choice: 'cancel', button: 'Cancel', migration: true },
  { name: 'vault-migrate-approve', choice: 'migrate', button: 'Migrate securely', migration: true },
  { name: 'vault-restore-cancel', choice: 'cancel', button: 'Cancel', migration: false },
  { name: 'vault-restore-approve', choice: 'restore', button: 'Restore raw values', migration: false },
];
const migrationMessage = 'Move these values into the encrypted vault and replace them with placeholders?';
const restoreMessage = 'Restore raw values into this project file? AI tools and other same-user software may read them. Saved restrictions remain; this disclosure cannot recall other copies.';
const appRunMessage = 'Run this app with the selected vault variables?';
const noCanaries = text => !text.includes('BlueMango7!') && !text.includes('OrangeRiver9!');
async function until(test, budget = 20000) {
  const end = Date.now() + budget;
  while (Date.now() < end) { const value = await test(); if (value) return value; await delay(100); }
  throw Error('VAULT_RENDERER_TIMEOUT');
}
async function publishJSON(out, name, value) {
  if (!/^[A-Za-z0-9.-]+\.json$/.test(name)) throw Error('OUTPUT_NAME');
  const target = path.join(out, name), temporary = path.join(out, 'publish-' + randomUUID() + '.tmp');
  async function missing() {
    try { await fs.lstat(target); return false; }
    catch (error) { if (error.code === 'ENOENT') return true; throw error; }
  }
  if (!await missing()) throw Error('EVIDENCE_EXISTS');
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  if (!await missing()) throw Error('EVIDENCE_EXISTS');
  await fs.rename(temporary, target);
}
async function version(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/json/version', timeout: 3000, agent: false }, response => {
      let bytes = 0; const chunks = [];
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 65536) response.destroy(Error()); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => {
        try { if (response.statusCode !== 200 || !response.complete) throw Error(); resolve(JSON.parse(Buffer.concat(chunks))); }
        catch { reject(Error()); }
      });
    });
    request.on('timeout', () => request.destroy(Error())); request.on('error', reject);
  });
}
exports.run = async function (out, child) {
  if (typeof out !== 'string' || !path.isAbsolute(out) || !Number.isInteger(child.pid)) throw Error('VAULT_RENDERER_SCOPE');
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  if (prepared.schemaVersion !== 1 || !['vault', 'vault-app', 'vault-app-seed', 'vault-restart'].includes(prepared.suite) || !/^[a-f0-9]{32}$/.test(prepared.runNonce)) throw Error('VAULT_PREPARATION');
  const cohort = prepared.suite === 'vault-restart' ? path.resolve(prepared.cohortRoot) : out;
  if (prepared.suite === 'vault-restart') {
    const relative = path.relative(path.dirname(out), cohort);
    if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep) || cohort === out) throw Error('COHORT_SCOPE');
  }
  const appStages = [...vaultStages.slice(0, 2),
    { name: 'vault-app-configure', choice: 'configure' }, { name: 'vault-app-run', choice: 'run', button: 'Run selected app', appRun: true },
    { name: 'vault-app-output', choice: 'verify-output' }, ...vaultStages.slice(2)];
  const stages = prepared.suite === 'vault-restart' ? [appStages[3], appStages[4], ...vaultStages.slice(2)]
    : prepared.suite === 'vault-app-seed' ? appStages.slice(0, 5) : prepared.suite === 'vault-app' ? appStages : vaultStages;
  let browser, page, currentStage = 'attach', currentWait = 'CDP_ENDPOINT';
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_UI', suite: prepared.suite, artifactSha256: prepared.artifactSha256,
    runNonce: prepared.runNonce, stages: [], productApiMocked: false, normalProfileAttached: false };
  try {
    const portFile = path.join(cohort, 'profile/user-data/DevToolsActivePort');
    const endpoint = await until(async () => {
      if (child.exitCode !== null || child.signalCode !== null) throw Error('EDITOR_CLOSED');
      try {
        const stat = await fs.lstat(portFile); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024) throw Error('PORT_FILE');
        const rows = (await fs.readFile(portFile, 'utf8')).trim().split(/\r?\n/), port = Number(rows[0]);
        if (rows.length !== 2 || !Number.isInteger(port) || port < 1024 || port > 65535 || !/^\/devtools\/browser\/[a-f0-9-]+$/i.test(rows[1])) throw Error('PORT_FORMAT');
        const meta = await version(port), url = new URL(meta.webSocketDebuggerUrl);
        if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== port || url.pathname !== rows[1]
          || url.search || url.hash || url.username || url.password) throw Error('ENDPOINT_SCOPE');
        return url.href;
      } catch (error) { if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') return false; throw error; }
    });
    browser = await chromium.connectOverCDP(endpoint, { timeout: 15000, noDefaults: true });
    currentWait = 'WORKBENCH_PAGE';
    page = await until(() => {
      const pages = browser.contexts().flatMap(context => context.pages()).filter(page => /^vscode-file:\/\/vscode-app\//.test(page.url()));
      if (pages.length > 1) throw Error('AMBIGUOUS_EDITOR'); return pages[0];
    });
    page.setDefaultTimeout(15000);
    currentWait = 'WORKBENCH_DOM';
    await page.locator('.monaco-workbench').waitFor();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.bringToFront();
    await publishJSON(out, 'renderer-ready.json', { schemaVersion: 1, status: 'READY', suite: prepared.suite,
      runNonce: prepared.runNonce, editorPid: child.pid, ephemeralLoopback: true });
    async function quickInput(title, placeholder, budget = 20000) {
      await page.bringToFront();
      const quick = page.locator('.quick-input-widget:visible');
      await until(async () => {
        const count = await quick.count(); if (count > 1) throw Error('AMBIGUOUS_QUICK_INPUT');
        if (!count) return false;
        return title ? (await quick.locator('.quick-input-title').textContent())?.trim() === title
          : await quick.locator('.quick-input-box input').getAttribute('placeholder') === placeholder;
      }, budget);
      return quick;
    }
    async function beginInputTrace() {
      await page.evaluate(() => {
        if (window.__soteraiVaultInputTrace) throw Error('TRACE_EXISTS');
        const widget = document.querySelector('.quick-input-widget'), events = [], started = performance.now();
        let previousState = '';
        function record(type, event) {
          if (events.length >= 256) return;
          const title = widget?.querySelector('.quick-input-title')?.textContent?.trim();
          const input = widget?.querySelector('.quick-input-box input');
          const state = {
            widgetVisible: !!widget?.getClientRects().length, widgetInert: !!widget?.inert,
            argumentsTitleMatched: title === 'Optional public app arguments',
            variablesPlaceholderMatched: input?.getAttribute('placeholder') === 'Select only the variables this app should receive',
            inputFocused: document.activeElement === input, documentFocused: document.hasFocus(),
          };
          const signature = JSON.stringify(state);
          if (type === 'WIDGET_STATE' && signature === previousState) return;
          previousState = signature;
          events.push({ elapsedMs: Math.round(performance.now() - started), type,
            ...(event?.type === 'keydown' || event?.type === 'keyup' ? { key: event.key === 'Enter' ? 'ENTER' : event.key === 'Escape' ? 'ESCAPE' : 'OTHER' } : {}),
            ...state });
        }
        const subscriptions = [];
        for (const type of ['keydown', 'keyup', 'focusin', 'focusout']) {
          const listener = event => record(type.toUpperCase(), event);
          document.addEventListener(type, listener, { capture: true, passive: true });
          subscriptions.push(() => document.removeEventListener(type, listener, true));
        }
        for (const type of ['focus', 'blur']) {
          const listener = event => record('WINDOW_' + type.toUpperCase(), event);
          window.addEventListener(type, listener, { passive: true });
          subscriptions.push(() => window.removeEventListener(type, listener));
        }
        const observer = new MutationObserver(() => record('WIDGET_STATE'));
        if (widget) observer.observe(widget, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class', 'inert', 'placeholder'] });
        record('TRACE_STARTED');
        window.__soteraiVaultInputTrace = { stop() {
          observer.disconnect(); for (const unsubscribe of subscriptions) unsubscribe(); record('TRACE_STOPPED');
          return { readonlyInstrumentation: true, inputValuesRecorded: false, events };
        } };
      });
    }
    async function finishInputTrace() {
      const trace = await page.evaluate(() => window.__soteraiVaultInputTrace?.stop());
      if (trace && !result.inputTransitionTrace) {
        result.inputTransitionTrace = trace;
        await publishJSON(out, 'ui-input-transition.json', { schemaVersion: 1, runNonce: prepared.runNonce, ...trace });
      }
    }
    async function configurationStep(ordinal, state, realUiInteraction) {
      result.configurationSteps ??= [];
      result.configurationSteps.push({ state, realUiInteraction });
      result.lastConfigurationStep = state;
      await publishJSON(out, `ui-config-${ordinal}-${result.configurationSteps.length}.json`, {
        schemaVersion: 1, runNonce: prepared.runNonce, ordinal, state, realUiInteraction,
      });
    }
    async function selectFile(title, basename) {
      currentWait = 'APP_FILE_PICKER';
      const quick = await quickInput(title), input = quick.locator('.quick-input-box input:visible');
      if (await input.count() !== 1) throw Error('FILE_INPUT_UNAVAILABLE');
      const label = quick.locator('.quick-input-list .monaco-list-row .label-name').filter({ hasText: new RegExp('^' + basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
      // The isolated default folder is workspace. Wait for SimpleFileDialog's
      // initial asynchronous updateItems to finish before entering a file path.
      currentWait = 'APP_INITIAL_FILE_LIST';
      await until(async () => await label.count() === 1);
      const filePath = path.join(out, 'workspace', basename);
      await input.fill(filePath);
      currentWait = 'APP_FILE_PATH';
      await until(async () => {
        const currentPath = await input.inputValue();
        return await label.count() === 1 && await input.isEditable() && path.resolve(currentPath).toLowerCase() === filePath.toLowerCase();
      });
      await page.bringToFront();
      await input.press('Enter');
      await until(async () => await quick.locator('.quick-input-title').textContent().catch(() => '') !== title);
    }
    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index]; currentStage = stage.name;
      currentWait = 'STAGE_REQUEST';
      const request = await until(async () => {
        if (child.exitCode !== null || child.signalCode !== null) throw Error('EDITOR_CLOSED');
        try { return JSON.parse(await fs.readFile(path.join(out, `ui-request-${index + 1}.json`), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
      if (request.schemaVersion !== 1 || request.runNonce !== prepared.runNonce || request.ordinal !== index + 1
        || request.stage !== stage.name || request.choice !== stage.choice) throw Error('UNKNOWN_STAGE');
      const ackDetails = {};
      if (stage.name === 'vault-app-configure') {
        await selectFile('Choose a trusted project Node app', 'app-check.cjs');
        ackDetails.programFileSelected = true;
        await configurationStep(index + 1, 'PROGRAM_FILE_ACCEPTED', true);
        await selectFile('Choose an already migrated .env file', '.env');
        ackDetails.sourceFileSelected = true;
        await configurationStep(index + 1, 'SOURCE_FILE_ACCEPTED', true);
        currentWait = 'APP_VARIABLE_PICKER';
        const quick = await quickInput(undefined, 'Select only the variables this app should receive');
        const rows = quick.locator('.quick-input-list .monaco-list-row');
        await until(async () => await rows.count() === 2);
        for (const name of ['DB_PASSWORD', 'API_PASSWORD']) {
          const row = rows.filter({ has: page.getByText(name, { exact: true }) });
          if (await row.count() !== 1) throw Error('VARIABLE_ROW_UNAVAILABLE');
          const checkbox = row.getByRole('checkbox');
          if (await checkbox.count() !== 1 || await checkbox.getAttribute('aria-checked') !== 'true') throw Error('VARIABLE_NOT_SELECTED');
        }
        await configurationStep(index + 1, 'EXPECTED_VARIABLES_PRESELECTED', false);
        const controls = await quick.locator('button, a[role="button"]').evaluateAll(items => items.filter(item => item.getClientRects().length).map(item => ({
          tag: item.tagName, role: item.getAttribute('role') === 'button' ? 'BUTTON' : 'OTHER',
          label: item.textContent?.trim() === 'OK' ? 'OK' : 'OTHER', type: item.getAttribute('type') === 'button' ? 'BUTTON' : 'OTHER',
        })));
        await publishJSON(out, `ui-config-controls-${index + 1}.json`, { schemaVersion: 1, runNonce: prepared.runNonce, controls });
        const acceptSelection = quick.getByRole('button', { name: 'OK', exact: true });
        if (await acceptSelection.count() !== 1) throw Error('VARIABLE_OK_CONTROL_UNAVAILABLE');
        await beginInputTrace();
        await page.bringToFront();
        await acceptSelection.click();
        ackDetails.selectedVariableCount = 2;
        await configurationStep(index + 1, 'VARIABLE_SELECTION_ACCEPTED', true);
        currentWait = 'APP_ARGUMENTS_INPUT';
        const argumentsInput = await quickInput('Optional public app arguments', undefined, 12000);
        await configurationStep(index + 1, 'ARGUMENTS_INPUT_VISIBLE', false);
        const literal = argumentsInput.locator('.quick-input-box input:visible');
        await literal.fill('[]');
        await configurationStep(index + 1, 'PUBLIC_ARGUMENTS_ENTERED', true);
        await page.bringToFront();
        await literal.press('Enter');
        await until(async () => await page.locator('.quick-input-widget:visible').count() === 0);
        ackDetails.publicArgumentsAccepted = true;
        await configurationStep(index + 1, 'PUBLIC_ARGUMENTS_ACCEPTED', true);
        await finishInputTrace();
      } else if (stage.name === 'vault-app-output') {
        if (request.awaitRendererReady !== true) throw Error('OUTPUT_HANDSHAKE_REQUIRED');
        const needsPid = prepared.suite === 'vault-app-seed' || prepared.suite === 'vault-restart';
        if (needsPid && (!Number.isInteger(request.expectedOwnedPid) || request.expectedOwnedPid <= 0)) throw Error('OUTPUT_PID_REQUIRED');
        currentWait = 'TASK_TERMINAL_RENDERER_READY';
        await page.bringToFront();
        const screen = page.locator('.terminal-xterm-host .xterm-screen:visible');
        await until(async () => {
          const count = await screen.count(); if (count > 1) throw Error('AMBIGUOUS_TASK_TERMINAL'); return count === 1;
        });
        await screen.click({ position: { x: 5, y: 5 } });
        await page.waitForFunction(() => document.hasFocus() && !!document.activeElement?.closest('.terminal-xterm-host'), undefined, { timeout: 12000 });
        const stable = await page.evaluate(async () => {
          const ready = () => document.hasFocus() && !!document.activeElement?.closest('.terminal-xterm-host');
          if (!ready()) return false;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return ready();
        });
        if (!stable) throw Error('TASK_TERMINAL_FOCUS_UNSTABLE');
        await publishJSON(out, `ui-ready-${index + 1}.json`, { schemaVersion: 1, runNonce: prepared.runNonce, ordinal: index + 1,
          stage: stage.name, status: 'READY', taskTerminalPainted: true, pageFocused: true });
        // Host invokes the native popup only after this ready receipt. No page
        // activation, focus, click or keyboard action occurs until output proof.
        currentWait = 'NATIVE_TERMINAL_ACCESSIBLE_OUTPUT';
        // The context host contains an absolutely positioned .accessible-view
        // editor. Target the editor's actual box rather than its outer host.
        const accessible = page.locator('.accessible-view:visible:not(.hide)');
        await until(async () => {
          const count = await accessible.count(); if (count > 1) throw Error('AMBIGUOUS_ACCESSIBLE_VIEW');
          if (!count) return false;
          const text = await accessible.locator('.view-lines').innerText();
          if (!noCanaries(text) || text.includes('VAULT_APP_OK=false') || text.includes('Managed application output withheld.')) throw Error('APP_OUTPUT_FAILED');
          const lines = text.split(/\r?\n/).map(line => line.trim());
          return lines.includes('VAULT_APP_OK=true') && (!needsPid || lines.includes('VAULT_APP_PID=' + request.expectedOwnedPid));
        });
        ackDetails.fixedOutputSuccessMatched = true;
        ackDetails.fixedOutputFailureMatched = false;
        ackDetails.outputSource = 'native-terminal-accessible-view';
        if (needsPid) { ackDetails.currentOwnedPidMatched = true; ackDetails.expectedOwnedPid = request.expectedOwnedPid; }
        result.appOutputVerified = true;
        await page.keyboard.press('Escape');
        await until(async () => await accessible.count() === 0);
      } else {
      const message = stage.appRun ? appRunMessage : stage.migration ? migrationMessage : restoreMessage;
      const dialog = page.locator('.monaco-dialog-box:visible').filter({ hasText: message });
      currentWait = 'EXPECTED_MODAL';
      await until(async () => {
        const count = await dialog.count(); if (count > 1) throw Error('AMBIGUOUS_DIALOG'); return count === 1;
      });
      const renderedText = await dialog.innerText();
      currentWait = 'REVIEW_METADATA';
      if (!noCanaries(renderedText) || !stage.appRun && !renderedText.includes('.env')) throw Error('UNSAFE_DIALOG');
      if (stage.migration && (!renderedText.includes('DB_PASSWORD') || !renderedText.includes('API_PASSWORD')
        || !/"count"\s*:\s*2\b/.test(renderedText))) throw Error('MIGRATION_REVIEW_MISSING');
      if (stage.appRun && (!renderedText.includes('app-check.cjs') || !renderedText.includes('DB_PASSWORD') || !renderedText.includes('API_PASSWORD'))) throw Error('APP_RUN_REVIEW_MISSING');
      const button = dialog.getByRole('button', { name: stage.button, exact: true });
      currentWait = 'EXACT_BUTTON';
      if (await button.count() !== 1) throw Error('CHOICE_CONTROL_UNAVAILABLE');
      const controls = await dialog.locator('button, a[role="button"]').evaluateAll(items => items.map(item => ({
        tag: item.tagName, label: item.getAttribute('aria-label'), title: item.getAttribute('title'), text: item.textContent?.slice(0, 80),
      })));
      if (!noCanaries(JSON.stringify(controls))) throw Error('UNSAFE_CONTROLS');
      await publishJSON(out, `ui-controls-${index + 1}.json`, { stage: stage.name, controls });
      await button.click();
      currentWait = 'MODAL_DISMISSAL';
      await until(async () => await dialog.count() === 0);
      }
      await publishJSON(out, `ui-step-${index + 1}.json`, { schemaVersion: 1, runNonce: prepared.runNonce,
        ordinal: index + 1, stage: stage.name, status: 'PASS', action: stage.choice, realUiInteraction: true, ...ackDetails });
      result.stages.push({ stage: stage.name, status: 'PASS' });
    }
    result.status = 'PASS_NATIVE_UI';
  } catch (error) {
    const failureCodes = new Set(['VAULT_RENDERER_TIMEOUT', 'EDITOR_CLOSED', 'PORT_FILE', 'PORT_FORMAT', 'ENDPOINT_SCOPE',
      'AMBIGUOUS_EDITOR', 'UNKNOWN_STAGE', 'AMBIGUOUS_DIALOG', 'UNSAFE_DIALOG', 'MIGRATION_REVIEW_MISSING', 'CHOICE_CONTROL_UNAVAILABLE', 'UNSAFE_CONTROLS',
      'AMBIGUOUS_QUICK_INPUT', 'FILE_INPUT_UNAVAILABLE', 'VARIABLE_ROW_UNAVAILABLE', 'VARIABLE_NOT_SELECTED', 'VARIABLE_OK_CONTROL_UNAVAILABLE', 'APP_RUN_REVIEW_MISSING', 'AMBIGUOUS_ACCESSIBLE_VIEW', 'APP_OUTPUT_FAILED',
      'OUTPUT_HANDSHAKE_REQUIRED', 'OUTPUT_PID_REQUIRED', 'AMBIGUOUS_TASK_TERMINAL', 'TASK_TERMINAL_FOCUS_UNSTABLE']);
    result.failedStage = currentStage;
    result.failureCode = failureCodes.has(error?.message) ? error.message : error?.name === 'TimeoutError' ? 'PLAYWRIGHT_TIMEOUT'
      : typeof error?.message === 'string' && error.message.includes('strict mode violation') ? 'PLAYWRIGHT_STRICT_MODE' : 'UNEXPECTED_RENDERER_FAILURE';
    result.failureClass = error?.name === 'TimeoutError' ? 'TIMEOUT' : error?.name === 'Error' ? 'ERROR' : 'OTHER';
    result.lastWait = currentWait;
    try {
      if (page && !result.inputTransitionTrace) {
        const trace = await page.evaluate(() => window.__soteraiVaultInputTrace?.stop());
        if (trace) {
          result.inputTransitionTrace = trace;
          await publishJSON(out, 'ui-input-transition.json', { schemaVersion: 1, runNonce: prepared.runNonce, ...trace });
        }
      }
    } catch { result.inputTransitionTraceUnavailable = true; }
    // Record fixed booleans/counts only. No dialog/notification body, source,
    // clipboard or provider values are copied into failure evidence.
    try {
      if (page) result.failureSnapshot = await page.evaluate(({ migrationMessage, restoreMessage, appRunMessage }) => {
        const dialogs = [...document.querySelectorAll('.monaco-dialog-box')].filter(item => item.getClientRects().length);
        const notices = [...document.querySelectorAll('.notification-list-item')].filter(item => item.getClientRects().length);
        const dialogText = dialogs.map(item => item.textContent || ''), noticeText = notices.map(item => item.textContent || '');
        return {
          visibleDialogCount: Math.min(dialogs.length, 100), visibleNoticeCount: Math.min(notices.length, 100),
          migrationMessageMatched: dialogText.some(text => text.includes(migrationMessage)),
          restoreMessageMatched: dialogText.some(text => text.includes(restoreMessage)),
          maskedMarkerMatched: dialogText.some(text => text.includes('[MASKED]')),
          envFixtureNameMatched: dialogText.some(text => text.includes('.env')),
          expectedVariableNamesMatched: dialogText.some(text => text.includes('DB_PASSWORD') && text.includes('API_PASSWORD')),
          countTwoMatched: dialogText.some(text => /"count"\s*:\s*2\b/.test(text)),
          cancelControlMatched: dialogs.some(item => [...item.querySelectorAll('button, a[role="button"]')].some(button => button.textContent?.trim() === 'Cancel')),
          vaultWithheldNoticeMatched: noticeText.some(text => text.includes('Vault operation withheld. Encrypted recovery is retained.')),
          rawSourceStartupNoticeMatched: noticeText.some(text => text.includes('[SoterAI]') && text.includes('secret')),
          appRunMessageMatched: dialogText.some(text => text.includes(appRunMessage)),
          visibleQuickInputCount: Math.min([...document.querySelectorAll('.quick-input-widget')].filter(item => item.getClientRects().length).length, 100),
          appFilePickerTitleMatched: [...document.querySelectorAll('.quick-input-title')].some(item => item.textContent?.trim() === 'Choose a trusted project Node app'),
          envFilePickerTitleMatched: [...document.querySelectorAll('.quick-input-title')].some(item => item.textContent?.trim() === 'Choose an already migrated .env file'),
          appArgumentsTitleMatched: [...document.querySelectorAll('.quick-input-title')].some(item => item.textContent?.trim() === 'Optional public app arguments'),
          visibleAccessibleViewCount: Math.min([...document.querySelectorAll('.accessible-view-container')].filter(item => item.getClientRects().length).length, 100),
          accessibleViewHostCount: Math.min(document.querySelectorAll('.accessible-view-container').length, 100),
          accessibleViewEditorCount: Math.min(document.querySelectorAll('.accessible-view').length, 100),
          accessibleViewEditorBoxCount: Math.min([...document.querySelectorAll('.accessible-view')].filter(item => {
            const box = item.getBoundingClientRect(); return box.width > 0 && box.height > 0 && !item.classList.contains('hide');
          }).length, 100),
          accessibleViewHiddenClassMatched: [...document.querySelectorAll('.accessible-view')].some(item => item.classList.contains('hide')),
          accessibleViewDisplayNoneMatched: [...document.querySelectorAll('.accessible-view')].some(item => getComputedStyle(item).display === 'none'),
          accessibleViewLineContainerCount: Math.min(document.querySelectorAll('.accessible-view .view-lines').length, 100),
          taskTerminalFocused: !!document.activeElement?.closest('.terminal-xterm-host'),
          pageFocused: document.hasFocus(),
          actualTerminalScreenCount: Math.min([...document.querySelectorAll('.terminal-xterm-host .xterm-screen')].filter(item => {
            const box = item.getBoundingClientRect(); return box.width > 0 && box.height > 0;
          }).length, 100),
          accessibleOutputSuccessMatched: [...document.querySelectorAll('.accessible-view .view-line')].some(item =>
            item.textContent?.trim() === 'VAULT_APP_OK=true'),
          accessibleOutputFailureMatched: [...document.querySelectorAll('.accessible-view .view-lines')].some(item =>
            item.textContent?.includes('VAULT_APP_OK=false') || item.textContent?.includes('Managed application output withheld.')),
        };
      }, { migrationMessage, restoreMessage, appRunMessage });
    } catch { result.failureSnapshotUnavailable = true; }
    try {
      if (page) {
        const safeVisibleUi = await page.evaluate(() => {
          const visibleText = document.body.innerText;
          return !visibleText.includes('BlueMango7!') && !visibleText.includes('OrangeRiver9!');
        });
        result.failureScreenshotSafeUiVerified = safeVisibleUi;
        if (safeVisibleUi) {
          const screenshot = path.join(out, 'ui-failure.png');
          let exists = true; try { await fs.lstat(screenshot); } catch (error) { if (error.code !== 'ENOENT') throw error; exists = false; }
          if (!exists) { await page.screenshot({ path: screenshot }); result.failureScreenshotCaptured = true; }
        }
      }
    } catch { result.failureScreenshotUnavailable = true; }
    throw Error('NATIVE_VAULT_UI_FAILED');
  }
  finally {
    // CDP attachment is disconnected; no ordinary editor window is attached.
    try { if (browser) await browser.close(); } catch { /* The isolated editor may already have closed. */ }
    await publishJSON(out, 'renderer-result.json', result);
  }
};
