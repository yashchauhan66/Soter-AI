import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const page = '<html lang="en-IN"><head><title>Fixture AI inspection page</title><meta name="description" content="A synthetic HTML fixture used only to exercise the audit command against hidden siblings and document language, not published website evidence."/><link rel="canonical" href="https://soterai.in"/><meta property="og:title" content="Fixture"/><meta property="og:image" content="/fixture.png"/><meta name="twitter:card" content="summary_large_image"/></head><body><div hidden id="S:0"><section><span>Auxiliary stream</span></section></div><main><h1>Visible headline outside the hidden sibling</h1><p>Fixture only.</p></main></body></html>';

test('H1 visibility does not inherit a closed hidden streamed sibling', async () => {
  const server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    let output = '';
    try { output = (await exec(process.execPath, ['scripts/seo/audit-pages.mjs', '--base', `http://127.0.0.1:${address.port}`, '--paths', '/'])).stdout; }
    catch (error) { output = error.stdout; }
    assert.doesNotMatch(output, /H1 is inside a hidden streamed block/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the audit accepts the required en-IN document language', async () => {
  const server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    let output = '';
    try { output = (await exec(process.execPath, ['scripts/seo/audit-pages.mjs', '--base', `http://127.0.0.1:${address.port}`, '--paths', '/'])).stdout; }
    catch (error) { output = error.stdout; }
    assert.doesNotMatch(output, /html lang is/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
