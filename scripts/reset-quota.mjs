// Upgrade org plan to PRO + reset monthly usage metering counters in Upstash Redis
import { Redis } from "@upstash/redis";
import { PrismaClient } from "@prisma/client";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
  process.exit(1);
}

const redis = new Redis({ url, token });

// 1. Reset meter keys
const keys = await redis.keys("crg:meter:*");
console.log("Meter keys found:", keys.length);

for (const key of keys) {
  const val = await redis.get(key);
  console.log(`  ${key} => ${String(val)}`);
}

if (keys.length > 0) {
  await redis.del(...keys);
  console.log("Deleted", keys.length, "keys — quota reset complete");
} else {
  console.log("No keys to delete — quota may already be reset");
}

// 2. Delete rate-limit keys
const rlKeys = await redis.keys("crg:rl:*");
if (rlKeys.length > 0) {
  await redis.del(...rlKeys);
  console.log("Deleted", rlKeys.length, "rate-limit keys");
}

// 3. Upgrade org plan to PRO
const db = new PrismaClient();
const org = await db.organization.findFirst();
if (org) {
  await db.organization.update({
    where: { id: org.id },
    data: { plan: "PRO" },
  });
  console.log(`Upgraded organization ${org.id} from ${org.plan} to PRO`);
} else {
  console.log("No organization found to upgrade");
}
await db.$disconnect();

process.exit(0);
