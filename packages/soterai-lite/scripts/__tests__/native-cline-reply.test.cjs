'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { syntheticReply } = require('../../../../scripts/soterai-installed-cline.host.cjs');
test('native Cline receiver never calls a function absent from the advertised tools', () => {
  const reply = syntheticReply([{ type: 'function', function: { name: 'read_files' } }]);
  assert.equal(reply.kind, 'assistant-text'); assert.equal(reply.finishReason, 'stop');
  assert.equal(reply.delta.content, 'SOTERAI_CLINE_NATIVE_PUBLIC_CONTROL_20261113');
  assert.equal(reply.delta.tool_calls, undefined);
});
test('native Cline receiver can use a declared terminal completion function', () => {
  const reply = syntheticReply([{ type: 'function', function: { name: 'submit_and_exit' } }]);
  assert.equal(reply.kind, 'completion-tool'); assert.equal(reply.finishReason, 'tool_calls');
  assert.equal(reply.delta.tool_calls[0].function.name, 'submit_and_exit');
});
