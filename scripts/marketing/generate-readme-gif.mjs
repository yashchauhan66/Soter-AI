#!/usr/bin/env node
/**
 * README demo GIF generator — "Your secret, caught before AI sees it".
 *
 * This is marketing/22-GIF-RECORDING-KIT.md made executable. The recording kit
 * assumed a human with ScreenToGif; this script produces the same 30-second
 * "paste a risky prompt → BLOCKED → safe copy" story without a human, by driving
 * the REAL playground against the REAL detection engine:
 *
 *   1. boots the production build (next start) or reuses an already-running one
 *   2. opens http://localhost:<port>/playground in headless Chromium (Playwright)
 *   3. types a verified fixture payload in visible chunks, the way a paste
 *      looks, while recording the page
 *   4. clicks "Analyze risk" and lets the real engine decide (BLOCK is asserted —
 *      a demo that renders ALLOW is a broken demo, and the script exits 1)
 *   5. converts the Playwright webm to a loopable GIF with ffmpeg (15 fps,
 *      1280x720, two-pass palette so text stays crisp), then copies it to the
 *     
 *  two canonical homes:
 *        - public/marketplace/screenshots/soterai-secret-caught-before-ai.gif
 *          (deployed to https://soterai.in/marketplace/screenshots/…)
 *        - packages/vscode-extension/media/marketplace/ (VSIX fallback copy)
 *
 * Every payload value comes from scripts/test/gif-demo-fixture.js — the same
 * file the extension's "Run Safe Demo Scan" uses — and every value there is
 * verified to trigger the real detector by scripts/test/verify-gif-demo-values.cjs.
 * Nothing real is ever typed on camera.
 *
 * Claim discipline: the recording shows a real verdict returned by the real
 * engine for the shown input, on screen, at real speed. It is not sped up, and
 * no number is burned into the GIF itself.
 *
 * Usage:
 *   node scripts/marketing/generate-readme-gif.mjs
 *   node scripts/marketing/generate-readme-gif.mjs --port 3105   # reuse a server
 *   node scripts/marketing/generate-readme-gif.mjs --keep        # keep the webm
 *
 * Requires: ffmpeg on PATH, Playwright chromium installed
 * (npx playwright install chromium). Exit 1 = any step failed, or the engine
 * did not BLOCK the demo payload, or the GIF missed its size/duration budget.
 */

import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "..", "..");

// ── CLI ─────────────────────────────────────────────────────────────────────

function flag(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : true;
}

const PORT = Number(flag("port", 3106));
const KEEP = process.argv.includes("--keep");
const OUT_DIR = join(repoRoot, "marketing", "gif-build");
const TARGET_WEB = join(repoRoot, "public", "marketplace", "screenshots", "soterai-secret-caught-before-ai.gif");
const TARGET_VSIX = join(repoRoot, "packages", "vscode-extension", "media", "marketplace", "soterai-secret-caught-before-ai.gif");

// Target shape from marketing/22-GIF-RECORDING-KIT.md: ≤ 3 MB, ≤ 35 s, loops.
// The kit specifies 1280×720 @ 15 fps, but that combination cannot fit a
// 20-second screen take under the 3 MB marketplace budget (measured: 7.6 MB).
// The marketplace README renders images at ~950px wide, so a 960×540 render is
// still at native display size there, and 12 fps is the classic GIF cadence.
// Recording stays at 1280×720 and is downscaled with lanczos, which is sharper
// than recording small.
const MAX_GIF_BYTES = 3 * 1024 * 1024;
const GIF_FPS = 12;
const RECORD_WIDTH = 1280;
const RECORD_HEIGHT = 720;
const GIF_WIDTH = 960;
const GIF_HEIGHT = 540;

// ── The demo payload — verified fixture, never a real value ──────────────────

const fixturePath = join(repoRoot, "scripts", "test", "gif-demo-fixture.js");
const fixtureSrc = readFileSync(fixturePath, "utf8");
// Evaluate the fixture in a sandbox to pull PROMPT_TO_SEND. The fixture is a
// plain CJS module (module.exports = {…}, no imports), so give the sandbox a
// `module` object and return what the fixture assigned to it.
const fixtureModule = { exports: {} };
new Function("module", `${fixtureSrc}`)(fixtureModule);
const PROMPT = fixtureModule.exports.PROMPT_TO_SEND;
if (typeof PROMPT !== "string" || PROMPT.length < 40) {
  console.error("[gif] fixture did not export a usable PROMPT_TO_SEND");
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
  }
}

