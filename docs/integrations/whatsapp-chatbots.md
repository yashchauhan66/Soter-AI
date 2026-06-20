# WhatsApp Chatbot Security

Use Soter to protect WhatsApp chatbot deployments.

## Prerequisites

```bash
SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example
```

## Integration Flow

```
WhatsApp Message → Soter Input Guard → LLM/RAG → Soter Output Guard → WhatsApp Reply
```

1. **Route inbound WhatsApp messages** through `/api/guard/input` before the LLM
2. **Route model responses** through `/api/guard/output` before replying to users
3. **Enable India PII redaction** for phone numbers, Aadhaar, PAN, UPI IDs
4. **Configure webhooks** for blocked prompts, secrets, PII redactions, and usage alerts

## API Example

```ts
// Guard incoming WhatsApp message
const inputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/input`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: userMessage,
    userId: senderPhoneNumber,  // traceable identifier
  }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  return sendWhatsAppReply(sender, "I couldn't process that message.");
}

// Guard the AI response
const outputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/output`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiReply }),
}).then((r) => r.json());

const safeReply = outputResult.safeText ?? outputResult.redactedText ?? aiReply;
sendWhatsAppReply(sender, safeReply);
```

## Best Practices

- Use separate API keys per client or brand
- Give agencies white-label reports with only redacted evidence
- Configure webhooks for blocked prompts and usage limits
- Enable India-specific PII redaction for Indian deployments

## Security Notes

- Do not test against customer systems without written authorization
- API key stays server-side only
- This reduces risk; it does not guarantee complete protection
