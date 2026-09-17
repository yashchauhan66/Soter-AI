/**
 * PH 30-sec launch video — DRAFT slideshow cut (no AI video, no TTS in repo).
 *
 * Builds a 30s 1920x1080/30fps MP4 from REAL repo assets only:
 *  - the shipped README demo GIF (real playground session, 18.7s)
 *  - the repo logo (end card)
 *  - ffmpeg-generated title slates with burned captions (muted-safe for PH)
 *
 * What this is NOT: not the final launch video. The final needs:
 *  1. English VO stem (ElevenLabs, P0 in 23-PH-30SEC-LAUNCH-VIDEO.md) mixed in,
 *  2. a fresh 1080p30 playground re-record for beat 3 (GIF is 12fps),
 *  3. AI b-roll for beats 1-2/5 (Runway/Pika) or CapCut stock.
 * Swap those in per the pack doc; timeline positions below already match §1 beats.
 *
 * Usage: node scripts/marketing/build-ph-video-draft.mjs
 * Output: marketing/ph-assets/ph-launch-30sec-DRAFT.mp4 (+ .json manifest)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const run = (bin, args) => execFileSync(bin, args, { stdio: "inherit" });

const GIF = join(root, "public/marketplace/screenshots/soterai-secret-caught-before-ai.gif");
const LOGO = join(root, "public/logo.png");
const OUT_DIR = join(root, "marketing/ph-assets");
const OUT = join(OUT_DIR, "ph-launch-30sec-DRAFT.mp4");
const TMP = join(root, ".tmp/ph-video");
for (const p of [OUT_DIR, TMP]) mkdirSync(p, { recursive: true });

for (const [p, label] of [[GIF, "demo GIF"], [LOGO, "logo"]]) {
  if (!existsSync(p)) {
    console.error(`missing ${label}: ${p}`);
    process.exit(1);
  }
}

// 30s timeline per 23-PH-30SEC-LAUNCH-VIDEO.md §1:
// beat1 hook 0-3 | beat2 problem 3-8 | beat3 REAL demo 8-18 | beat4 coverage 18-23 | beat5 local 23-27 | beat6 CTA 27-30
const W = 1920, H = 1080, FPS = 30;
// drawtext values go through ffmpeg's filtergraph parser, where : , ' % are
// separators — on Windows the font path itself contains a colon, so every
// free-text value must be escaped and captions stay strict ASCII (no em-dash,
// no timestamps; those were production notes, not on-screen copy).
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

slate("Your chatbot trusts", "everything it reads.", join(TMP, "b1.mp4"), 3);
slate("One line can leak", "your prompt. Or your keys.", join(TMP, "b2.mp4"), 5);
slate("Prompts - Outputs", "Agent actions - one layer", join(TMP, "b4.mp4"), 5);
slate("Self-host - Offline", "India-first PII detection", join(TMP, "b5.mp4"), 4);

// Beat 3: REAL demo GIF → 10s 1080p segment, center-cropped canvas + burned lower-third.
run("ffmpeg", ["-y", "-i", GIF,
  "-vf",
  `fps=${FPS},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,` +
  `trim=duration=10,` +
  `drawbox=y=ih-140:w=iw:h=140:color=black@0.65:t=fill,` +
  dt("REAL RECORDING - synthetic test input", 40, "white", "(w-text_w)/2", "h-110") + "," +
  dt("BLOCKED - reason on screen", 36, "0xFF7B72", "(w-text_w)/2", "h-60") + "," +
  "setpts=PTS-STARTPTS",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an", join(TMP, "b3.mp4")]);

// Beat 6: end card — logo on brand navy + CTA, 3s. Two inputs need
// -filter_complex with an explicit [vout] map (plain -vf only fits one input).
run("ffmpeg", ["-y", "-loop", "1", "-i", LOGO,
  "-filter_complex",
  `color=c=0x0B1220:s=${W}x${H}:d=3:r=${FPS}[bg];[0:v]scale=420:-1,format=rgba[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-120,` +
  dt("soterai.in/playground", 72, "white", "(w-text_w)/2", "h-300") + "," +
  dt("no signup - try to break it", 44, "0x3FB950", "(w-text_w)/2", "h-210") + "[vout]",
  "-map", "[vout]",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), "-t", "3", join(TMP, "b6.mp4")]);

// Silent bed (VO gets mixed here in the final; draft stays honest: no fake VO).
run("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=30",
  "-c:a", "aac", join(TMP, "silent.m4a")]);

// Concat: b1 b2 b3 b4 b5 b6.
const list = ["b1.mp4", "b2.mp4", "b3.mp4", "b4.mp4", "b5.mp4", "b6.mp4"]
  .map((f) => `file '${join(TMP, f).replace(/\\/g, "/")}'`).join("\n");
writeFileSync(join(TMP, "list.txt"), list);
run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", join(TMP, "list.txt"),
  "-i", join(TMP, "silent.m4a"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", OUT]);

const st = statSync(OUT);
const manifest = {
  file: "marketing/ph-assets/ph-launch-30sec-DRAFT.mp4",
  kind: "DRAFT slideshow — NOT the launch video",
  duration_s: 30, size: "1920x1080", fps: 30, bytes: st.size,
  real_demo_beat: "0:08-0:18 from public/marketplace/screenshots/soterai-secret-caught-before-ai.gif (real session)",
  missing_for_final: ["English VO stem (ElevenLabs P0)", "1080p30 playground re-record", "AI b-roll beats 1-2/5"],
  numbers_policy: "no benchmark % burned in (run 2026-07-22 stale per playbook B3)",
  generated_at: new Date().toISOString(),
};
writeFileSync(OUT + ".json", JSON.stringify(manifest, null, 2));
console.log(`DRAFT built: ${OUT} (${(st.size / 1024 / 1024).toFixed(2)} MB) — add VO + b-roll per 23-PH-30SEC-LAUNCH-VIDEO.md`);