// Type the payload in a few visible chunks with human-ish pauses so the
// "paste" reads on camera; one keystroke-per-frame would be unreadable anyway.
function splitIntoChunks(text, n) {
  const per = Math.ceil(text.length / n);
  const out = [];
  for (let i = 0; i < text.length; i += per) out.push(text.slice(i, i + per));
  return out;
}

async function typeLikeAPaste(page, selector, text) {
  const groups = splitIntoChunks(text, 7);
  for (const group of groups) {
    await page.type(selector, group, { delay: 8 });
    await page.waitForTimeout(180);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("[gif] payload length:", PROMPT.length, "chars (all values synthetic — see scripts/test/gif-demo-fixture.js)");

// 1. Server: reuse --port if it responds, else boot the production build.
let server = null;
let startedServer = false;
const BASE = `http://localhost:${PORT}`;
if (await waitForServer(`${BASE}/playground`, 8_000)) {
  console.log(`[gif] reusing already-running server on :${PORT}`);
} else {
  console.log(`[gif] starting production server on :${PORT} …`);
  server = spawn("cmd", ["/c", "npx", "next", "start", "--port", String(PORT)], {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true,
  });
  startedServer = true;
  if (!(await waitForServer(`${BASE}/playground`, 90_000))) {
    console.error(`[gif] server did not come up on :${PORT}. Run \`npm run build\` first — a stale .next from an older Next.js fails to boot with "routesManifest.dataRoutes is not iterable".`);
    killTree(server.pid);
    process.exit(1);
  }
}
console.log("[gif] server up");

// 2. Record the playground session.
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: RECORD_WIDTH, height: RECORD_HEIGHT },
  recordVideo: { dir: OUT_DIR, size: { width: RECORD_WIDTH, height: RECORD_HEIGHT } },
});
const page = await context.newPage();
try {
  await page.goto(`${BASE}/playground`, { waitUntil: "networkidle" });

  // Clean slate for the take: the default text is example #1; clear it on
  // camera so the typing beat reads as a paste into an empty box.
  const textarea = page.locator("#guard-text");
  await textarea.click();
  await textarea.fill("");
  await page.waitForTimeout(600);

  // Paste beat.
  await typeLikeAPaste(page, "#guard-text", PROMPT);
  await page.waitForTimeout(900);

  // Analyze beat.
  const analyze = page.getByRole("button", { name: /Analyze risk/i });
  await analyze.click();

  // Verdict beat: wait for the real result card. "Request stopped" is the copy
  // GuardResultCard renders for a blocked request.
  const resultCard = page.locator(".card", { hasText: "Request stopped" }).first();
  await resultCard.waitFor({ state: "visible", timeout: 30_000 });

  // Assert the real engine actually BLOCKed this payload — a demo that shows
  // ALLOW is a broken demo.
  const actionText = await page
    .locator(".badge-danger")
    .first()
    .innerText({ timeout: 10_000 })
    .catch(() => null);
  console.log(`[gif] engine verdict on demo payload: ${actionText ?? "(badge not found)"}`);
  if (!actionText || !actionText.trim().toUpperCase().startsWith("BLOCK")) {
    throw new Error(
      `expected BLOCK for the fixture payload, got "${actionText}" — the fixture or the engine changed; fix scripts/test/gif-demo-fixture.js first`,
    );
  }

  // Hold on the verdict so the loop point shows the blocked state.
  await page.waitForTimeout(2600);
} catch (error) {
  console.error("[gif] recording failed:", error.message);
  await browser.close();
  if (startedServer) killTree(server?.pid);
  process.exit(1);
}

