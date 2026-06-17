# Express Integration

```bash
npm install @cyberrakshak/guard express
```

```ts
import express from "express";
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const app = express();
app.use(express.json());

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL!,
});

app.post("/chat", guard.createExpressMiddleware({
  callLLM: async (safeMessage) => myLLM(safeMessage),
}));
```

Example: `examples/express-chatbot`.
