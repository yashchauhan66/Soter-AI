import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkEvents() {
  const events = await prisma.securityEvent.findMany({
    where: {
      eventType: { startsWith: "EXTENSION_" },
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("Recent Extension Events:", JSON.stringify(events, null, 2));
}
checkEvents().catch(console.error).finally(() => prisma.$disconnect());
