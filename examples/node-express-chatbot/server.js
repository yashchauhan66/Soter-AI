// server.js
//
// Express chatbot example using @cyberrakshak/guard. Two routes are shown:
//   POST /chat              — explicit guard flow with the client
//   POST /chat-middleware   — uses the Express input-guard middleware
//
// The CyberRakshak API key is read from the environment and never sent to the
// browser.

import "dotenv/config";
import express from "express";
import { CyberRakshakClient } from "@cyberrakshak/guard";
import { cyberRakshakInputMiddleware } from "@cyberrakshak/guard/express";

const app = express();
app.use(express.json({ limit: "32kb" }));

const guard = new CyberRakshakClient({
  apiKey: process.env.CYBERRAKSHAK_API_KEY,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.dev",
  projectId: process.env.CYBERRAKSHAK_PROJECT_ID,
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
    const inputResult = await guard.guardInput({ text: message });
    if (guard.shouldBlock(inputResult)) {
      return res.json({ reply: inputResult.safeText ?? "Blocked for safety.", blocked: true });
    }
    const reply = await callLLM(guard.getSafeText(inputResult, message) ?? message);
    const outputResult = await guard.guardOutput({ text: reply });
    if (guard.shouldBlock(outputResult)) {
      return res.json({ reply: outputResult.safeText ?? "Response withheld.", blocked: true });
    }
    return res.json({ reply: guard.getSafeText(outputResult, reply) ?? reply, blocked: false });
  } catch (caught) {
    const status = caught?.status ?? 500;
    // Never leak the API key or internal details.
    return res.status(status).json({ error: true, message: "Chat request failed." });
  }
});

// --- Middleware flow -------------------------------------------------------
app.post(
  "/chat-middleware",
  cyberRakshakInputMiddleware({
    apiKey: process.env.CYBERRAKSHAK_API_KEY,
    baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.dev",
  }),
  async (req, res) => {
    // req.body.message is now the safe/redacted text; if it was blocked, the
    // middleware already responded.
    const reply = await callLLM(req.body.message);
    const outputResult = await guard.guardOutput({ text: reply });
    res.json({
      reply: guard.getSafeText(outputResult, reply) ?? reply,
      blocked: guard.shouldBlock(outputResult),
    });
  },
);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: true, message: "Internal error." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  // Do not log secrets.
  console.log(`Express chatbot example listening on :${port}`);
});
