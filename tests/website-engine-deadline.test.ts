import test from 'node:test';
import assert from 'node:assert/strict';
import { requestAnalysis } from '../lib/sa/client';

test('an unresponsive transport ends without inventing an engine verdict', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })) as typeof fetch;
  try {
    const call = (requestAnalysis as typeof requestAnalysis & ((...args: unknown[]) => ReturnType<typeof requestAnalysis>))('Synthetic test', 'INPUT', new AbortController().signal, '/api/guard/analyze', 10);
    const outcome = await Promise.race([call.then((r) => r.aborted ? 'aborted' : r.outcome.kind), new Promise((resolve) => setTimeout(() => resolve('still-pending'), 80))]);
    assert.equal(outcome, 'unavailable');
  } finally {
    globalThis.fetch = original;
  }
});
