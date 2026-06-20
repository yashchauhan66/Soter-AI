import { PrismaClient } from "../../../node_modules/@prisma/client";
import { soter } from "./guard";
import { callMockLLM } from "./llm";
import { safePrompts, promptInjections, piiAndSecrets, unsafeOutputs, TestCase } from "./test-prompts";
import { saveResults, generateMarkdownReports } from "./report";

const prisma = new PrismaClient();

async function runTestCase(c: TestCase, plan: string): Promise<any> {
  const start = Date.now();
  let decision: string = "ALLOW";
  let llmCalled = false;
  let reply = "";
  
  try {
    const result = await soter.secureChat({
      message: c.message,
      userId: "test-user-1",
      sessionId: `session-${plan}-${c.name}`,
      callLLM: async (llmInput) => {
        llmCalled = true;
        return callMockLLM(llmInput);
      }
    });

    decision = result.blocked ? "BLOCK" : (result.inputResult.action || "ALLOW");
    reply = result.reply;
  } catch (error: any) {
    decision = "ERROR";
    reply = error.message;
  }

  const latencyMs = Date.now() - start;

  let pass = false;
  if (c.expectedDecision === "BLOCK") {
    pass = decision === "BLOCK";
  } else if (c.expectedDecision === "ALLOW_WITH_REDACTION") {
    pass = decision === "ALLOW_WITH_REDACTION" || decision === "ALLOW";
  } else if (c.expectedDecision === "HUMAN_REVIEW") {
    pass = decision === "HUMAN_REVIEW" || decision === "BLOCK";
  } else {
    pass = decision === "ALLOW";
  }

  if (pass && c.llmCalled !== llmCalled) {
    pass = false;
  }

  return {
    plan,
    name: c.name,
    input: c.message,
    expected: c.expectedDecision,
    actual: decision,
    llmCalled,
    latencyMs,
    pass,
    reply
  };
}

async function main() {
  console.log("Starting real chatbot testing...");

  const results: any[] = [];

  const org = await prisma.organization.findUnique({
    where: { slug: "demo-cyberrakshak" }
  });

  if (!org) {
    console.error("Demo organization not found. Please run seed script first.");
    process.exit(1);
  }

  console.log("\n--- Executing Free Plan Tests ---");
  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "FREE" }
  });
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, plan: "FREE", status: "ACTIVE" },
    update: { plan: "FREE", status: "ACTIVE" }
  });

  const freeTests = [...safePrompts, ...promptInjections, ...piiAndSecrets, ...unsafeOutputs];
  for (const t of freeTests) {
    console.log(`Running: ${t.name}...`);
    const r = await runTestCase(t, "FREE");
    results.push(r);
  }

  console.log("\n--- Triggering PRO Plan Mock Activation ---");
  const periodEnd = new Date();
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    }
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "PRO" }
  });

  console.log("Database updated: Plan is now PRO");

  console.log("\n--- Executing Pro Plan Tests ---");
  const proTests = [...safePrompts, ...promptInjections, ...piiAndSecrets, ...unsafeOutputs];
  for (const t of proTests) {
    console.log(`Running: ${t.name}...`);
    const r = await runTestCase(t, "PRO");
    results.push(r);
  }

  saveResults(results);
  generateMarkdownReports(results);

  console.log("\nTesting completed successfully.");
}

main()
  .catch((e) => {
    console.error("Test runner error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
