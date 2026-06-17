import express from "express";
import { guardClient } from "./guard";
import { callMockLLM } from "./llm";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.post("/chat", async (req, res) => {
  const { message, userId, sessionId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const start = Date.now();
    const result = await guardClient.secureChat({
      message,
      userId,
      sessionId,
      callLLM: async (llmInput) => {
        return callMockLLM(llmInput);
      }
    });
    const latencyMs = Date.now() - start;

    return res.json({
      allowed: !result.blocked,
      decision: result.blocked ? "BLOCK" : "ALLOW",
      message: result.reply,
      inputGuard: result.inputResult,
      outputGuard: result.outputResult || null,
      latencyMs
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot test server listening on port ${PORT}`);
});
