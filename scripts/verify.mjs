#!/usr/bin/env node
/**
 * Cross-platform verify script for CyberRakshak Guard.
 *
 * Runs: typecheck → SDK typecheck → tests → prisma validate → build (with retry).
 * Exits non-zero on any failure.
 *
 * Fixes CRG-001: Next.js 15 + Windows intermittently fails the first build
 * with "Cannot find module for page: /_document". The clean+retry fallback
 * ensures CI pipelines succeed.
 */

import { execSync } from "node:child_process";

const steps = [
  { label: "Typecheck", cmd: "npm run typecheck" },
  { label: "SDK Typecheck", cmd: "npm --prefix packages/sdk run typecheck" },
  { label: "Tests", cmd: "npm test" },
  { label: "Prisma Validate", cmd: "npx prisma validate" },
];

function run(label, cmd) {
  console.log(`\n▸ ${label}…`);
  try {
    execSync(cmd, { stdio: "inherit", shell: true });
    console.log(`  ✓ ${label} passed`);
    return true;
  } catch {
    console.error(`  ✗ ${label} failed`);
    return false;
  }
}

// Run prerequisite steps
for (const step of steps) {
  if (!run(step.label, step.cmd)) {
    console.error(`\n✖ Verify failed at: ${step.label}`);
    process.exit(1);
  }
}

// Build with CRG-001 retry
console.log("\n▸ Build…");
try {
  execSync("npm run build", { stdio: "inherit", shell: true });
  console.log("  ✓ Build passed");
} catch {
  console.log("\n  ⚠ First build failed (CRG-001), cleaning and retrying…");
  try {
    execSync("npm run clean", { stdio: "inherit", shell: true });
    execSync("npm run build", { stdio: "inherit", shell: true });
    console.log("  ✓ Build passed (retry)");
  } catch {
    console.error("  ✗ Build failed on retry");
    process.exit(1);
  }
}

console.log("\n✔ All verify steps passed\n");
