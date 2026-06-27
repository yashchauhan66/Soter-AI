import { execSync } from "node:child_process";
import { seedAuthorizationFixtures } from "./authorization-fixtures";

export default async function globalSetup() {
  const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("E2E_DATABASE_URL is required for Playwright database setup.");
  }

  const testEnvironment = { ...process.env, DATABASE_URL: databaseUrl };
  for (const script of ["db:deploy", "db:seed"]) {
    execSync(`npm run ${script}`, {
      cwd: process.cwd(),
      env: testEnvironment,
      stdio: "inherit",
    });
  }
  await seedAuthorizationFixtures(databaseUrl);
}
