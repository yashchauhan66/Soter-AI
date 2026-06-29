/**
 * One-click demo setup.
 *
 *   npm run demo:seed
 *
 * Idempotent: applies the Prisma schema, seeds the demo workspace (user, org,
 * project, policy, API key, sample guard logs + report), and prints the login.
 * Safe to re-run — every write in prisma/seed.ts is an upsert.
 */
import { execSync } from "node:child_process";

function run(label: string, cmd: string) {
  process.stdout.write(`\n▸ ${label}\n  $ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  run("Applying database schema (prisma db push)", "npx prisma db push --skip-generate");
  run("Seeding demo workspace", "npx tsx prisma/seed.ts");

  const email = process.env.DEMO_USER_EMAIL ?? "demo@cyberrakshak.dev";
  const password = process.env.DEMO_USER_PASSWORD ?? "demo-cyberrakshak-2026";

  process.stdout.write(
    [
      "",
      "────────────────────────────────────────────────────────",
      " ✅ Demo workspace ready.",
      "",
      `   Sign in:  ${email}`,
      `   Password: ${password}`,
      "",
      "   Next:",
      "   • npm run dev   then open  /signin",
      "   • Visit  /demo/guided  for the 2-minute walkthrough",
      "   • Visit  /dashboard     to see seeded guard activity",
      "",
      "   Reset demo activity later with:  npm run demo:reset",
      "────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("\nDemo setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
