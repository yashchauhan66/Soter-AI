/**
 * Full-strength 90-sec product tour — DRAFT slideshow cut.
 *
 * Real-asset DRAFT only: shipped README GIF (real playground session) +
 * shipped IDE screenshots (secret-scan-result, control-panel). n8n canvas,
 * MCP terminal, API terminal are TITLE SLATES in this draft — swap with
 * fresh 1080p30 REAL recordings per 26-FULLSTRENGTH doc section 5.
 * No AI video, no TTS in repo. No benchmark percent burned (stale policy).
 *
 * Usage: node scripts/marketing/build-ph-video-fullstrength.mjs
 * Output: marketing/ph-assets/fullstrength-90sec-DRAFT.mp4 (+ .json)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const run = (bin, args) => execFileSync(bin, args, { stdio: "inherit" });

const SHOTS = join(root, "public/marketplace/screenshots");
const GIF = join(SHOTS, "soterai-secret-caught-before-ai.gif");
const IDE_SCAN = join(SHOTS, "secret-scan-result.png");
const IDE_PANEL = join(SHOTS, "control-panel-protection.png");
const LOGO = join(root, "public/logo.png");
const OUT_DIR = join(root, "marketing/ph-assets");
const OUT = join(OUT_DIR, "fullstrength-90sec-DRAFT.mp4");
const TMP = join(root, ".tmp/ph-video-full");
for (const p of [OUT_DIR, TMP]) mkdirSync(p, { recursive: true });

for (const [p, label] of [[GIF, "demo GIF"], [IDE_SCAN, "ide scan shot"], [IDE_PANEL, "ide panel shot"], [LOGO, "logo"]]) {
  if (!existsSync(p)) {
    console.error(`missing ${label}: ${p}`);
    process.exit(1);
  }
}

// 90s timeline per 26-FULLSTRENGTH-90SEC-VIDEO.md section 3:
// b1 hook 6s | b2 problem 8s | b3 IDE 16s | b4 n8n 14s | b5 MCP 12s
// b6 API 10s | b7 gap 10s | b8 honest 6s | b9 CTA 8s = 90s
const W = 1920, H = 1080, FPS = 30;

// drawtext values go through ffmpeg filtergraph parsing, where : , ' % are
// separators. Quoted Windows font path + escaped free text + ASCII captions.
const FONT = "'C\\:/Windows/Fonts/arial.ttf'";
const esc = (s) =>
  s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/'/g, "\\'").replace(/%/g, "\\%");
const dt = (text, size, color, x, y) =>
  `drawtext=fontfile=${FONT}:text='${esc(text)}':fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;
const slate = (text, sub, out, dur) => {
  run("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=0x0B1220:s=${W}x${H}:d=${dur}:r=${FPS}`,
    "-vf",
    dt(text, 84, "white", "(w-text_w)/2", "(h-text_h)/2-40") + "," +
    dt(sub, 44, "0x8B949E", "(w-text_w)/2", "(h-text_h)/2+70"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), out]);
};

// Ken Burns REMOVED — zoompan at 2560px blew the 30s tool window.
// Fast still: scale+crop+fps only. Motion comes from real clips in final.
const still = (img, out, dur) => {
  run("ffmpeg", ["-y", "-loop", "1", "-i", img,
    "-vf", `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=${FPS}`,
    "-frames:v", String(dur * FPS), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", String(FPS), out]);
};

slate("Three doors", "One guard", join(TMP, "b1.mp4"), 6);
slate("Prompt theft - PII leak", "Rogue agent - unsupervised", join(TMP, "b2.mp4"), 8);

// Beat 3 IDE REAL: shipped secret-scan-result screenshot, lower-third + Beta.
still(IDE_SCAN, join(TMP, "b3raw.mp4"), 16);
run("ffmpeg", ["-y", "-i", join(TMP, "b3raw.mp4"), "-vf",
  `drawbox=y=ih-140:w=iw:h=140:color=black@0.65:t=fill,` +
  dt("REAL SCREENSHOT - synthetic test key", 40, "white", "(w-text_w)/2", "h-110") + "," +
  dt("IDE Guard Beta - local, no account", 36, "0x3FB950", "(w-text_w)/2", "h-60"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an", join(TMP, "b3.mp4")]);

// Beats 4-6 DRAFT slates — swap with REAL n8n/MCP/API recordings in final.
slate("n8n Guard Beta", "DRAFT - real canvas in final", join(TMP, "b4.mp4"), 14);
slate("MCP Gateway Labs", "DRAFT - real terminal in final", join(TMP, "b5.mp4"), 12);
slate("REST API Stable", "DRAFT - real curl in final", join(TMP, "b6.mp4"), 10);

slate("Offline - IDE-native", "India-first PII", join(TMP, "b7.mp4"), 10);
slate("Stable - Beta - Labs", "Labelled, not hidden", join(TMP, "b8.mp4"), 6);

// Beat 9 end card: control-panel screenshot flash + logo + CTA, 8s.
still(IDE_PANEL, join(TMP, "b9raw.mp4"), 8);
run("ffmpeg", ["-y", "-i", join(TMP, "b9raw.mp4"),
  "-filter_complex",
  `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,` +
  dt("soterai.in/playground", 72, "white", "(w-text_w)/2", "h-300") + "," +
  dt("no signup - try to break it", 44, "0x3FB950", "(w-text_w)/2", "h-210") + "[vout]",
  "-map", "[vout]",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), "-t", "8", join(TMP, "b9.mp4")]);

// Silent bed (VO mixed in final; draft stays honest, no fake VO).
run("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=90",
  "-c:a", "aac", join(TMP, "silent.m4a")]);

// Concat b1-b9.
const list = ["b1.mp4", "b2.mp4", "b3.mp4", "b4.mp4", "b5.mp4", "b6.mp4", "b7.mp4", "b8.mp4", "b9.mp4"]
  .map((f) => `file '${join(TMP, f).replace(/\\/g, "/")}'`).join("\n");
writeFileSync(join(TMP, "list.txt"), list);
run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", join(TMP, "list.txt"),
  "-i", join(TMP, "silent.m4a"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", OUT]);

const st = statSync(OUT);
const manifest = {
  file: "marketing/ph-assets/fullstrength-90sec-DRAFT.mp4",
  kind: "DRAFT 90s tour — NOT the launch video",
  duration_s: 90, size: "1920x1080", fps: 30, bytes: st.size,
  real_assets: ["ide secret-scan-result.png (shipped)", "ide control-panel-protection.png (shipped)"],
  draft_slates_swap_in_final: ["n8n canvas 0:30-0:44", "MCP terminal 0:44-0:56", "API curl 0:56-1:06", "AI b-roll 0:00-0:14 + 1:06-1:16"],
  missing_for_final: ["English VO stem (doc 26 P0)", "4 fresh REAL clips (doc 26 section 5)", "AI b-roll"],
  numbers_policy: "no benchmark percent burned in (run 2026-07-22 stale per playbook B3)",
  status_policy: "Stable/Beta/Labs chips in beat 8, lower-thirds carry status",
  generated_at: new Date().toISOString(),
};
writeFileSync(OUT + ".json", JSON.stringify(manifest, null, 2));
console.log(`DRAFT built: ${OUT} (${(st.size / 1024 / 1024).toFixed(2)} MB) — swap slates per doc 26`);

