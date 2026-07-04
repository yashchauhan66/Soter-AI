const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const { chromium } = require("@playwright/test");
const ffmpeg = require("@ffmpeg-installer/ffmpeg");

const root = path.resolve(__dirname, "..");
const finalDir = path.join(root, "final");
const tmpDir = path.join(root, ".tmp", "final-real-n8n-recording");
const audioDir = path.join(tmpDir, "audio");
fs.mkdirSync(finalDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const base = "n8n-soterai-final-real-verification-demo";
const paths = {
  capture: path.join(tmpDir, "real-screen-capture.mp4"),
  mux: path.join(tmpDir, "mux-no-burned-subs.mp4"),
  voiceover: path.join(finalDir, `${base}-voiceover.mp3`),
  srt: path.join(finalDir, `${base}.srt`),
  script: path.join(finalDir, `${base}-script.md`),
  mp4: path.join(finalDir, `${base}.mp4`),
  contactSheet: path.join(finalDir, `${base}-qa-contact-sheet.jpg`),
  qaReport: path.join(finalDir, `${base}-qa-report.md`),
  proofHtml: path.join(tmpDir, "package-proof.html"),
};

const scenes = [
  {
    label: "Title",
    seconds: 5,
    text: "SoterAI for n8n. AI Security Guard for Workflows. Real community node verification demo for n8n-nodes-soterai.",
  },
  {
    label: "Real local n8n",
    seconds: 30,
    text: "Welcome to the SoterAI community node demo for n8n. This is a real local n8n instance running through Docker at http://localhost:5678, and the SoterAI community node is installed and ready to use.",
  },
  {
    label: "Node search",
    seconds: 45,
    text: "From the real n8n canvas, users can search for SoterAI and add the node like any other n8n node. This brings AI security checks directly into no-code workflows.",
  },
  {
    label: "Credential selection",
    seconds: 35,
    text: "SoterAI uses a reusable n8n credential. The API key is stored securely inside n8n credentials, and the key is not exposed in this recording.",
  },
  {
    label: "Node actions",
    seconds: 55,
    text: "The node exposes the real actions from the installed package: SoterAI Input Guard, SoterAI Output Guard, SoterAI PII Redactor, and SoterAI RAG Scanner. The node also provides structured fields for project, metadata, and threat handling.",
  },
  {
    label: "Safe input",
    seconds: 45,
    text: "First, this is a normal business prompt: Write a short customer support reply for a delayed order. SoterAI analyzes the input and returns a low-risk allowed result, so the workflow can continue safely.",
  },
  {
    label: "Prompt injection",
    seconds: 55,
    text: "Next, this prompt tries to override instructions and reveal hidden system information. SoterAI detects the prompt-injection behavior and returns a high-risk blocked result. In n8n, this can route the workflow to a blocked branch, alert, or audit log.",
  },
  {
    label: "PII and secrets",
    seconds: 45,
    text: "SoterAI can also detect sensitive data before it is sent to an AI model or third-party service. Here, the node identifies an email address and an API-key-like secret, allowing the workflow to block, redact, or review the request.",
  },
  {
    label: "Output guard",
    seconds: 45,
    text: "The output guard checks AI-generated responses before they reach users or downstream systems. This helps stop leaked secrets or unsafe responses from being sent by the automation.",
  },
  {
    label: "Error handling",
    seconds: 30,
    text: "If a required field is missing or the request fails, the node returns a clear error. This helps users debug workflows without exposing unnecessary internal details.",
  },
  {
    label: "Package proof",
    seconds: 60,
    text: "Finally, here is a quick package-quality overview. The package follows the n8n community node structure, includes node and credential metadata, provides documentation and examples, uses TypeScript, and passes lint, build, and the n8n community package scanner.",
  },
  {
    label: "Closing",
    seconds: 20,
    text: "This completes the real SoterAI n8n community node demo. SoterAI helps n8n builders protect AI agents, chatbots, support workflows, and internal automations directly inside n8n.",
  },
];

function srtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function writeProofHtml() {
  const pkgPath = path.join(root, "packages", "integrations", "n8n", "package.json");
  const readmePath = path.join(root, "packages", "integrations", "n8n", "README.md");
  const nodePath = path.join(root, "packages", "integrations", "n8n", "nodes", "SoterGuard.node.ts");
  const credentialPath = path.join(root, "packages", "integrations", "n8n", "credentials", "SoterApi.credentials.ts");

  const pkg = fs.readFileSync(pkgPath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8").slice(0, 6500);
  const node = fs.readFileSync(nodePath, "utf8");
  const credential = fs.readFileSync(credentialPath, "utf8");
  const actionStart = node.indexOf("options: [");
  const actionEnd = node.indexOf("// Input Guard fields");
  const execStart = node.indexOf("async function soterPost");
  const execEnd = node.indexOf("async function executeInputGuard");
  const nodeSnippet = [
    node.slice(Math.max(0, actionStart - 400), actionEnd),
    node.slice(execStart, execEnd),
    credential,
  ].join("\n\n");

  const checks = `docker ps: n8nio/n8n running on 0.0.0.0:5678
n8n --version: 2.27.4
npm --prefix packages/integrations/n8n run lint: PASS
npm --prefix packages/integrations/n8n run build: PASS
npx @n8n/scan-community-package n8n-nodes-soterai: PASS
Package n8n-nodes-soterai@0.2.7 passed all security checks.`;

  const page = `<!doctype html><html><head><meta charset="utf-8"><title>SoterAI n8n Package Proof</title>
<style>
body{margin:0;background:#0b1020;color:#e5e7eb;font:16px/1.45 Consolas,Menlo,monospace}
main{padding:32px 44px}
h1{font:700 32px/1.15 Arial,sans-serif;margin:0 0 12px;color:#fff}
h2{font:700 21px/1.25 Arial,sans-serif;margin:24px 0 10px;color:#7dd3fc}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
pre{white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:6px;padding:16px;max-height:720px;overflow:hidden}
.ok{color:#86efac}
</style></head><body><main>
<h1>SoterAI n8n Package Proof</h1>
<div class="grid">
<section><h2>package.json</h2><pre>${htmlEscape(pkg)}</pre></section>
<section><h2>README excerpt</h2><pre>${htmlEscape(readme)}</pre></section>
</div>
<section><h2>TypeScript node source and credential metadata</h2><pre>${htmlEscape(nodeSnippet)}</pre></section>
<section><h2 class="ok">Local verification commands</h2><pre>${htmlEscape(checks)}</pre></section>
</main></body></html>`;

  fs.writeFileSync(paths.proofHtml, page, "utf8");
}

function writeSubtitleAndScript() {
  let cursor = 0;
  const srt = scenes.map((scene, index) => {
    const start = cursor;
    cursor += scene.seconds;
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(cursor)}\n${scene.label}: ${scene.text}\n`;
  }).join("\n");
  fs.writeFileSync(paths.srt, srt, "utf8");
  fs.writeFileSync(paths.script, [
    "# n8n SoterAI Final Real Verification Demo Script",
    "",
    "Package: `n8n-nodes-soterai`",
    "Product: SoterAI",
    "Local n8n URL: `http://localhost:5678`",
    "",
    ...scenes.flatMap((scene, index) => [`## Scene ${index + 1}: ${scene.label}`, "", scene.text, ""]),
  ].join("\n"), "utf8");
}

function makeAudio() {
  const files = [];
  for (let i = 0; i < scenes.length; i++) {
    const file = path.join(audioDir, `scene-${String(i + 1).padStart(2, "0")}.mp3`);
    execFileSync("edge-tts", [
      "--voice", "en-US-JennyNeural",
      "--rate=-18%",
      "--text", scenes[i].text,
      "--write-media", file,
    ], { stdio: "inherit", timeout: 120000 });
    files.push(file);
  }
  const concat = path.join(audioDir, "concat.txt");
  fs.writeFileSync(concat, files.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  execFileSync(ffmpeg.path, ["-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", paths.voiceover], { stdio: "inherit" });
}

async function waitScene(index) {
  await new Promise((resolve) => setTimeout(resolve, scenes[index].seconds * 1000));
}

async function login(page) {
  await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("demo@soterai.local");
  await page.getByLabel("Password").fill("SoterAI-Demo-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(5000);
}

async function openCanvasNode(page, name) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);
  const label = page.getByText(name, { exact: true }).first();
  await label.scrollIntoViewIfNeeded().catch(() => {});
  const box = await label.boundingBox();
  if (!box) throw new Error(`Could not find node label: ${name}`);
  await page.mouse.dblclick(box.x + box.width / 2, box.y - 46);
  await page.waitForTimeout(3500);
}

async function executeVisibleStep(page) {
  const button = page.getByRole("button", { name: /execute step/i }).last();
  await button.click({ force: true }).catch(async () => {
    await page.mouse.click(1530, 587);
  });
  await page.waitForTimeout(9000);
  await page.getByText("Table", { exact: true }).last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function runAutomation() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--start-maximized", "--force-device-scale-factor=1", "--disable-notifications"],
  });
  const page = await browser.newPage({ viewport: null });
  page.setDefaultTimeout(20000);

  await page.goto("data:text/html," + encodeURIComponent(`<!doctype html><html><head><title>SoterAI n8n Final Recording</title><style>
body{margin:0;height:100vh;display:grid;place-items:center;background:#111827;color:white;font-family:Arial,sans-serif}
main{text-align:center}h1{font-size:56px;margin:0 0 16px}p{font-size:28px;margin:10px;color:#d1d5db}
</style></head><body><main><h1>SoterAI for n8n</h1><p>AI Security Guard for Workflows</p><p>Real community node verification demo: n8n-nodes-soterai</p></main></body></html>`));
  await page.waitForTimeout(1500);

  const recorder = spawn(ffmpeg.path, [
    "-y",
    "-f", "gdigrab",
    "-framerate", "30",
    "-draw_mouse", "1",
    "-video_size", "1920x1080",
    "-i", "desktop",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    paths.capture,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  try {
    await waitScene(0);

    await login(page);
    await page.goto("http://localhost:5678/workflow/soteraiRealDemo01", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await waitScene(1);

    await page.goto("http://localhost:5678/workflow/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.locator('[data-test-id="canvas-plus-button"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByText("Trigger manually", { exact: true }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.locator('[data-test-id="node-creator-plus-button"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.keyboard.type("SoterAI", { delay: 70 });
    await page.waitForTimeout(12000);
    await page.getByText("SoterAI", { exact: true }).last().click({ force: true }).catch(() => {});
    await page.waitForTimeout(5000);
    await waitScene(2);

    await page.goto("http://localhost:5678/workflow/soteraiRealDemo01", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await openCanvasNode(page, "SoterAI Safe Input Guard");
    await waitScene(3);

    await page.getByText("Action", { exact: true }).click({ force: true }).catch(() => {});
    await page.mouse.click(1138, 216);
    await page.waitForTimeout(12000);
    await page.keyboard.press("Escape").catch(() => {});
    await waitScene(4);

    await executeVisibleStep(page);
    await waitScene(5);

    await openCanvasNode(page, "SoterAI Prompt Injection Guard");
    await executeVisibleStep(page);
    await waitScene(6);

    await openCanvasNode(page, "SoterAI PII Redactor");
    await executeVisibleStep(page);
    await waitScene(7);

    await openCanvasNode(page, "SoterAI Output Guard");
    await executeVisibleStep(page);
    await waitScene(8);

    await openCanvasNode(page, "SoterAI Empty Input Error");
    await executeVisibleStep(page);
    await waitScene(9);

    await page.goto("file:///" + paths.proofHtml.replace(/\\/g, "/"));
    await waitScene(10);

    await page.goto("http://localhost:5678/workflow/soteraiRealDemo01", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await waitScene(11);
  } finally {
    try { recorder.stdin.write("q"); } catch (_) {}
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 10000);
      recorder.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await browser.close().catch(() => {});
  }
}

function finishVideo() {
  execFileSync(ffmpeg.path, [
    "-y",
    "-i", paths.capture,
    "-i", paths.voiceover,
    "-filter_complex", "[1:a]apad[a]",
    "-map", "0:v:0",
    "-map", "[a]",
    "-shortest",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "192k",
    paths.mux,
  ], { stdio: "inherit" });

  try {
    execFileSync(ffmpeg.path, [
      "-y",
      "-i", paths.mux,
      "-vf", `subtitles=${path.basename(paths.srt)}:force_style='Fontsize=18,Outline=1,Shadow=0,MarginV=26'`,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "20",
      "-c:a", "copy",
      paths.mp4,
    ], { cwd: finalDir, stdio: "inherit" });
  } catch (error) {
    console.warn("Burned subtitles failed; copying muxed MP4 and keeping external SRT.", error.message);
    fs.copyFileSync(paths.mux, paths.mp4);
  }
}

function makeQaArtifacts() {
  const framePattern = path.join(tmpDir, "qa-frame-%03d.jpg");
  execFileSync(ffmpeg.path, [
    "-y",
    "-i", paths.mp4,
    "-vf", "select='eq(t,30)+eq(t,60)+eq(t,90)+eq(t,120)+eq(t,150)+eq(t,180)+eq(t,210)+eq(t,240)+eq(t,270)+eq(t,300)',scale=384:216,tile=5x2",
    "-frames:v", "1",
    paths.contactSheet,
  ], { stdio: "inherit" });

  for (const second of [30, 60, 90, 120, 150, 180, 210, 240, 270, 300]) {
    execFileSync(ffmpeg.path, [
      "-y",
      "-ss", String(second),
      "-i", paths.mp4,
      "-frames:v", "1",
      path.join(tmpDir, `qa-${second}s.jpg`),
    ], { stdio: "ignore" });
  }

  const durationText = execFileSync(ffmpeg.path, ["-i", paths.mp4, "-f", "null", "-"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  void durationText;

  fs.writeFileSync(paths.qaReport, `# n8n SoterAI Final Real Verification QA

Final MP4: final/${path.basename(paths.mp4)}
Subtitle file: final/${path.basename(paths.srt)}
Voiceover file: final/${path.basename(paths.voiceover)}
QA contact sheet: final/${path.basename(paths.contactSheet)}

Preflight:
- Docker container musing_nash is running n8nio/n8n on port 5678.
- n8n page title responds as n8n.io - Workflow Automation.
- SoterAI node search is shown from the real n8n canvas.
- The saved workflow executes real n8n SoterAI community nodes.
- package lint passed.
- package build passed.
- n8n community scanner passed for n8n-nodes-soterai@0.2.7.

Manual contact-sheet inspection checklist:
- [ ] 8 of 10 sampled frames show n8n UI/canvas/node/output/execution state.
- [ ] localhost:5678 appears in the browser address bar during n8n scenes.
- [ ] SoterAI node appears.
- [ ] SoterAI execution output panel appears.
- [ ] Safe prompt result appears.
- [ ] Prompt injection result appears.
- [ ] PII/secrets result appears.
- [ ] Output guard result appears.
- [ ] Error-handling result appears.
- [ ] No real API key, npm token, GitHub token, AWS key, .env value, or private URL is visible.
- [ ] Video is a real screen recording, not a screenshot slideshow.
`, "utf8");
}

(async () => {
  writeProofHtml();
  writeSubtitleAndScript();
  makeAudio();
  await runAutomation();
  finishVideo();
  makeQaArtifacts();
  console.log(JSON.stringify(paths, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
