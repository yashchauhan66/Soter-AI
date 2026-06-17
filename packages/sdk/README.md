# @cyberrakshak/guard

Typed JavaScript / TypeScript SDK for CyberRakshak Guard.

```bash
npm install @cyberrakshak/guard
```

## Protect a Chatbot

```ts
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.com",
});

const result = await guard.protectChat({
  message: userMessage,
  userId,
  sessionId,
  metadata: { source: "website-chatbot" },
  callLLM: async (safeMessage) => {
    return await myLLM.chat(safeMessage);
  },
});

return result.safeResponse;
```

`protectChat` runs:

1. Input guard.
2. No LLM call for `BLOCK` or `HUMAN_REVIEW`.
3. LLM call with `safeText` / `redactedText` for safe actions.
4. Output guard.
5. Safe final response.

## API

| Method | Description |
| :--- | :--- |
| `input(message, options?)` | Alias for input guard. |
| `output(aiResponse, options?)` | Alias for output guard. |
| `analyze(text, direction)` | Public analyzer. |
| `guardInput(payload)` | Raw input guard request. |
| `guardOutput(payload)` | Raw output guard request. |
| `protectChat(options)` | Input guard -> LLM -> output guard. |
| `protectRag(options)` | Guard query, retrieval chunks, and final answer. |
| `shouldCallLLM(result)` | Returns false for `BLOCK` and `HUMAN_REVIEW`. |
| `getSafeInput(result, original)` | Returns `safeText`, `redactedText`, or original. |
| `getSafeOutput(result, original)` | Returns `safeText`, `redactedText`, or original. |
| `createExpressMiddleware(options)` | Express-compatible `/chat` middleware. |
| `createNextHandler(options)` | Next.js route-handler helper. |

Existing methods `guardInput`, `guardOutput`, and `secureChat` remain supported.

## Express

```ts
app.post("/chat", guard.createExpressMiddleware({
  callLLM: async (safeMessage) => myLLM(safeMessage),
}));
```

## Next.js

```ts
export const POST = guard.createNextHandler({
  callLLM: async (safeMessage) => callMyLLM(safeMessage),
});
```

## RAG

```ts
const result = await guard.protectRag({
  query,
  retrieve: async (safeQuery) => vectorStore.similaritySearch(safeQuery),
  callLLM: async ({ safeQuery, safeContext }) => {
    return chain.invoke({ question: safeQuery, context: safeContext });
  },
});
```

## Authentication

The SDK sends:

```http
x-api-key: <CYBERRAKSHAK_API_KEY>
```

The key is never added to request JSON bodies.

## Disclaimer

CyberRakshak Guard reduces risk through defense-in-depth controls. It does not guarantee complete protection or replace secure application design, access control, model governance, or human review.
