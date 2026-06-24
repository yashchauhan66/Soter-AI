# Next.js Integration

Install:

```bash
npm install @soterai/core
```

Create `app/api/chat/route.ts`:

```ts
import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
});

export async function POST(req: Request) {
  const body = await req.json();
  const result = await soter.protect({
    input: body.message,
  });

  if (!result.allowed) {
    return Response.json(
      { blocked: true, reason: result.reason },
      { status: 403 },
    );
  }

  // Continue with the model call here.
}
```

Example: `examples/nextjs-chatbot`.
