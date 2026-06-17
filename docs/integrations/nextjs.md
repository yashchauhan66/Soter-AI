# Next.js Integration

Install:

```bash
npm install @cyberrakshak/guard
```

Create `app/api/chat/route.ts`:

```ts
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL!,
});

export async function POST(req: Request) {
  const { message, userId, sessionId } = await req.json();
  const result = await guard.protectChat({
    message,
    userId,
    sessionId,
    metadata: { source: "nextjs" },
    callLLM: async (safeMessage) => callMyLLM(safeMessage),
  });
  return Response.json(result);
}
```

Example: `examples/nextjs-chatbot`.
