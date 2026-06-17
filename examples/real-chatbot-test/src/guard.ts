import { createClient } from "@cyberrakshak/guard";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const apiKey = process.env.CYBERRAKSHAK_API_KEY;
const baseUrl = process.env.CYBERRAKSHAK_BASE_URL ?? "http://localhost:3000";

if (!apiKey) {
  throw new Error("CYBERRAKSHAK_API_KEY environment variable is not defined.");
}

export const guardClient = createClient({
  apiKey,
  baseUrl,
  timeoutMs: 8000,
});
