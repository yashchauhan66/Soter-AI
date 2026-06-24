// Throwaway: mint a fresh test API key for the demo project and print the raw key.
// Loads .env then .env.local to match the Next.js server's env (esp. API_KEY_PEPPER).
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../lib/apiKeyCrypto";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({ where: { id: "demo-project" } });
  if (!project) {
    console.error("demo-project not found — run npm run db:seed first");
    process.exit(1);
  }
  const generated = generateApiKey("test");
  await prisma.apiKey.create({
    data: {
      name: "Claude integration test key",
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      projectId: project.id,
    },
  });
  console.log("RAWKEY=" + generated.rawKey);
}

main()
  .catch((e) => {
    console.error("MINT_ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
