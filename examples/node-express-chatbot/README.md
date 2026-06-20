# Node + Express chatbot example (Soter)

Express server that protects a chatbot turn with the `@soter/core` SDK.

## Run

```bash
cp .env.example .env
# fill in SOTER_API_KEY and SOTER_BASE_URL
npm install
npm start
```

## Routes

| Route | Description |
| --- | --- |
| `POST /chat` | Explicit input guard → LLM → output guard. |
| `POST /chat-middleware` | Uses `soterInputMiddleware`, then output guard. |

```bash
curl -s localhost:3001/chat -H 'Content-Type: application/json' \
  -d '{"message":"hello"}'
```

## Security notes

- The API key is read from the environment server-side only.
- The client receives `{ reply, blocked }` — never the key or internals.
- Always run the output guard. This reduces risk; it is not a guarantee.
