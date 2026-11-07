'use strict';
// Execute actual Express routing with Node HTTP request/response objects over a
// bounded in-memory Duplex. No listener, TCP connection, provider or child.
const assert = require('node:assert/strict');
const { IncomingMessage, ServerResponse } = require('node:http');
const { Duplex } = require('node:stream');

function invoke(express, handler, query) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, done) {
        bytes += chunk.length;
        if (bytes > 64 * 1024) return done(Error('Synthetic HTTP response budget exceeded'));
        chunks.push(Buffer.from(chunk)); done();
      },
    });
    const request = new IncomingMessage(socket);
    request.method = 'GET'; request.url = '/api/orders?' + new URLSearchParams(query).toString();
    request.headers = { host: 'synthetic.invalid' };
    const response = new ServerResponse(request);
    response.assignSocket(socket);
    const timer = setTimeout(() => reject(Error('Synthetic Express response deadline exceeded')), 5000);
    response.once('error', reject);
    response.once('finish', () => {
      clearTimeout(timer);
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const boundary = raw.indexOf('\r\n\r\n');
        assert(boundary > 0, 'Actual HTTP response headers required');
        const contentLength = Number(response.getHeader('content-length'));
        const bodyText = raw.slice(boundary + 4);
        assert.equal(Buffer.byteLength(bodyText), contentLength);
        assert.match(String(response.getHeader('content-type')), /^application\/json/);
        resolve({ status: response.statusCode, body: JSON.parse(bodyText) });
      } catch (error) { reject(error); }
    });
    const app = express(); app.disable('x-powered-by');
    app.get('/api/orders', handler);
    app(request, response);
  });
}

module.exports = { invoke };
