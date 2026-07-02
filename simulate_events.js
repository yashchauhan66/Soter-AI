// simulate_events.js
async function run() {
  console.log("Simulating events...");
  // Connect to DB directly using Prisma
  const { PrismaClient } = require('./node_modules/@prisma/client');
  const prisma = new PrismaClient();
  
  const org = await prisma.organization.findFirst({ where: { slug: 'demo-cyberrakshak' }});
  if (!org) {
    console.log("No org found");
    return;
  }
  
  // 1. Create an enrolled device
  const device = await prisma.extensionDevice.create({
    data: {
      organizationId: org.id,
      deviceToken: 'fake-device-token-12345',
      deviceInfo: { browser: 'Chrome', os: 'Windows' },
      status: 'ACTIVE',
      lastSeenAt: new Date(),
      lastIpAddress: '127.0.0.1'
    }
  });
  
  // 2. Insert AI events
  await prisma.aIEvent.create({
    data: {
      organizationId: org.id,
      deviceId: device.id,
      eventType: 'PROMPT_INJECTION',
      severity: 'HIGH',
      status: 'BLOCKED',
      details: { prompt: '[REDACTED]', matchedRule: 'ignore previous instructions' },
      url: 'https://chatgpt.com',
      aiDestination: 'ChatGPT',
      timestamp: new Date()
    }
  });

  await prisma.aIEvent.create({
    data: {
      organizationId: org.id,
      deviceId: device.id,
      eventType: 'SECRETS_LEAK',
      severity: 'CRITICAL',
      status: 'BLOCKED',
      details: { prompt: '[REDACTED]', matchedRule: 'API Key Leak' },
      url: 'https://claude.ai',
      aiDestination: 'Claude',
      timestamp: new Date()
    }
  });

  // 3. Insert file scan events
  await prisma.fileScanEvent.create({
    data: {
      organizationId: org.id,
      deviceId: device.id,
      fileName: 'config.env',
      fileHash: 'abcdef123456',
      fileSize: 1024,
      scanResult: 'BLOCKED',
      threatType: 'SENSITIVE_DATA',
      details: { findings: ['DATABASE_URL', 'API_KEY'] },
      timestamp: new Date()
    }
  });

  console.log("Done inserting events.");
}

run().catch(console.error);
