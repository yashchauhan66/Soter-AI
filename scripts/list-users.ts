import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, isAdmin: true, emailVerifiedAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("total users:", users.length);
  for (const u of users) {
    console.log(`${u.isAdmin ? "ADMIN " : "user  "} ${u.email} verified=${u.emailVerifiedAt ? "yes" : "no"}`);
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());