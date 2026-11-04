'use strict';
// INERT external test admission. Return only selected public metadata; never
// return tokens, sessions, raw result objects, exceptions or child environment.
const assert = require('node:assert/strict');
function field(object, name) {
  assert(object && typeof object === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(object)));
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  assert(descriptor && Object.hasOwn(descriptor, 'value'));
  return descriptor.value;
}
function endpoint(value, stopped) {
  assert(typeof value === 'string' && /^http:\/\/127\.0\.0\.1:(0|[1-9][0-9]{0,4})$/.test(value));
  const url = new URL(value);
  assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1');
  assert(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/');
  assert(/^(0|[1-9][0-9]{0,4})$/.test(url.port));
  const port = Number(url.port);
  assert(Number.isInteger(port) && port <= 65535 && port !== 47321);
  if (stopped) assert.equal(port, 0); else assert(port >= 1024);
  return port;
}
function healthy(result) {
  assert.equal(field(result, 'state'), 'healthy'); assert.equal(field(result, 'running'), true);
  assert.equal(field(result, 'version'), '0.2.0');
  return Object.freeze({ state: 'healthy', running: true, loopback: true,
    port: endpoint(field(result, 'url'), false), brokerVersion: '0.2.0' });
}
function stopped(result) {
  assert.equal(field(result, 'state'), 'stopped'); assert.equal(field(result, 'running'), false);
  return Object.freeze({ state: 'stopped', running: false, loopback: true, port: endpoint(field(result, 'url'), true) });
}
module.exports = { healthy, stopped };
