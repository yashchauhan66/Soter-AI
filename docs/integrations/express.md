# Express Integration

```bash
npm install @soterai/core express
```

```ts
import express from "express";
import { Soter } from "@soterai/core";

const app = express();
app.use(express.json());

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
  baseUrl: process.env.SOTER_BASE_URL,
});

app.post("/chat", async (req, res) => {
  const protection = await soter.protect({
    input: req.body.message,
    context: {
      userId: req.user?.id,
      sessionId: req.session?.id,
    },
  });

  if (!protection.allowed) {
    return res.status(403).json({
      blocked: true,
      reason: protection.reason,
      riskLevel: protection.riskLevel,
    });
  }

  // Continue to the LLM only after Soter allows the input.
});
```

Example: `examples/express-chatbot`.
