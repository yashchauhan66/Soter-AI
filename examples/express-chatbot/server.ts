import express from "express";
import { createExpressMiddleware } from "@soterai/core/express";

const app = express();
app.use(express.json());

app.use("/api/chat", createExpressMiddleware({
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL || "https://api.soter.dev",
}));

app.listen(3000, () => {
  console.log("Express chatbot running on port 3000");
});
