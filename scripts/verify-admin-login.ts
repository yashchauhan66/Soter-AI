import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { canStartCredentialsSession } from "../lib/auth/signupPolicy";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: process.env.ADMIN_TEST_EMAIL ?? "admin@soterai.in" },
    select: { id: true, email: true, isAdmin: true, passwordHash: true, emailVerifiedAt: true },
  });
  if (!user) {
    console.error("FAIL: admin user not found");
    process.exit(1);
  }
  const ok = await bcrypt.compare(process.env.ADMIN_TEST_PASSWORD ?? "", user.passwordHash);
  const gate = canStartCredentialsSession(user);
  console.log(`email=${user.email} isAdmin=${user.isAdmin}`);
  console.log(`password_match=${ok} session_gate=${gate}`);
  process.exit(ok && gate ? 0 : 1);
}

main().finally(() => prisma.$disconnect());