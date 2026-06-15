# Node + Express chatbot example (CyberRakshak Guard)

Express server that guards a chatbot turn with the `@cyberrakshak/guard` JS SDK.

## Run

```bash
cp .env.example .env
# fill in CYBERRAKSHAK_API_KEY and CYBERRAKSHAK_BASE_URL
npm install
npm start
```

## Routes

| Route | Description |
| --- | --- |
| `POST /chat` | Explicit input guard → LLM → output guard. |
| `POST /chat-middleware` | Uses `cyberRakshakInputMiddleware`, then output guard. |

```bash
curl -s localhost:3001/chat -H 'Content-Type: application/json' \
  -d '{"message":"hello"}'
```

## Security notes

- The API key is read from the environment server-side only.
- The client receives `{ reply, blocked }` — never the key or internals.
- Always run the output guard. This reduces risk; it is not a guarantee.
