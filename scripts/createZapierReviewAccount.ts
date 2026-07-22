import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../lib/apiKeyCrypto";

const prisma = new PrismaClient();

const reviewEmail = "integration-testing@zapier.com";
const password =
  process.env.ZAPIER_REVIEW_PASSWORD ??
  `Zapier${randomBytes(9).toString("base64url")}2026Aa`;

async function main() {
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: reviewEmail },
    update: {
      name: "Zapier Integration Review",
      passwordHash,
      emailVerifiedAt: now,
      ssoOnly: false,
      passwordChangedAt: now,
    },
    create: {
      email: reviewEmail,
      name: "Zapier Integration Review",
      passwordHash,
      emailVerifiedAt: now,
      ssoOnly: false,
      passwordChangedAt: now,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "zapier-review" },
    update: {
      name: "Zapier Review Workspace",
      type: "DIRECT_BUSINESS",
      plan: "DEMO",
      contactEmail: reviewEmail,
      disabled: false,
      disabledReason: null,
    },
    create: {
      name: "Zapier Review Workspace",
      slug: "zapier-review",
      type: "DIRECT_BUSINESS",
      plan: "DEMO",
      contactEmail: reviewEmail,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: user.id },
    },
    update: { role: "OWNER" },
    create: { organizationId: org.id, userId: user.id, role: "OWNER" },
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: { status: "ACTIVE", plan: "DEMO" },
    create: { organizationId: org.id, status: "ACTIVE", plan: "DEMO" },
  });

  const project = await prisma.project.upsert({
    where: { id: "zapier-review-project" },
    update: {
      userId: user.id,
      organizationId: org.id,
      disabledAt: null,
      disabledReason: null,
      badgeEnabled: true,
    },
    create: {
      id: "zapier-review-project",
      name: "Zapier Review Project",
      publicName: "Zapier Review Project",
      description: "Permanent project for Zapier integration review.",
      plan: "DEMO",
      userId: user.id,
      organizationId: org.id,
    },
  });

  await prisma.projectPolicy.upsert({
    where: { projectId: project.id },
    update: { mode: "BALANCED" },
    create: { projectId: project.id, mode: "BALANCED" },
  });

  await prisma.apiKey.updateMany({
    where: { projectId: project.id, name: "Zapier review key" },
    data: { isActive: false },
  });

  const generated = generateApiKey("live");
  await prisma.apiKey.create({
    data: {
      name: "Zapier review key",
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      projectId: project.id,
      isActive: true,
    },
  });

  console.log("Zapier review account ready.");
  console.log(`Username: ${reviewEmail}`);
  console.log(`Password: ${password}`);
  console.log(`Project ID: ${project.id}`);
  console.log(`API Key: ${generated.rawKey}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
