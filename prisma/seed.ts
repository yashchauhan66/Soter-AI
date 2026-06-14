import bcrypt from "bcryptjs";
import { GuardAction, GuardDirection, PrismaClient } from "@prisma/client";
import { generateApiKey } from "../lib/apiKeyCrypto";

const prisma = new PrismaClient();
const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev";
const demoPassword = process.env.DEMO_USER_PASSWORD ?? "demo-cyberrakshak-2026";

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: "Demo Security Team", passwordHash, isAdmin: true, emailVerifiedAt: new Date() },
    create: { email: demoEmail, name: "Demo Security Team", passwordHash, isAdmin: true, emailVerifiedAt: new Date() },
  });

  // Default organization for the demo user.
  const org = await prisma.organization.upsert({
    where: { slug: "demo-cyberrakshak" },
    update: { name: "Demo workspace", type: "DIRECT_BUSINESS", plan: "DEMO", contactEmail: demoEmail },
    create: {
      name: "Demo workspace",
      slug: "demo-cyberrakshak",
      type: "DIRECT_BUSINESS",
      plan: "DEMO",
      contactEmail: demoEmail,
    },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { role: "OWNER" },
    create: { organizationId: org.id, userId: user.id, role: "OWNER" },
  });
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: { status: "ACTIVE", plan: "DEMO" },
    create: { organizationId: org.id, status: "ACTIVE", plan: "DEMO" },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: { userId: user.id, organizationId: org.id },
    create: {
      id: "demo-project",
      name: "Demo Chatbot",
      description: "Seeded customer support security gateway",
      plan: "DEMO",
      userId: user.id,
      organizationId: org.id,
    },
  });

  // Default policy for the demo project.
  await prisma.projectPolicy.upsert({
    where: { projectId: project.id },
    update: {},
    create: { projectId: project.id, mode: "BALANCED" },
  });

  let apiKey = await prisma.apiKey.findFirst({
    where: { projectId: project.id, name: "Seed test key" },
  });
  let generatedRawKey: string | undefined;
  if (!apiKey) {
    const generated = generateApiKey("test");
    generatedRawKey = generated.rawKey;
    apiKey = await prisma.apiKey.create({
      data: {
        name: "Seed test key",
        prefix: generated.prefix,
        keyHash: generated.keyHash,
        projectId: project.id,
      },
    });
  }

  const existingLogs = await prisma.guardLog.count({ where: { projectId: project.id } });
  if (!existingLogs) {
    const logs: Array<{
      direction: GuardDirection;
      action: GuardAction;
      riskScore: number;
      riskTypes: string[];
      reason: string;
      originalText?: string;
      redactedText?: string;
      safeText?: string;
      findings: Array<Record<string, string | number>>;
    }> = [
      { direction: "INPUT", action: "ALLOW", riskScore: 0, riskTypes: ["LOW_RISK"], reason: "No material risk patterns were detected by the Phase 1 rules.", originalText: "Where is my order?", safeText: "Where is my order?", findings: [] },
      { direction: "INPUT", action: "BLOCK", riskScore: 85, riskTypes: ["PROMPT_INJECTION", "SYSTEM_PROMPT_LEAK_ATTEMPT"], reason: "Blocked because high-risk patterns were detected: Instruction override, System prompt request.", findings: [
        { type: "PROMPT_INJECTION", label: "Instruction override", severity: "HIGH", score: 40, message: "Attempts to supersede prior instructions." },
        { type: "SYSTEM_PROMPT_LEAK_ATTEMPT", label: "System prompt request", severity: "HIGH", score: 45, message: "Requests confidential model instructions." },
      ] },
      { direction: "INPUT", action: "ALLOW_WITH_REDACTION", riskScore: 55, riskTypes: ["PII_DETECTED", "INDIA_PII_DETECTED"], reason: "Allowed after sensitive values were redacted: Email address, Indian mobile number.", redactedText: "Contact [REDACTED_EMAIL] or [REDACTED_PHONE].", safeText: "Contact [REDACTED_EMAIL] or [REDACTED_PHONE].", findings: [
        { type: "PII_DETECTED", label: "Email address", severity: "MEDIUM", score: 25, message: "An email address was detected." },
        { type: "INDIA_PII_DETECTED", label: "Indian mobile number", severity: "MEDIUM", score: 30, message: "An Indian mobile number pattern was detected." },
      ] },
      { direction: "INPUT", action: "HUMAN_REVIEW", riskScore: 70, riskTypes: ["SECRET_DETECTED"], reason: "Held for human review because sensitive content was detected: API key.", redactedText: "Token: [REDACTED_SECRET]", safeText: "Token: [REDACTED_SECRET]", findings: [
        { type: "SECRET_DETECTED", label: "API key", severity: "CRITICAL", score: 70, message: "An API key was detected. Rotate it if this value is real." },
      ] },
      { direction: "OUTPUT", action: "BLOCK", riskScore: 60, riskTypes: ["SYSTEM_PROMPT_LEAKAGE"], reason: "Blocked because high-risk patterns were detected: System instruction disclosure.", redactedText: "[REDACTED_SYSTEM_INSTRUCTIONS]", findings: [
        { type: "SYSTEM_PROMPT_LEAKAGE", label: "System instruction disclosure", severity: "CRITICAL", score: 60, message: "The output appears to disclose internal instructions." },
      ] },
    ];

    for (const [index, log] of logs.entries()) {
      const { findings, ...data } = log;
      await prisma.guardLog.create({
        data: {
          ...data,
          projectId: project.id,
          apiKeyId: apiKey.id,
          createdAt: new Date(Date.now() - index * 3_600_000),
          metadata: { seeded: true, findings },
        },
      });
    }

    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    await prisma.usageCounter.upsert({
      where: { projectId_date: { projectId: project.id, date: day } },
      update: { requestCount: 5, blockedCount: 2, redactedCount: 1 },
      create: { projectId: project.id, date: day, requestCount: 5, blockedCount: 2, redactedCount: 1 },
    });

    const now = new Date();
    await prisma.report.upsert({
      where: { projectId_month_year: { projectId: project.id, month: now.getUTCMonth() + 1, year: now.getUTCFullYear() } },
      update: {},
      create: {
        projectId: project.id,
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
        totalRequests: 5,
        blockedRequests: 2,
        redactedRequests: 1,
        avgRiskScore: 54,
        topRiskTypes: [
          { type: "PROMPT_INJECTION", count: 1 },
          { type: "SYSTEM_PROMPT_LEAK_ATTEMPT", count: 1 },
          { type: "PII_DETECTED", count: 1 },
        ],
        recommendations: [
          "Keep strict blocking enabled for system prompt leak attempts.",
          "Review blocked and high-risk logs weekly.",
        ],
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo user: ${demoEmail} / ${demoPassword}`);
  console.log(`Demo organization: ${org.slug} (${org.id})`);
  if (generatedRawKey) {
    console.log(`One-time demo API key: ${generatedRawKey}`);
  } else {
    console.log("The existing demo API key was retained and cannot be displayed again.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
