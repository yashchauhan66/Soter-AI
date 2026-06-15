import { execSync } from "node:child_process";
import { seedAuthorizationFixtures } from "./authorization-fixtures";

export default async function globalSetup() {
  for (const script of ["db:deploy", "db:seed"]) {
    execSync(`npm run ${script}`, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
  }
  await seedAuthorizationFixtures();
}
