import { Soter } from "@soterai/core";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const apiKey = process.env.SOTER_API_KEY ?? process.env.CYBERRAKSHAK_API_KEY;
const baseUrl = process.env.SOTER_BASE_URL ?? process.env.CYBERRAKSHAK_BASE_URL ?? "http://localhost:3000";

if (!apiKey) {
  throw new Error("SOTER_API_KEY environment variable is not defined.");
}

export const soter = new Soter({
  apiKey,
  baseUrl,
  projectId: process.env.SOTER_PROJECT_ID ?? process.env.CYBERRAKSHAK_PROJECT_ID,
  timeoutMs: 8000,
});
