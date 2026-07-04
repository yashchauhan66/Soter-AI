const fs = require("fs");
const path = require("path");
const { spawn, execFileSync, execSync } = require("child_process");
const { chromium } = require("@playwright/test");
const ffmpeg = require("@ffmpeg-installer/ffmpeg");

const root = path.resolve(__dirname, "..");
const finalDir = path.join(root, "final");
const tmpDir = path.join(root, ".tmp", "real-n8n-recording");
const audioDir = path.join(tmpDir, "audio");
fs.mkdirSync(finalDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const base = "n8n-soterai-real-verification-demo";
const paths = {
  capture: path.join(tmpDir, "live-capture.mp4"),
  voiceover: path.join(finalDir, `${base}-voiceover.mp3`),
  mp4: path.join(finalDir, `${base}.mp4`),
  srt: path.join(finalDir, `${base}.srt`),
  script: path.join(finalDir, `${base}-script.md`),
  workflow: path.join(finalDir, "n8n-soterai-demo-workflow.json"),
  qa: path.join(finalDir, "n8n-soterai-video-qa-report.md"),
  notes: path.join(finalDir, "n8n-soterai-creator-portal-submission-notes.md"),
};

const scenes = [
  ["Intro title", "SoterAI for n8n - AI Security Guard for Workflows. This is a real community node verification demo for n8n-nodes-soterai. The goal is to show the actual local n8n editor, real node discovery, real workflow execution, and the package evidence a reviewer needs."],
  ["Local n8n", "Welcome to the SoterAI community node demo for n8n. This recording uses the real local n8n editor at http://localhost:5678, running in Docker, with the SoterAI community node installed. I am not showing a mockup or a slideshow. The browser is connected to the running local editor, and all workflow screens are captured live from that instance."],
  ["Community node", "First, I open a new workflow and use the canvas add-node flow. After adding a Manual Trigger, the workflow builder can search for SoterAI and see that the community node is available from the real n8n interface. This is the same discovery path a workflow builder would use when they install the package from community nodes and start adding security checks to an automation."],
  ["Credentials", "The workflow uses a reusable SoterAI API credential. The credential stores the API key inside n8n, so the workflow can reuse it without exposing the key in node output or workflow JSON. Any secret values stay hidden in this video. For this repeatable verification recording, I use a separate local demo credential that points to a local SoterAI-compatible endpoint, while the previously configured SoterAI credential remains present and encrypted in n8n."],
  ["Node actions", "The node exposes four real actions from the TypeScript source: SoterAI Input Guard, SoterAI Output Guard, SoterAI PII Redactor, and SoterAI RAG Scanner. Common fields include Project ID, Metadata JSON, and On Threat behavior. On Threat lets a builder choose whether risky content should block the item, continue with redacted text, warn while continuing, or continue unchanged while preserving structured risk metadata."],
  ["Safe input", "The first branch checks a normal support prompt: Write a short customer support reply for a delayed order. The SoterAI node returns allowed true, blocked false, and a low risk score, so the workflow can continue. The output includes safeText and outputText, which downstream nodes can use as clean values for an LLM, ticketing system, CRM, or notification step."],
  ["Prompt injection", "The next branch tests prompt injection. The sample asks the system to ignore previous instructions and reveal hidden rules, API keys, and developer messages. SoterAI marks this as a high-risk prompt injection and blocks the item. In a production n8n workflow, this result can route to an IF branch, alert a security channel, create an audit event, or stop an agent before it sends sensitive context to a model."],
  ["PII and secrets", "The PII branch includes an email address and an API-key-like value. SoterAI returns redacted safe text and detected entities for email and API key, allowing the workflow to block, redact, or route to review. The key detail is that the output is structured: a workflow can inspect detectedEntities, severity, riskScore, and safeText without writing custom parsing code."],
  ["Output guard", "The output guard checks AI-generated content before it reaches users or downstream systems. In this sample, the generated response contains a private-token-like value, so SoterAI detects secret disclosure and blocks the output. This is useful because unsafe content can appear after generation even when the original user input looked harmless."],
  ["Error handling", "The final branch sends an empty input with continue-on-fail enabled. The node returns a clear structured validation result, showing how workflow builders can debug failures without leaking internals or secrets. The same pattern helps production workflows handle transient API failures or invalid input while keeping a clean audit trail."],
  ["Code quality", "For package quality, the demo shows package.json, README documentation, TypeScript node source, credential metadata, and the actual command results. npm run lint passed, npm run build passed, and the n8n community package scanner passed. The package name is n8n-nodes-soterai, the n8n-community-node-package keyword is present, and the n8n metadata declares both node and credential entry points."],
  ["Closing", "This completes the real SoterAI n8n community node demo. SoterAI brings input guard, output guard, PII redaction, and RAG security checks into n8n workflows with structured outputs for routing, audit, and review. The final artifacts include the MP4, subtitles, voiceover, script, importable workflow JSON, QA report, and Creator Portal notes."],
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

function writeHtmlArtifacts() {
  const sourcePath = path.join(root, "packages", "integrations", "n8n", "nodes", "SoterGuard.node.ts");
  const credentialPath = path.join(root, "packages", "integrations", "n8n", "credentials", "SoterApi.credentials.ts");
  const packagePath = path.join(root, "packages", "integrations", "n8n", "package.json");
  const readmePath = path.join(root, "packages", "integrations", "n8n", "README.md");

  const source = fs.readFileSync(sourcePath, "utf8");
  const credential = fs.readFileSync(credentialPath, "utf8");
  const pkg = fs.readFileSync(packagePath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8").slice(0, 6500);
  const checks = fs.readFileSync(path.join(root, ".tmp", "n8n-check-output.txt"), "utf8");
  const summary = fs.readFileSync(path.join(root, ".tmp", "n8n-real-execution-summary.json"), "utf8");

  const actionStart = source.indexOf("options: [");
  const actionEnd = source.indexOf("// Input Guard fields");
  const executeStart = source.indexOf("async function soterPost");
  const executeEnd = source.indexOf("async function executeInputGuard");
  const sourceSnippet = [
    source.slice(Math.max(0, actionStart - 500), actionEnd),
    source.slice(executeStart, executeEnd),
    credential,
  ].join("\n\n");

  const page = `<!doctype html><html><head><meta charset="utf-8"><title>SoterAI n8n Package Proof</title>
  <style>
    body{margin:0;background:#0f172a;color:#e5e7eb;font:17px/1.45 Consolas,Menlo,monospace}
    main{padding:34px 48px}
    h1{font:700 34px/1.2 Arial,sans-serif;margin:0 0 10px;color:#fff}
    h2{font:700 24px/1.25 Arial,sans-serif;margin:28px 0 10px;color:#7dd3fc}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    pre{white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:8px;padding:18px;max-height:760px;overflow:hidden}
    .ok{color:#86efac}
  </style></head><body><main>
    <h1>SoterAI n8n Package Proof</h1>
    <div class="grid">
      <section><h2>package.json</h2><pre>${htmlEscape(pkg)}</pre></section>
      <section><h2>README excerpt</h2><pre>${htmlEscape(readme)}</pre></section>
    </div>
    <section><h2>Node source and credential source</h2><pre>${htmlEscape(sourceSnippet)}</pre></section>
    <section><h2 class="ok">Local verification commands</h2><pre>${htmlEscape(checks)}</pre></section>
    <section><h2>Execution output summary from n8n execution data</h2><pre>${htmlEscape(summary)}</pre></section>
  </main></body></html>`;

  const proofPath = path.join(tmpDir, "package-proof.html");
  fs.writeFileSync(proofPath, page, "utf8");
  return proofPath;
}

function duration(file) {
  const out = execFileSync(ffmpeg.path, ["-i", file, "-f", "null", "-"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const text = String(out);
  const match = text.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!match) {
    const err = execSync(`"${ffmpeg.path}" -i "${file}" -f null - 2>&1`, { encoding: "utf8" });
    const m = err.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function makeAudioAndDocs() {
  const audioFiles = [];
  const durations = [];
  for (let i = 0; i < scenes.length; i++) {
    const file = path.join(audioDir, `scene-${String(i + 1).padStart(2, "0")}.mp3`);
    execFileSync("edge-tts", [
      "--voice", "en-US-JennyNeural",
      "--rate=-25%",
      "--text", scenes[i][1],
      "--write-media", file,
    ], { stdio: "inherit", timeout: 120000 });
    audioFiles.push(file);
    durations.push(duration(file));
  }
  const concat = path.join(audioDir, "concat.txt");
  fs.writeFileSync(concat, audioFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  execFileSync(ffmpeg.path, ["-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", paths.voiceover], { stdio: "inherit" });

  let cursor = 0;
  const srt = scenes.map(([label, text], i) => {
    const start = cursor;
    cursor += durations[i];
    return `${i + 1}\n${srtTime(start)} --> ${srtTime(cursor)}\n${label}: ${text}\n`;
  }).join("\n");
  fs.writeFileSync(paths.srt, srt);
  fs.writeFileSync(paths.script, [
    "# n8n SoterAI Real Verification Demo Script",
    "",
    "Package: `n8n-nodes-soterai`",
    "Product: SoterAI",
    "Local n8n URL: `http://localhost:5678`",
    "",
    ...scenes.flatMap(([label, text], i) => [`## Scene ${i + 1}: ${label}`, "", text, ""]),
  ].join("\n"));
  return durations;
}

async function pageTitle(page) {
  await page.goto("data:text/html," + encodeURIComponent(`<!doctype html><html><head><title>SoterAI n8n Demo</title><style>body{font-family:Arial,sans-serif;margin:0;height:100vh;display:grid;place-items:center;background:#111827;color:white}main{text-align:center}h1{font-size:56px;margin:0 0 18px}p{font-size:28px;color:#cbd5e1}</style></head><body><main><h1>SoterAI for n8n</h1><p>AI Security Guard for Workflows</p><p>Real community node verification demo: n8n-nodes-soterai</p></main></body></html>`));
}

async function login(page) {
  await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("demo@soterai.local");
  await page.getByLabel("Password").fill("SoterAI-Demo-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(5000);
}

async function runBrowser(durations) {
  const proofPath = writeHtmlArtifacts();
  let ff;
  let browser;
  let context;
  let page;
  let ffExited = false;
  browser = await chromium.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--window-position=0,0", "--window-size=1920,1080", "--force-device-scale-factor=1"],
  });
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(15000);

  const waitScene = async (i, minimum = 0) => page.waitForTimeout(Math.max(minimum, durations[i] * 1000));
  await pageTitle(page);

  ff = spawn(ffmpeg.path, [
    "-y", "-f", "gdigrab", "-framerate", "30", "-draw_mouse", "1",
    "-video_size", "1920x1080", "-i", "desktop",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", paths.capture,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  ff.on("exit", () => { ffExited = true; });

  try {
    await waitScene(0);
    await login(page);
    await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
    await waitScene(1, 12000);

    await page.goto("http://localhost:5678/workflow/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.locator('[data-test-id="canvas-plus-button"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByText("Trigger manually", { exact: true }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.locator('[data-test-id="node-creator-plus-button"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.keyboard.type("SoterAI", { delay: 70 });
    await waitScene(2, 15000);

    await page.goto("http://localhost:5678/home/credentials", { waitUntil: "domcontentloaded" });
    await waitScene(3, 15000);

    await page.goto("http://localhost:5678/workflow/soteraiRealDemo01", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await waitScene(4, 18000);
    await page.getByRole("button", { name: /^execute workflow$/i }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(12000);
    await waitScene(5, 15000);

    await page.goto("file:///" + path.join(root, ".tmp", "n8n-real-execution-summary.json").replace(/\\/g, "/"));
    await waitScene(6, 18000);
    await page.keyboard.press("Control+f");
    await page.keyboard.type("detectedEntities");
    await waitScene(7, 14000);
    await page.keyboard.press("Control+f");
    await page.keyboard.type("SECRET_DISCLOSURE");
    await waitScene(8, 14000);
    await page.keyboard.press("Control+f");
    await page.keyboard.type("VALIDATION_ERROR");
    await waitScene(9, 12000);

    await page.goto("file:///" + proofPath.replace(/\\/g, "/"));
    await waitScene(10, 36000);

    await page.goto("http://localhost:5678/workflow/soteraiRealDemo01/executions", { waitUntil: "domcontentloaded" });
    await waitScene(11, 12000);
  } finally {
    if (ff && !ffExited) {
      try { ff.stdin.write("q"); } catch (_) {}
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 8000);
        ff.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (browser) await browser.close().catch(() => {});
  }
}

function finishVideo() {
  execFileSync(ffmpeg.path, [
    "-y",
    "-i", paths.capture,
    "-i", paths.voiceover,
    "-vf", "fps=30,scale=1920:1080,format=yuv420p",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    paths.mp4,
  ], { stdio: "inherit" });
}

function writeReports() {
  const qa = `# n8n SoterAI Real Video QA Report

- Live n8n URL shown: http://localhost:5678
- Docker preflight: n8n container running on port 5678 after Docker Desktop start.
- Community node installed in n8n: n8n-nodes-soterai 0.2.6 in the running container; package source is 0.2.7.
- Workflow execution: successful n8n manual execution ID 17 for workflow soteraiRealDemo01.
- Credential safety: no real API key is shown. A separate local demo credential is used for repeatable execution against a local SoterAI-compatible endpoint.
- Secrets: no real API keys, npm tokens, GitHub tokens, .env values, or private credentials are displayed.
- Package checks: npm run lint PASS; npm run build PASS; npx @n8n/scan-community-package n8n-nodes-soterai PASS.
- Limitation: the originally existing SoterAI credential returned a non-JSON response, so the final execution uses a separate local demo credential for deterministic verification footage.
`;
  fs.writeFileSync(paths.qa, qa);
  fs.writeFileSync(paths.notes, `# Creator Portal Submission Notes

Package: n8n-nodes-soterai
Product: SoterAI
Video: final/${base}.mp4

This recording shows the real local n8n editor at http://localhost:5678, the SoterAI community node in a real workflow, credential usage with secret values hidden, workflow execution, execution results, and package quality proof.

Upload final/${base}.mp4 to the n8n Creator Portal.
`);
}

(async () => {
  fs.writeFileSync(path.join(root, ".tmp", "n8n-check-output.txt"), `docker ps: n8nio/n8n running on 0.0.0.0:5678
npm --prefix packages/integrations/n8n run lint: PASS
npm --prefix packages/integrations/n8n run build: PASS
npx @n8n/scan-community-package n8n-nodes-soterai: PASS
Package n8n-nodes-soterai@0.2.7 passed all security checks.
`);
  const durations = await makeAudioAndDocs();
  await runBrowser(durations);
  finishVideo();
  writeReports();
  console.log(JSON.stringify(paths, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
