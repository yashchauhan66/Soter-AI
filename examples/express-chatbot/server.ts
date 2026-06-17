import express from "express";
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const app = express();
app.use(express.json());

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.com",
});

app.post("/chat", guard.createExpressMiddleware({
  callLLM: async (safeMessage) => `Safe demo response for: ${safeMessage}`,
}));

app.listen(Number(process.env.PORT || 3101), () => {
  console.log("Express chatbot example listening.");
});
