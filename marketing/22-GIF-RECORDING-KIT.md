# 22 — GIF Recording Kit: "Your Secret, Caught Before AI Sees It"

**Created:** 2026-09-12 | **Goal:** ONE 30-second GIF that makes a developer install the extension
**Verified fixture:** `scripts/test/gif-demo-fixture.js` — every value is confirmed to trigger the real detector engine (7/7 PASS via `node --import tsx scripts/test/verify-gif-demo-values.cjs`). **No value is real.**

> **AUTOMATED (2026-09-12, replaces the manual ScreenToGif flow below):** `node scripts/marketing/generate-readme-gif.mjs` drives the REAL playground with Playwright + ffmpeg — no human recording. Take #4 shipped: **960×540 @ 12fps, 18.7s, 2.87 MB** (under the < 3 MB marketplace budget), real-engine BLOCK verdict asserted in-script. Revised spec is 960×540@12fps (not 1280×720@15fps — that combo measured 7.6 MB and cannot fit the budget; 960px is effectively native since the marketplace README renders ~950px wide). Outputs: `public/marketplace/screenshots/soterai-secret-caught-before-ai.gif` (+ `.json` manifest) and `packages/vscode-extension/media/marketplace/` fallback copy. Embed: `![SoterAI catches a secret before it reaches AI](https://soterai.in/marketplace/screenshots/soterai-secret-caught-before-ai.gif)`. Keep this file as the manual backup; prefer the script.

> **Yeh kit kyun kaam karti hai:** GIF jo "extension installed hone ke baad kya hota hai" dikhata hai wo README/marketplace pe click-through 2-3x badhata hai. Lekin sirf woh GIF valuable hai jisme (1) real danger visible ho, (2) fix ek click me ho, (3) 30 sec me complete ho. Yeh storyboard exactly wahi 3 cheezein enforce karta hai.

---

## ⚙️ EXACT RECORDING SETUP (5 min, ek baar)

### VS Code me recording environment

| Setting                | Value                                                     | Why                                                           |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Editor zoom            | `Ctrl+=` 2-3 baar (font 16-18px)                          | Marketplace renders GIF small; normal font unreadable         |
| Theme                  | **Light+** (default light)                                | Brand is light; dark GIF off-brand lagta hai                  |
| Editor font            | JetBrains Mono (already bundled)                          | Terminal/code contrast clean                                  |
| Hide status bar extras | `View → Appearance → hide Activity Bar` to side rail only | Screen noise kam                                              |
| Window size            | 1280×720 (16:9)                                           | Marketplace GIF max width ~950px; 720p ideal                  |
| Recording FPS          | **15 fps**                                                | 30 fps file 2x heavy hota hai, marketplace compress karta hai |
| Recording length       | ≤ 35 seconds                                              | Marketplace GIF loops — chhota = zyada views per loop         |

### Tool (Windows, free, no watermark)

**ScreenToGif** (screentogif.com) — installer ya portable:

1. Recorder → drag the frame to cover the editor area only (not your taskbar/desktop)
2. FPS: 15 | Size: keep 1280×720 or crop to editor
3. Record → Stop → Edit (cut dead air) → Save as **GIF**
4. Save preset: "GIF" | Colors: 256 | Dithering: on (best text quality/size tradeoff)
5. Target size: **< 3 MB** (Marketplace README images render slow if bigger)

Alternative: ShareX (ScreenToGif engine built-in) — `Capture → Screen recording (GIF)`.

---

## 🎬 THE 30-SECOND STORYBOARD (shot-by-shot)

| Time   | On screen                                                               | Action                                                                                        | Viewer feels                             |
| ------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 0-4s   | Empty VS Code, SoterAI shield in sidebar visible                        | Open `gif-demo-fixture.js`                                                                    | Setup context                            |
| 4-12s  | The file on screen with fake AWS key, GitHub token, DB URL              | **Paste the PROMPT_TO_SEND block** — inline diagnostics (red squiggles) pop as text lands     | "Oh s*—ye mere code me bhi ho sakta hai" |
| 12-20s | Problems panel + editor squiggles                                       | Select the prompt text → right-click → **SoterAI: Check Before Sending to AI** (Ctrl+Alt+S)   | "Ye kaise pakda?"                        |
| 20-28s | Verdict webview: ALLOW/REDACT/BLOCK + risk score + redacted copy button | Hover/click the **redacted copy** — the AWS key becomes `soterai://secret/...` or `AKIA…****` | "One click. Done."                       |
| 28-30s | Bottom-right status bar / SoterAI badge                                 | Hold 2s on the green "protected" state                                                        | Trust + loop point                       |

**Golden rule:** Har shot me mouse movement minimal — GIF me mouse chaos = viewer drops.

### Backup take (agar pehla 30 sec me na aaye): "Redact Selection for AI"

Same fixture, but the ending shot is: select the whole prompt → `SoterAI: Redact Selection for AI` → clipboard now has a SAFE version → paste it into a "ChatGPT window" (any browser) — AI receives `[REDACTED]` values. Ye version "fear → fix" arc even more clearly dikhata hai.

### Post-recording checklist (ScreenToGif editor me)

- [ ] First 2 frames me dead air remove kiya (start on file-open action)
- [ ] Squiggle wala frame ≥ 3 sec hold (viewer ko register hone do)
- [ ] Final "protected" frame ≥ 2 sec (loop point)
- [ ] < 3 MB | ≤ 35 sec | 15 fps | 1280×720
- [ ] Filename: `soterai-secret-caught-before-ai.gif`
- [ ] Host at `https://soterai.in/marketplace/screenshots/soterai-secret-caught-before-ai.gif` (same pattern as existing screenshots) — then embed in README above the Features section with alt text: `![SoterAI catches a secret before it reaches AI](url)`

---

## 📤 WHERE TO USE THIS ONE GIF (priority order)

1. **VS Code Marketplace README** — install table ke theek neeche, "See it in action" section me. Ye #1 surface hai jahan buyer decision hota hai.
2. **Open VSX listing** — same README renders there.
3. **Reddit r/vscode post** — post body me GIF link (Reddit external GIF links embed hota hai via preview).
4. **Twitter/X launch thread** — first reply me GIF (main tweet me nahi, reply me better engagement).
5. `app/extensions/ide/page.tsx` — website install page pe demo section me.

> ⚠️ **extension.test.ts constraint:** README me abhi 4 required screenshot URLs hain (`extension.test.ts` test "shows verified VS Code evidence screenshots" in README). Naya GIF add karne ke liye GIF ka URL bhi `https://soterai.in/marketplace/screenshots/...` hona chahiye aur file `media/marketplace/` me honi chahiye — warna test fail. GIF record karne ke baad mujhe bolo, main test me add kar dunga.

---

## ✅ DO IT NOW (15 minutes total)

1. [ ] ScreenToGif install (2 min)
2. [ ] VS Code open → repo folder kholo → `scripts/test/gif-demo-fixture.js` kholo (2 min)
3. [ ] Fixture values replace: `node --import tsx scripts/test/verify-gif-demo-values.cjs` — 7/7 PASS confirm (1 min)
4. [ ] Ctrl+= zoom in (font ~16-18px) (30 sec)
5. [ ] ScreenToGif: 1280×720, 15fps, editor area frame (1 min)
6. [ ] Record storyboard (30 sec) — 2-3 takes me perfect aa jayega
7. [ ] Edit: trim start/end, keep squiggle ≥3s, protected ≥2s (5 min)
8. [ ] Export GIF < 3 MB → upload `public/marketplace/screenshots/` → deploy → README + Reddit me use karo
