'use strict';
// Real native input boxes/modal buttons and isolated Cline webview observations.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const delay = ms => new Promise(done => setTimeout(done, ms));
const upstreamKey = 'TEST_ONLY_CLINE_UPSTREAM_PROVIDER';
async function publish(file, value) {
  try { await fs.lstat(file); throw Error('EVIDENCE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staged = file + '.staged', bytes = Buffer.from(JSON.stringify(value) + '\n');
  await fs.writeFile(staged, bytes, { flag: 'wx', mode: 0o600 });
  const before = await fs.lstat(staged);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== bytes.length) throw Error('EVIDENCE_SCOPE');
  try { await fs.lstat(file); throw Error('EVIDENCE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(staged, file);
  const after = await fs.lstat(file);
  if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1 || after.ino !== before.ino || after.size !== bytes.length) throw Error('EVIDENCE_SCOPE');
}
async function until(work, budget = 25000) {
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) { const result = await work(); if (result) return result; await delay(100); }
  throw Error('CLINE_RENDERER_TIMEOUT');
}
async function meta(port) {
  return new Promise((done, fail) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/json/version', agent: false, timeout: 3000 }, response => {
      let bytes = 0; const chunks = [];
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 65536) response.destroy(Error()); else chunks.push(chunk); });
      response.on('error', fail); response.on('end', () => { try { if (response.statusCode !== 200 || !response.complete) throw Error(); done(JSON.parse(Buffer.concat(chunks))); } catch { fail(Error()); } });
    });
    request.on('timeout', () => request.destroy(Error())); request.on('error', fail);
  });
}
exports.run = async function (out, child) {
  if (typeof out !== 'string' || !path.isAbsolute(out) || !Number.isInteger(child.pid)) throw Error('CLINE_RENDERER_SCOPE');
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  if (prepared.schemaVersion !== 1 || prepared.suite !== 'cline' || !/^[a-f0-9]{32}$/.test(prepared.runNonce)
    || !['legacy-refusal', 'setup-loopback', 'agentrouter', 'cline-free', 'setup-canaries', 'setup-attachment'].includes(prepared.clineScenario)) throw Error('CLINE_PREPARATION');
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_UI', suite: 'cline', clineScenario: prepared.clineScenario,
    artifactSha256: prepared.artifactSha256, runNonce: prepared.runNonce, stages: [], normalProfileAttached: false,
    productApiMocked: false, vendorApiMocked: false, taskCompletionCertified: false };
  let browser, page, boundary = 'ATTACH', traceTimer, traceOrdinal = 0;
  const tracePublications = [];
  async function inputSnapshot() {
    if (!page) return { pageAvailable: false };
    return page.evaluate(() => {
      const visible = element => !!element.getClientRects().length;
      const titles = ['OpenAI-compatible upstream endpoint', 'Anthropic-compatible upstream endpoint', 'Provider API key (stored in SecretStorage)'];
      const placeholders = ['https://api.openai.com/v1/chat/completions', 'https://api.anthropic.com/v1/messages'];
      const matched = (value, choices) => choices.map(choice => String(value || '').includes(choice));
      const widgets = [...document.querySelectorAll('.quick-input-widget')].slice(0, 8);
      const dialogs = [...document.querySelectorAll('.monaco-dialog-box')].filter(visible).slice(0, 8);
      return { pageAvailable: true, documentFocused: document.hasFocus(),
        visibleQuickInputCount: widgets.filter(visible).length, quickInputs: widgets.map(widget => ({ visible: visible(widget),
          titleMatches: matched(widget.querySelector('.quick-input-title')?.textContent, titles),
          messageMatches: matched(widget.querySelector('.quick-input-message')?.textContent, titles),
          bodyMatches: matched(widget.textContent, titles), inputCount: Math.min(widget.querySelectorAll('input').length, 8),
          inputs: [...widget.querySelectorAll('input')].slice(0, 8).map(input => ({ visible: visible(input),
            password: input.getAttribute('type') === 'password', inputClassMatched: input.classList.contains('input'),
            titleMatches: matched(input.getAttribute('title'), titles), ariaMatches: matched(input.getAttribute('aria-label'), titles),
            placeholderMatches: matched(input.getAttribute('placeholder'), placeholders) })) })),
        visibleModalCount: dialogs.length, modalMatches: dialogs.map(dialog => ({
          clineSetup: dialog.textContent?.includes('Review pinned Cline setup') === true,
          safeReadConsent: dialog.textContent?.includes('Allow one safe read') === true,
          scopedRoutingConsent: dialog.textContent?.includes('Apply scoped routing changes') === true,
          restoreConsent: dialog.textContent?.includes('Review pinned Cline restoration') === true })) };
    });
  }
  try {
    const endpoint = await until(async () => {
      if (child.exitCode !== null || child.signalCode !== null) throw Error('EDITOR_CLOSED');
      try {
        const file = path.join(out, 'profile/user-data/DevToolsActivePort'), stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024) throw Error('PORT_FILE');
        const rows = (await fs.readFile(file, 'utf8')).trim().split(/\r?\n/), port = Number(rows[0]);
        if (rows.length !== 2 || !Number.isInteger(port) || port < 1024 || port > 65535 || !/^\/devtools\/browser\/[a-f0-9-]+$/i.test(rows[1])) throw Error('PORT_FORMAT');
        const json = await meta(port), url = new URL(json.webSocketDebuggerUrl);
        if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== port || url.pathname !== rows[1]
          || url.search || url.hash || url.username || url.password) throw Error('CDP_SCOPE');
        return url.href;
      } catch (error) { if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') return false; throw error; }
    });
    browser = await chromium.connectOverCDP(endpoint, { timeout: 15000, noDefaults: true });
    page = await until(() => {
      const pages = browser.contexts().flatMap(context => context.pages()).filter(page => /^vscode-file:\/\/vscode-app\//.test(page.url()));
      if (pages.length > 1) throw Error('AMBIGUOUS_EDITOR'); return pages[0];
    });
    page.setDefaultTimeout(15000); await page.locator('.monaco-workbench').waitFor(); await page.bringToFront();
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.evaluate(() => {
      const records = [], limit = 256;
      let overflow = false, escapeSeen = false, lastState;
      const titles = ['OpenAI-compatible upstream endpoint', 'Anthropic-compatible upstream endpoint', 'Provider API key (stored in SecretStorage)'];
      const names = ['openai', 'anthropic', 'key'];
      const visible = element => !!element?.getClientRects().length;
      const elementKind = element => {
        if (!(element instanceof Element)) return 'NONE';
        if (element.tagName === 'IFRAME') return 'IFRAME';
        if (element.closest('.quick-input-widget')) return 'QUICK_INPUT';
        if (element.tagName === 'TEXTAREA') return 'EDITOR_TEXTAREA';
        return 'OTHER';
      };
      const state = () => {
        const widget = document.querySelector('.quick-input-widget');
        const title = widget?.querySelector('.quick-input-title')?.textContent || '';
        const field = names[titles.findIndex(value => title.includes(value))] || 'NONE';
        return { field, widgetVisible: visible(widget), password: widget?.querySelector('input')?.getAttribute('type') === 'password',
          activeElementKind: elementKind(document.activeElement), documentFocused: document.hasFocus() };
      };
      const record = (kind, target, related) => {
        if (records.length >= limit) { overflow = true; return; }
        records.push({ ordinal: records.length + 1, tick: Math.round(performance.now()), kind, ...state(),
          eventTargetKind: elementKind(target), relatedTargetKind: elementKind(related) });
      };
      for (const name of ['focusin', 'focusout']) document.addEventListener(name, event => record(name.toUpperCase(), event.target, event.relatedTarget), true);
      for (const name of ['focus', 'blur']) window.addEventListener(name, event => {
        if (event.target === window) record('WINDOW_' + name.toUpperCase(), undefined, undefined);
      }, true);
      for (const name of ['keydown', 'keyup']) document.addEventListener(name, event => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        if (event.key === 'Escape') escapeSeen = true;
        record(event.key.toUpperCase() + '_' + name.toUpperCase(), event.target, undefined);
      }, true);
      new MutationObserver(mutations => {
        if (!mutations.some(item => item.target instanceof Element && item.target.closest('.quick-input-widget')
          || item.target.parentElement?.closest('.quick-input-widget'))) return;
        const current = JSON.stringify(state());
        if (current !== lastState) { lastState = current; record('WIDGET_STATE', undefined, undefined); }
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'type'], characterData: true });
      globalThis.__soteraiClineTraceNote = kind => record(kind, undefined, undefined);
      globalThis.__soteraiClineTraceRead = () => ({ records: records.slice(), overflow, escapeSeen, recordsContainInputValues: false });
      record('TRACE_READY', undefined, undefined);
    });
    // Preserve complete bounded observations before a failed host closes the
    // window. Each snapshot is create-only and contains no input values.
    traceTimer = setInterval(() => {
      if (boundary !== 'cline-configure-broker' || !result.inputStages || traceOrdinal >= 80) return;
      const ordinal = ++traceOrdinal;
      const publication = Promise.race([page.evaluate(() => globalThis.__soteraiClineTraceRead()),
        delay(2000).then(() => { throw Error('TRACE_TIMEOUT'); })]).then(trace => publish(path.join(out, `ui-input-trace-${String(ordinal).padStart(3, '0')}.json`),
          { schemaVersion: 1, runNonce: prepared.runNonce, ordinal, trace })).catch(() => {});
      tracePublications.push(publication);
    }, 500);
    await publish(path.join(out, 'renderer-ready.json'), { schemaVersion: 1, status: 'READY', suite: 'cline',
      runNonce: prepared.runNonce, editorPid: child.pid, ephemeralLoopback: true });
    if (prepared.clineScenario === 'legacy-refusal') {
      boundary = 'REFUSAL_HOST_REPORT';
      await until(async () => { try {
        const report = JSON.parse(await fs.readFile(path.join(out, 'host-result.json'), 'utf8'));
        if (report.status === 'FAIL_NATIVE_CLINE') throw Error('NATIVE_HOST_FAILED');
        return report.status === 'PASS_NATIVE_CLINE_LEGACY_REFUSAL';
      } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }, 45000);
      result.status = 'PASS_NATIVE_UI'; return;
    }
    if (prepared.waitForLogin) await page.bringToFront();
    const stages = prepared.clineScenario === 'cline-free' ? ['cline-select-free-model','cline-public-reply'] : ['cline-configure-broker', 'cline-setup-cancel', 'cline-setup-apply', 'cline-public-reply'];
    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index]; boundary = stage;
      const request = await until(async () => {
        if (child.exitCode !== null || child.signalCode !== null) throw Error('EDITOR_CLOSED');
        try { return JSON.parse(await fs.readFile(path.join(out, `ui-request-${index + 1}.json`), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      }, index === 0 ? prepared.waitForLogin ? 570000 : 45000 : 25000);
      if (request.schemaVersion !== 1 || request.stage !== stage || request.ordinal !== index + 1 || request.runNonce !== prepared.runNonce) throw Error('UNKNOWN_STAGE');
      if (stage === 'cline-select-free-model') {
        if(request.freeModel!=='cline-free/solar-mini4')throw Error('CONTROL_SCOPE');
        const frame=await until(async()=>{for(const f of page.frames()){try{if(await f.getByTitle('Open API Settings',{exact:true}).isVisible()||await f.getByTestId('tab-settings').isVisible())return f;}catch{}}});
        const apiSettings=frame.getByTitle('Open API Settings',{exact:true});
        if(await apiSettings.isVisible())await apiSettings.click();else await frame.getByTestId('tab-settings').click();
        await page.screenshot({path:path.join(out,'profile/free-model-settings.png')});
        result.freeModelControls=await frame.evaluate(()=>({inputs:[...document.querySelectorAll('input,select,vscode-text-field')].map(e=>({tag:e.tagName,id:e.id,placeholder:e.getAttribute('placeholder')})),
          selects:[...document.querySelectorAll('select')].map(e=>({id:e.id,options:[...e.options].map(o=>({text:o.text,value:o.value}))}))}));
        const picker=frame.locator('select#provider-model-picker');
        if(await picker.isVisible())await picker.selectOption(request.freeModel);
        else{
          const search=frame.locator('#model-search').locator('input');
          await search.waitFor({state:'visible',timeout:15000});await search.fill('solar');
          const choices=frame.getByText(/^(Solar Mini 4|cline-free\/solar-mini4)$/).filter({visible:true});
          await choices.first().waitFor({state:'visible',timeout:15000});await choices.first().click();
        }
        const done=frame.getByRole('button',{name:'Done',exact:true});if(await done.isVisible())await done.click();
      } else if (stage === 'cline-configure-broker') {
        const url = new URL(request.providerUrl);
        if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/v1/chat/completions'
          || url.search || url.hash || url.username || url.password) throw Error('PROVIDER_SCOPE');
        await page.bringToFront(); await until(() => page.evaluate(() => document.hasFocus()));
        await page.evaluate(() => globalThis.__soteraiClineTraceNote('COMMAND_READY'));
        await publish(path.join(out, `ui-command-ready-${index + 1}.json`), { schemaVersion: 1, runNonce: prepared.runNonce,
          ordinal: index + 1, stage, editorBroughtToFront: true, documentFocused: true });
        result.inputStages = [];
        for (const [field, title, value] of [['openai', 'OpenAI-compatible upstream endpoint', request.providerUrl],
          ['anthropic', 'Anthropic-compatible upstream endpoint', ''], ['key', 'Provider API key (stored in SecretStorage)', upstreamKey]]) {
          const progress = { field, state: 'WAITING_FOR_EXPECTED_INPUT' }; result.inputStages.push(progress);
          const input = page.locator('.quick-input-widget:visible').filter({ hasText: title });
          await until(async () => { const count = await input.count(); if (count > 1) throw Error('AMBIGUOUS_INPUT'); return count === 1; });
          progress.state = 'EXPECTED_TITLE_FOUND';
          const box = input.locator('input.input'); if (await box.count() !== 1) throw Error('INPUT_CONTROL');
          await page.evaluate(() => globalThis.__soteraiClineTraceNote('BEFORE_FILL'));
          await box.fill(value);
          await page.evaluate(() => globalThis.__soteraiClineTraceNote('BEFORE_ENTER'));
          await box.press('Enter');
          await page.evaluate(() => globalThis.__soteraiClineTraceNote('AFTER_ENTER'));
          await until(async () => await input.count() === 0);
          progress.state = 'ENTER_AND_DISMISSAL_COMPLETE';
        }
      } else if (stage === 'cline-setup-cancel' || stage === 'cline-setup-apply') {
        const dialog = page.locator('.monaco-dialog-box:visible').filter({ hasText: 'Review pinned Cline setup' });
        await until(async () => { const count = await dialog.count(); if (count > 1) throw Error('AMBIGUOUS_MODAL'); return count === 1; });
        const text = await dialog.innerText();
        if (text.includes('TEST_ONLY_') || !text.includes('[MASKED]') || !text.includes('providers.json') || !text.includes('TaskStart.ps1')
          || !text.includes('Start a new Cline task') || !text.includes('Reload Window withdraws')) throw Error('UNSAFE_REVIEW');
        const name = stage === 'cline-setup-cancel' ? 'Cancel' : 'Apply reviewed Cline changes';
        const button = dialog.getByRole('button', { name, exact: true }); if (await button.count() !== 1) throw Error('EXACT_BUTTON');
        await button.click(); await until(async () => await dialog.count() === 0);
      } else {
        if (request.publicControl !== 'SOTERAI_CLINE_NATIVE_PUBLIC_CONTROL_20261113') throw Error('CONTROL_SCOPE');
        // The actual installed webview renders completion_result messages in
        // this response-only component; the user prompt cannot satisfy it.
        await until(async () => {
          for (const frame of page.frames().filter(frame => frame !== page.mainFrame())) {
            try {
              const completion = frame.locator('.completion-output-content:visible').filter({ hasText: request.publicControl });
              if (await completion.count() === 1 && (await completion.innerText({ timeout: 1000 })).trim() === request.publicControl) return true;
            } catch { /* The Cline iframe may still be attaching. */ }
          }
          return false;
        }, prepared.clineScenario === 'cline-free' ? 60000 : 30000);
      }
      await publish(path.join(out, `ui-step-${index + 1}.json`), { schemaVersion: 1, status: 'PASS', runNonce: prepared.runNonce,
        ordinal: index + 1, stage, realUiInteraction: true, publicValuesOnly: true });
      result.stages.push({ stage, status: 'PASS' });
    }
    // The host still runs request canaries and owns broker shutdown after the
    // last visible reply. Keep the CDP session until its report is durable.
    await until(async () => {
      if (prepared.clineScenario === 'setup-canaries') {
        const consent=page.locator('.monaco-dialog-box:visible').filter({hasText:'Allow one safe read'}).filter({hasText:'canary-read.txt'});
        if(await consent.count()===1){const text=await consent.innerText();if(text.includes('BlueMango7!')||!text.includes('SoterAI MCP session'))throw Error('UNSAFE_REVIEW');
          await consent.getByRole('button',{name:'Allow safe read once',exact:true}).click();
          await publish(path.join(out,'safe-read-consent.json'),{runNonce:prepared.runNonce,safeTextChecked:true,realUiInteraction:true});
        }
      }
      try { const report = JSON.parse(await fs.readFile(path.join(out, 'host-result.json'), 'utf8'));
        if (report.runNonce !== prepared.runNonce) throw Error('UNKNOWN_STAGE'); return true;
      } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    }, 90000);
    result.status = 'PASS_NATIVE_UI';
  } catch (error) {
    result.failureDetail=String(error?.message||'').split('\n')[0].slice(0,200);
    try { result.failureSnapshot = await inputSnapshot(); } catch { result.failureSnapshotUnavailable = true; }
    result.failedBoundary = boundary;
    result.failureCode = ['CLINE_RENDERER_TIMEOUT', 'NATIVE_HOST_FAILED', 'EDITOR_CLOSED', 'PORT_FILE', 'PORT_FORMAT', 'CDP_SCOPE', 'AMBIGUOUS_EDITOR',
      'UNKNOWN_STAGE', 'PROVIDER_SCOPE', 'AMBIGUOUS_INPUT', 'INPUT_CONTROL', 'AMBIGUOUS_MODAL', 'UNSAFE_REVIEW', 'EXACT_BUTTON', 'CONTROL_SCOPE'].includes(error?.message)
      ? error.message : 'UNEXPECTED_RENDERER_FAILURE';
    throw Error('NATIVE_CLINE_UI_FAILED');
  } finally {
    if (traceTimer) clearInterval(traceTimer);
    await Promise.allSettled(tracePublications);
    try { if (page) result.nativeInputTrace = await page.evaluate(() => globalThis.__soteraiClineTraceRead?.()); }
    catch { result.nativeInputTraceUnavailable = true; }
    try { if (browser) await browser.close(); } catch { /* Only this isolated editor is attached. */ }
    await publish(path.join(out, 'renderer-result.json'), result);
  }
};
