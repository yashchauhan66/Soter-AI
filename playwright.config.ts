import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: false, quiet: true });

const port = Number(process.env.E2E_PORT ?? 3101);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const configuredDatabaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

if (!configuredDatabaseUrl) {
  throw new Error(
    "Playwright requires an isolated database. Set E2E_DATABASE_URL, or use a loopback DATABASE_URL for local tests.",
  );
}

let databaseHostname: string;
try {
  databaseHostname = new URL(configuredDatabaseUrl).hostname;
} catch {
  throw new Error("The E2E database URL is invalid.");
}

const usesExplicitE2eDatabase = Boolean(process.env.E2E_DATABASE_URL);
const usesLoopbackDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHostname);
if (!usesExplicitE2eDatabase && !usesLoopbackDatabase && process.env.CI !== "true") {
  throw new Error(
    "Refusing to migrate and seed a remote DATABASE_URL. Set E2E_DATABASE_URL explicitly to confirm it is an isolated test database.",
  );
}

const e2eEnvironment = {
  ...process.env,
  DATABASE_URL: configuredDatabaseUrl,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "true",
    timeout: 120_000,
    env: {
      ...e2eEnvironment,
      NEXTAUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
