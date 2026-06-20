import { PrismaClient } from "@prisma/client";
import { withDatabaseConnectTimeout } from "./databaseUrl";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const url = withDatabaseConnectTimeout(process.env.DATABASE_URL);
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
