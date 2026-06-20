import express from "express";
import { Soter } from "@soter/core";

const app = express();
app.use(express.json());

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
  baseUrl: process.env.SOTER_BASE_URL,
});

app.post("/chat", soter.createExpressMiddleware({
  callLLM: async (safeMessage) => `Safe demo response for: ${safeMessage}`,
}));

app.listen(Number(process.env.PORT || 3101), () => {
  console.log("Express chatbot example listening.");
});
