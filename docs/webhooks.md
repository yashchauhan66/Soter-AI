# SoterAI Guard — Webhooks Guide

## Setup
1. Go to Dashboard → Integrations → Webhooks
2. Click "Add Endpoint"
3. Enter your URL (must be HTTPS in production)
4. Select events to subscribe to
5. Save — you'll receive a signing secret (shown once)

## Event Types
- `guard.input.blocked` — Input was blocked
- `guard.input.allowed` — Input was allowed
- `guard.output.blocked` — Output was blocked
- `guard.scan.completed` — Full scan completed
- `governance.enforcement.blocked` — Policy enforcement blocked action
- `governance.enforcement.approval_required` — Action needs approval
- `webhook.test` — Test event

## Payload Format
```json
{
  "id": "uuid",
  "event": "guard.input.blocked",
  "createdAt": "2026-01-01T00:00:00Z",
  "data": { ... }
}
```

## Signature Verification

### Node.js
```js
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your handler:
app.post('/webhooks/soterai', (req, res) => {
  const sig = req.headers['x-soter-signature'];
  const body = JSON.stringify(req.body);
  if (!verifyWebhookSignature(body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Process event...
  res.status(200).json({ received: true });
});
```

### Python
```python
import hmac, hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## Headers
- `x-soter-event` — Event type
- `x-soter-timestamp` — ISO timestamp
- `x-soter-signature` — HMAC-SHA256 signature
- `x-soter-idempotency-key` — Dedup key
- `x-soter-attempt` — Delivery attempt number (1-based)

## Retry Policy
Failed deliveries retry with exponential backoff:
1. 30 seconds
2. 2 minutes
3. 10 minutes
4. 1 hour
5. 6 hours

After 6 failed attempts, the delivery moves to dead-letter and you'll receive an email alert.

## Testing
Use the "Test" button in Dashboard → Integrations → Webhooks to send a test event.

## Troubleshooting
- Check deliveries tab for response codes
- Verify your endpoint is publicly accessible
- Ensure your server responds within 10 seconds
- Check that signature verification uses the raw request body