import { createServer } from 'node:https';
import { createHash } from 'node:crypto';
import { TLSSocket } from 'node:tls';
import { ControllerError } from './SignedJournal.mjs';

const MAX_BODY_BYTES = 32 * 1024;
const exact = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
function json(response, code, body) {
  response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" });
  response.end(JSON.stringify(body));
}
async function readBody(request) {
  if (request.headers['content-type'] !== 'application/json' || request.headers['content-encoding']
    || request.headers['transfer-encoding']) throw new ControllerError('INVALID_BODY');
  const length = Number(request.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 2 || length > MAX_BODY_BYTES) throw new ControllerError('BODY_TOO_LARGE');
  const chunks = []; let total = 0;
  for await (const chunk of request) {
    total += chunk.length; if (total > length || total > MAX_BODY_BYTES) throw new ControllerError('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  if (total !== length) throw new ControllerError('INVALID_BODY');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

/** Mutual-TLS transport. No policy write, enrollment, shell, file path, proxy or owner ceremony exists on agent routes. */
export function createControllerServer({ key, cert, ca, controller, peers, enabled = () => false }) {
  if (!key || !cert || !ca || !(peers instanceof Map)) throw new ControllerError('TLS_CONFIGURATION_REQUIRED');
  const limits = new Map();
  const server = createServer({ key, cert, ca, requestCert: true, rejectUnauthorized: true,
    minVersion: 'TLSv1.3', maxHeaderSize: 8192 }, async (request, response) => {
    try {
      if (enabled() !== true) return json(response, 503, { status: 'DENIED', reason: 'DISABLED' });
      const socket = request.socket;
      if (!socket.authorized) return json(response, 401, { status: 'DENIED', reason: 'TLS_UNVERIFIED' });
      const raw = socket.getPeerCertificate()?.raw;
      const fingerprint = raw && createHash('sha256').update(raw).digest('hex');
      const principal = peers.get(fingerprint);
      if (!principal || !['agent', 'operator'].includes(principal.role)) return json(response, 403, { status: 'DENIED', reason: 'UNKNOWN_PEER' });
      const now = performance.now();
      for (const [id, limit] of limits) if (now >= limit.until) limits.delete(id);
      const limit = limits.get(fingerprint) ?? { count: 0, until: now + 60000 };
      limits.set(fingerprint, limit);
      if (++limit.count > 120) return json(response, 429, { status: 'DENIED', reason: 'RATE_LIMITED' });
      if (request.method === 'GET' && request.url === '/v1/status') return json(response, 200, controller.status());
      if (request.method !== 'POST') return json(response, 404, { status: 'DENIED', reason: 'UNKNOWN_ROUTE' });
      const operatorRoute = ['/owner/review/begin', '/owner/review/finish', '/owner/revoke'].includes(request.url);
      if (operatorRoute && principal.role !== 'operator') return json(response, 403, { status: 'DENIED', reason: 'OPERATOR_REQUIRED' });
      if (!operatorRoute && !['/v1/requests', '/v1/consume'].includes(request.url))
        return json(response, 404, { status: 'DENIED', reason: 'UNKNOWN_ROUTE' });
      const body = await readBody(request);
      if (request.url === '/owner/review/begin' && exact(body, ['requestId']))
        return json(response, 200, { status: 'REVIEW_REQUIRED', payload: controller.beginOwnerReview(body.requestId) });
      if (request.url === '/owner/review/finish' && exact(body, ['ownerEnvelope', 'presenceEnvelope']))
        return json(response, 200, { status: 'ISSUED', token: controller.finishOwnerReview(body.ownerEnvelope, body.presenceEnvelope) });
      if (request.url === '/owner/revoke' && exact(body, [])) { controller.revokeAll(); return json(response, 200, { status: 'REVOKED' }); }
      if (operatorRoute) return json(response, 400, { status: 'DENIED', reason: 'INVALID_REQUEST' });
      const authenticated = controller.authenticate(socket);
      if (authenticated.status !== 'AUTHENTICATED') return json(response, 403, authenticated);
      if (request.url === '/v1/requests' && exact(body, ['binding', 'durationMs']))
        return json(response, 200, controller.request(authenticated.peer, body.binding, body.durationMs));
      if (request.url === '/v1/consume' && exact(body, ['token']))
        return json(response, 200, await controller.consume(authenticated.peer, body.token));
      return json(response, 400, { status: 'DENIED', reason: 'INVALID_REQUEST' });
    } catch (error) {
      if (!response.headersSent) json(response, 400, { status: 'DENIED', reason: error instanceof ControllerError ? error.code : 'INVALID_OR_UNAVAILABLE_REQUEST' });
      else response.destroy();
    }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 32;
  server.on('clientError', (_error, socket) => socket.destroy());
  return server;
}

/** Certificate-derived fingerprint only; caller headers, names and request body are irrelevant. */
export function certificateIdentity(socket, enrollments, now) {
  if (!(socket instanceof TLSSocket) || socket.authorized !== true) return undefined;
  const raw = socket.getPeerCertificate()?.raw;
  if (!raw) return undefined;
  const held = enrollments.get(createHash('sha256').update(raw).digest('hex'));
  if (!held || held.role !== 'agent' || !held.measurement || !Number.isFinite(now) || now >= held.measurement.validUntil)
    return undefined;
  return { identity: structuredClone(held.identity), validUntil: held.measurement.validUntil };
}
