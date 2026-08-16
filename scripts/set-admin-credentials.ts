import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newEmail = process.env.ADMIN_NEW_EMAIL?.trim().toLowerCase();
  const newPassword = process.env.ADMIN_NEW_PASSWORD;
  if (!newEmail || !newPassword) {
    console.error("ADMIN_NEW_EMAIL and ADMIN_NEW_PASSWORD env vars are required.");
    process.exit(1);
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
    console.error("Password must be 8+ chars with uppercase, lowercase, and a number.");
    process.exit(1);
  }

  const existingTarget = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true, isAdmin: true } });
  if (existingTarget && !existingTarget.isAdmin) {
    console.error(`FAIL: ${newEmail} already belongs to a non-admin user — will not hijack that account.`);
    process.exit(1);
  }

  const currentAdmin = await prisma.user.findFirst({
    where: { OR: [{ isAdmin: true }, { email: process.env.ADMIN_OLD_EMAIL ?? "demo@cyberrakshak.dev" }] },
    orderBy: { isAdmin: "desc" },
    select: { id: true, email: true, isAdmin: true },
  });

  if (!currentAdmin) {
    console.log("No existing admin — creating new admin account.");
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const created = await prisma.user.create({
      data: {
        email: newEmail,
        name: "Platform Admin",
        passwordHash,
        isAdmin: true,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      select: { id: true, email: true, isAdmin: true, emailVerifiedAt: true, passwordChangedAt: true },
    });
    console.log("OK: admin account created");
    console.log(JSON.stringify(
      {
        id: created.id,
        email: created.email,
        isAdmin: created.isAdmin,
        emailVerifiedAt: created.emailVerifiedAt?.toISOString() ?? null,
        passwordChangedAt: created.passwordChangedAt?.toISOString() ?? null,
      },
      null,
      2,
    ));
    return;
  }

  if (existingTarget && existingTarget.id === currentAdmin.id) {
    console.log(`Target email already on the admin account (${currentAdmin.email}) — only password will change.`);
  } else if (existingTarget) {
    console.error(`FAIL: ${newEmail} is a different admin account (${existingTarget.id}). Aborting to avoid confusion.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: currentAdmin.id },
    data: {
      email: newEmail,
      passwordHash,
      passwordChangedAt: new Date(),
      emailVerifiedAt: currentAdmin.email === newEmail ? undefined : new Date(),
    },
    select: { id: true, email: true, isAdmin: true, emailVerifiedAt: true, passwordChangedAt: true },
  });

  console.log("OK: admin credentials updated");
  console.log(JSON.stringify(
    {
      id: updated.id,
      email: updated.email,
      isAdmin: updated.isAdmin,
      emailVerifiedAt: updated.emailVerifiedAt?.toISOString() ?? null,
      passwordChangedAt: updated.passwordChangedAt?.toISOString() ?? null,
    },
    null,
    2,
  ));
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());