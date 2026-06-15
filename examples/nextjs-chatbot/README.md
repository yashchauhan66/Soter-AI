# Next.js chatbot example (CyberRakshak Guard)

A minimal Next.js App Router example showing how to guard a chatbot turn
server-side. The API key never leaves the server.

## Files

- `app/api/chat/route.ts` — explicit input guard → LLM → output guard flow.
- `app/api/chat-quickstart/route.ts` — same flow via `createGuardedRoute`.

## Setup

```bash
cp .env.example .env.local
# fill in CYBERRAKSHAK_API_KEY and CYBERRAKSHAK_BASE_URL
npm install @cyberrakshak/guard
```

## Call it from the browser

```ts
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: userInput }),
});
const { reply, blocked } = await res.json();
```

The browser only ever sends `{ message }` and receives `{ reply, blocked }`.
It never sees the CyberRakshak API key.

## Security notes

- `CYBERRAKSHAK_API_KEY` is server-only. Do **not** prefix it with
  `NEXT_PUBLIC_` and do **not** read it in a client component.
- Always run the output guard, not just the input guard.
- This reduces risk; it does not guarantee complete protection.
