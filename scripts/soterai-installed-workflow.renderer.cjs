'use strict';
// Connect only to the just-launched isolated editor's ephemeral loopback CDP.
// Native messages are answered by real UI clicks, never by mocking product APIs.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function publish(file, value) {
  try { await fs.lstat(file); throw Error('EVIDENCE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staged = file + '.staged';
  await fs.writeFile(staged, JSON.stringify(value), { flag: 'wx' });
  await fs.rename(staged, file);
}
const stages = ['debug-copy', 'environment-copy', 'debug-keep', 'debug-cancel', 'source-drift', 'preview-drift', 'settings-drift', 'concurrent-refusal', 'quickfix-copy'];
async function until(test, budget = 20000) {
  const end = Date.now() + budget;
  while (Date.now() < end) { const value = await test(); if (value) return value; await delay(100); }
  throw Error('RENDERER_TIMEOUT');
}
async function version(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/json/version', timeout: 3000, agent: false }, response => {
      let bytes = 0; const chunks = [];
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 65536) response.destroy(Error()); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => { try { if (response.statusCode !== 200 || !response.complete) throw Error(); resolve(JSON.parse(Buffer.concat(chunks))); } catch { reject(Error()); } });
    });
    request.on('timeout', () => request.destroy(Error())); request.on('error', reject);
  });
}
exports.run = async function (out, child) {
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  let browser, page, currentStage = 'attach', lastWait = 'ATTACH';
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_UI', artifactSha256: prepared.artifactSha256, runNonce: prepared.runNonce, stages: [], productApiMocked: false, normalProfileAttached: false };
  try {
    const portFile = path.join(out, 'profile/user-data/DevToolsActivePort');
    const endpoint = await until(async () => {
      if (child.exitCode !== null || child.signalCode !== null) throw Error('EDITOR_CLOSED');
      try {
        const stat = await fs.lstat(portFile); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024) throw Error();
        const rows = (await fs.readFile(portFile, 'utf8')).trim().split(/\r?\n/), port = Number(rows[0]);
        if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^\/devtools\/browser\/[a-f0-9-]+$/i.test(rows[1])) throw Error();
        const meta = await version(port), url = new URL(meta.webSocketDebuggerUrl);
        if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== port || url.pathname !== rows[1] || url.search || url.hash || url.username || url.password) throw Error();
        return url.href;
      } catch (error) { if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') return false; throw error; }
    });
    browser = await chromium.connectOverCDP(endpoint, { timeout: 15000, noDefaults: true });
    page = await until(() => {
      const pages = browser.contexts().flatMap(context => context.pages()).filter(page => /^vscode-file:\/\/vscode-app\//.test(page.url()));
      if (pages.length > 1) throw Error('AMBIGUOUS_EDITOR'); return pages[0];
    });
    page.setDefaultTimeout(12000);
    // Read rendered structure first; this isolated profile contains only public fixtures.
    await page.locator('.monaco-workbench').waitFor();
    await page.bringToFront();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await publish(path.join(out, 'renderer-ready.json'), { schemaVersion: 1, status: 'READY', runNonce: prepared.runNonce, editorPid: child.pid, ephemeralLoopback: true });
    for (let index = 0; index < stages.length; index++) {
      currentStage = stages[index];
      const request = await until(async () => {
        if (child.exitCode !== null || child.signalCode !== null) throw Error('EDITOR_CLOSED');
        try { return JSON.parse(await fs.readFile(path.join(out, `ui-request-${index + 1}.json`), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
      const expectedChoice = currentStage === 'debug-keep' || currentStage === 'concurrent-refusal' ? 'keep' : currentStage === 'debug-cancel' ? 'cancel' : 'copy';
      if (request.schemaVersion !== 1 || request.runNonce !== prepared.runNonce || request.ordinal !== index + 1 || request.stage !== currentStage || request.choice !== expectedChoice) throw Error('UNKNOWN_STAGE');
      const message = currentStage === 'quickfix-copy' ? 'Review these sanitized lines for remaining private information before sharing.' : 'Review this text for remaining private information before sharing.';
      const notice = page.locator('.notification-list-item:visible').filter({ hasText: message });
      lastWait = 'VISIBLE_NOTIFICATION';
      await until(async () => await notice.count() === 1);
      lastWait = 'HOVER_NOTIFICATION';
      await notice.hover();
      const controls = await notice.locator('button, a[role="button"]').evaluateAll(items => items.map(item => ({ tag: item.tagName, label: item.getAttribute('aria-label'), title: item.getAttribute('title'), text: item.textContent?.slice(0, 80) })));
      await fs.writeFile(path.join(out, `ui-controls-${index + 1}.json`), JSON.stringify({ stage: currentStage, controls }), { flag: 'wx' });
      if (currentStage === 'debug-copy' || currentStage === 'environment-copy') await page.screenshot({ path: path.join(out, currentStage + '.png') });
      if (request.choice === 'cancel') {
        lastWait = 'DISMISS_NOTIFICATION';
        const dismiss = notice.locator('.codicon-notifications-clear');
        if (await dismiss.count() !== 1) throw Error('DISMISS_CONTROL_UNAVAILABLE');
        await dismiss.click();
      } else {
        lastWait = 'CLICK_CHOICE';
        const button = notice.getByRole('button', { name: request.choice === 'copy' ? 'Copy reviewed text' : 'Keep preview', exact: true });
        if (await button.count() !== 1) throw Error('CHOICE_CONTROL_UNAVAILABLE');
        await button.click();
      }
      // VS Code can retain a resolved notification row. Confirm that the
      // current native command actually completed before clearing that row.
      lastWait = 'NATIVE_COMMAND_COMPLETED';
      await until(async () => {
        try {
          const done = JSON.parse(await fs.readFile(path.join(out, `ui-command-result-${index + 1}.json`), 'utf8'));
          if (done.schemaVersion !== 1 || done.runNonce !== prepared.runNonce || done.ordinal !== index + 1 || done.stage !== currentStage) throw Error('COMMAND_RESULT_CHANGED');
          return true;
        } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      }, 12000);
      lastWait = 'RESOLVED_NOTIFICATION_CLEAR';
      if (await notice.count() === 1) {
        const dismiss = notice.locator('.codicon-notifications-clear');
        if (await dismiss.count() === 1) await dismiss.click();
      }
      lastWait = 'NOTIFICATION_CLOSED';
      await until(async () => await notice.count() === 0);
      await publish(path.join(out, `ui-step-${index + 1}.json`), { schemaVersion: 1, runNonce: prepared.runNonce, ordinal: index + 1, stage: currentStage, status: 'PASS', action: request.choice, realUiInteraction: true });
      result.stages.push({ stage: currentStage, status: 'PASS' });
    }
    result.status = 'PASS_NATIVE_UI';
  } catch {
    result.failedStage = currentStage; result.lastWait = lastWait;
    try { if (page) result.failureSnapshot = await page.evaluate(() => {
      const message = 'Review this text for remaining private information before sharing.';
      const all = [...document.querySelectorAll('.notification-list-item')], matching = all.filter(item => (item.textContent || '').includes(message));
      return { documentFocused: document.hasFocus(), notificationItems: all.length, matchingItems: matching.length,
        visibleMatchingItems: matching.filter(item => item.getClientRects().length > 0).length,
        copyButtonCount: [...document.querySelectorAll('button, a[role="button"]')].filter(item => item.textContent?.trim() === 'Copy reviewed text').length,
        dialogs: document.querySelectorAll('.monaco-dialog-box').length };
    }); } catch { result.failureSnapshot = { unavailable: true }; }
    throw Error('NATIVE_UI_FAILED');
  }
  finally {
    // A CDP-connected Playwright browser disconnects its client on close.
    try { if (browser) await browser.close(); } catch { /* Editor may have exited after final host assertion. */ }
    await fs.writeFile(path.join(out, 'renderer-result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
};
