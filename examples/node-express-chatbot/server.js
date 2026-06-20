// server.js
//
// Express chatbot example using @soter/core. Two routes are shown:
//   POST /chat              — explicit guard flow with the client
//   POST /chat-middleware   — uses the Express input-guard middleware
//
// The Soter API key is read from the environment and never sent to the
// browser.

import "dotenv/config";
import express from "express";
import { Soter } from "@soter/core";
import { soterInputMiddleware } from "@soter/core/express";

const app = express();
app.use(express.json({ limit: "32kb" }));

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 5000,
});

// Replace with your real LLM call.
async function callLLM(prompt) {
  return `You said: ${prompt}`;
}

// --- Explicit flow ---------------------------------------------------------
app.post("/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ error: true, message: "message is required." });
  }
  try {
    const inputResult = await soter.guardInput({ text: message });
    if (soter.shouldBlock(inputResult)) {
      return res.json({ reply: inputResult.safeText ?? "Blocked for safety.", blocked: true });
    }
    const reply = await callLLM(soter.getSafeText(inputResult, message) ?? message);
    const outputResult = await soter.guardOutput({ text: reply });
    if (soter.shouldBlock(outputResult)) {
      return res.json({ reply: outputResult.safeText ?? "Response withheld.", blocked: true });
    }
    return res.json({ reply: soter.getSafeText(outputResult, reply) ?? reply, blocked: false });
  } catch (caught) {
    const status = caught?.status ?? 500;
    // Never leak the API key or internal details.
    return res.status(status).json({ error: true, message: "Chat request failed." });
  }
});

// --- Middleware flow -------------------------------------------------------
app.post(
  "/chat-middleware",
  soterInputMiddleware({
    apiKey: process.env.SOTER_API_KEY,
    baseUrl: process.env.SOTER_BASE_URL,
  }),
  async (req, res) => {
    // req.body.message is now the safe/redacted text; if it was blocked, the
    // middleware already responded.
    const reply = await callLLM(req.body.message);
    const outputResult = await soter.guardOutput({ text: reply });
    res.json({
      reply: soter.getSafeText(outputResult, reply) ?? reply,
      blocked: soter.shouldBlock(outputResult),
    });
  },
);

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: true, message: "Internal error." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  // Do not log secrets.
  console.log(`Express chatbot example listening on :${port}`);
});