// 3. Save the video and close. Playwright writes the .webm once the context
// closes; video.path() is resolvable before close, so grab it first, then move
// the file to a stable name. Playwright may save it directly in OUT_DIR (no
// per-context subdirectory), in which case the source already IS the target and
// copying onto itself would truncate it — only copy when the paths differ, and
// only clean up the source's own subdirectory, never OUT_DIR itself.
const video = page.video();
const rawWebm = join(OUT_DIR, "playground-take.webm");
const videoPath = await video.path().catch(() => null);
await context.close();
await browser.close();
if (!videoPath || !existsSync(videoPath)) {
  console.error("[gif] Playwright did not produce a video file");
  if (startedServer) killTree(server?.pid);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
if (resolve(videoPath) !== resolve(rawWebm)) {
  rmSync(rawWebm, { force: true });
  writeFileSync(rawWebm, readFileSync(videoPath));
  if (!KEEP) {
    // Playwright saves videos directly in recordVideo.dir — there is no
    // per-context subdirectory — so deleting dirname(videoPath) would delete
    // OUT_DIR itself, rawWebm included (this exact bug ate take #1). Delete
    // only the file, and only a nested subdirectory if one actually exists.
    rmSync(videoPath, { force: true });
    const srcDir = dirname(videoPath);
    if (resolve(srcDir) !== resolve(OUT_DIR)) rmSync(srcDir, { recursive: true, force: true });
  }
}
console.log("[gif] raw take saved:", rawWebm, `(${statSync(rawWebm).size} bytes)`);

// 4. Convert webm → GIF: two-pass palette for crisp text.
try {
  const probe = JSON.parse((await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "json", rawWebm,
  ])).stdout);
  const duration = Number(probe.format?.duration ?? 0);
  console.log(`[gif] raw take duration: ${duration.toFixed(1)}s`);

  // Trim the page-load dead air: recording starts before goto() resolves, so
  // the first ~2 s of every take is a blank frame painting in. Measured start
  // of the story is the first interaction beat (the textarea click).
  const TRIM_START = 1.6;
  if (duration > TRIM_START + 4) {
    console.log(`[gif] trimming first ${TRIM_START}s of page-load dead air`);
  }

  mkdirSync(dirname(TARGET_WEB), { recursive: true });
  await run("ffmpeg", ["-y", "-ss", String(TRIM_START), "-i", rawWebm,
    "-vf", `fps=${GIF_FPS},scale=${GIF_WIDTH}:${GIF_HEIGHT}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`,
    TARGET_WEB,
  ]);
} catch (error) {
  console.error("[gif] ffmpeg conversion failed:", error.stderr ? String(error.stderr).slice(0, 400) : error.message);
  if (startedServer) killTree(server?.pid);
  process.exit(1);
}

// 5. Gate + copy to both homes.
const bytes = statSync(TARGET_WEB).size;
if (bytes > MAX_GIF_BYTES) {
  console.error(`[gif] GIF is ${(bytes / 1024 / 1024).toFixed(2)} MB — over the ${MAX_GIF_BYTES / 1024 / 1024} MB marketplace budget. Shorten the hold beats or lower fps.`);
  if (startedServer) killTree(server?.pid);
  process.exit(1);
}
mkdirSync(dirname(TARGET_VSIX), { recursive: true });
writeFileSync(TARGET_VSIX, readFileSync(TARGET_WEB));

// Duration gate: the marketplace GIF loops; anything over 35 s stops feeling
// like a demo and starts feeling like a tutorial.
try {
  const probe = JSON.parse((await run("ffprobe", [
    "-v", "error", "-select_streams", "v", "-show_entries", "stream=duration", "-of", "json", TARGET_WEB,
  ])).stdout);
  const dur = Number(probe.streams?.[0]?.duration ?? 0);
  if (dur > 35) {
    console.error(`[gif] GIF duration ${dur.toFixed(1)}s exceeds the 35s storyboard limit`);
    if (startedServer) killTree(server?.pid);
    process.exit(1);
  }
  console.log(`[gif] GIF duration: ${dur.toFixed(1)}s @ ${GIF_FPS} fps, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
} catch {
  console.warn("[gif] could not probe final GIF duration (non-fatal)");
}

// Write a small manifest beside the GIF — tests and reviewers read this.
writeFileSync(join(dirname(TARGET_WEB), "soterai-secret-caught-before-ai.gif.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "real /playground session, real detection engine, real verdict",
  payload: "scripts/test/gif-demo-fixture.js (all values synthetic, verified by scripts/test/verify-gif-demo-values.cjs)",
  verdict: "BLOCK",
  fps: GIF_FPS,
  size: `${GIF_WIDTH}x${GIF_HEIGHT}`,
  bytes,
  regenerate: "node scripts/marketing/generate-readme-gif.mjs",
}, null, 2) + "\n");

console.log(`[gif] done — ${TARGET_WEB}`);
console.log(`[gif]       ${TARGET_VSIX}`);
if (startedServer) killTree(server?.pid);
console.log("[gif] embed with: ![SoterAI catches a secret before it reaches AI](https://soterai.in/marketplace/screenshots/soterai-secret-caught-before-ai.gif)");
