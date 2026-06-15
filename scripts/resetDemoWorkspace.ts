import { db } from "../lib/db";

async function main() {
  if (process.env.DEMO_RESET_CONFIRM !== "RESET_DEMO_ONLY") throw new Error("Set DEMO_RESET_CONFIRM=RESET_DEMO_ONLY to continue.");
  const email = process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev";
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`Demo user ${email} was not found.`);
  const projects = await db.project.findMany({ where: { userId: user.id, plan: "DEMO" }, select: { id: true } });
  if (!projects.length) throw new Error("No DEMO projects belong to the configured demo user.");
  const ids = projects.map((project) => project.id);
  await db.$transaction([
    db.guardLog.deleteMany({ where: { projectId: { in: ids } } }),
    db.usageCounter.deleteMany({ where: { projectId: { in: ids } } }),
    db.report.deleteMany({ where: { projectId: { in: ids } } }),
    db.webhookDelivery.deleteMany({ where: { endpoint: { projectId: { in: ids } } } }),
    db.onboardingProgress.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: { firstGuardRequest: false, reportGenerated: false } }),
  ]);
  console.info(`Reset activity for ${ids.length} DEMO project(s) owned by ${email}.`);
}

main().finally(() => db.$disconnect());
