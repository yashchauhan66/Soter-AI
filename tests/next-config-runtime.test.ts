import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

type Header = { key: string; value: string };
type Redirect = { source: string; destination: string; permanent?: boolean; statusCode?: number };
type RuntimeConfig = {
  headers: Array<{ source: string; headers: Header[] }>;
  redirects: Redirect[];
};

function runtimeConfig(mode: "production" | "development"): RuntimeConfig {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import config from './next.config.mjs'; console.log(JSON.stringify({ headers: await config.headers(), redirects: await config.redirects() }));",
    ],
    { cwd: process.cwd(), env: { ...process.env, NODE_ENV: mode }, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as RuntimeConfig;
}

function csp(config: RuntimeConfig): Map<string, string[]> {
  const header = config.headers.find((entry) => entry.source === "/:path*")?.headers
    .find((entry) => entry.key === "Content-Security-Policy");
  assert.ok(header, "The public route must retain its Content-Security-Policy");
  return new Map(header.value.split(";").map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
}

test("production CSP retains the deployed Cloudflare beacon origins", () => {
  const policy = csp(runtimeConfig("production"));
  assert.ok(policy.get("script-src")?.includes("https://static.cloudflareinsights.com"));
  assert.ok(policy.get("connect-src")?.includes("https://cloudflareinsights.com"));
});

test("production CSP does not enable unsafe-eval", () => {
  assert.equal(csp(runtimeConfig("production")).get("script-src")?.includes("'unsafe-eval'"), false);
});

test("development CSP retains the development evaluator allowance", () => {
  assert.equal(csp(runtimeConfig("development")).get("script-src")?.includes("'unsafe-eval'"), true);
});

test("GitHub-style incoming paths redirect without replacing canonical routes", () => {
  const { redirects } = runtimeConfig("production");
  assert.ok(redirects.some((entry) => entry.source === "/docs/blob/:path*" && entry.destination === "/docs" && entry.permanent === false));
  assert.ok(redirects.some((entry) => entry.source === "/blob/:path*" && entry.destination === "https://github.com/yashchauhan66/Soter-AI/blob/:path*" && entry.permanent === false));
  assert.ok(redirects.some((entry) => entry.source === "/:path*" && entry.destination === "https://soterai.in/:path*" && entry.statusCode === 301));
  assert.ok(redirects.some((entry) => entry.source === "/api/:path*" && entry.destination === "https://soterai.in/api/:path*" && entry.permanent === true));
  assert.ok(redirects.some((entry) => entry.source === "/windsurf-ai-security" && entry.destination === "/ai-platform-security" && entry.permanent));
  assert.ok(redirects.some((entry) => entry.source === "/integrations/:path*" && entry.destination === "https://soterai.in/integrations/:path*" && entry.permanent));
});
