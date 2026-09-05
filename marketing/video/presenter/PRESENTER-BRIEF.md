# Presenter brief — the human face in the SoterAI product video

`scripts/marketing/generate-video.mjs` renders a complete, narrated video with no
human in it. This file is how a human gets in.

Two things in that video are synthetic by default, and each has a separate
override, because they fail in different ways:

| Layer | Default | Override | Why it is not synthesised for you |
|-------|---------|----------|-----------------------------------|
| Face | absent — slides only | `--presenter <clip>` | An avatar of a founder who never said these words is a trust claim the generator has no right to make on its own. |
| Voice | `edge-tts` neural (`hi-IN-MadhurNeural` / `en-IN-PrabhatNeural`) | `--vo-dir <dir>` | A synthetic voice is fine and labelled. A synthetic voice *presented as* the founder's is not. |

Neither override changes a single word of copy. The script, the on-screen text
and every benchmark number stay generated from
`benchmarks/results/latest.json` and the newest `readme-detection-audit-*.txt`.
You are supplying performance, not claims.

---

## 1. What the render does with your clip

The presenter pass is deliberately the **last** pass: slides and narration are
already encoded, so a new take costs one short ffmpeg run, not a full re-render.

- The clip is scaled to fill the frame box, centre-cropped, given a 4px brand
  border (`#31d7c8` at 85%), and overlaid only during the scenes flagged
  `presenter: true`.
- It is looped (`-stream_loop -1`). **It does not need to be as long as the
  video** — it needs to cover the longest single presenter window.
- **Its audio is discarded.** The soundtrack is the narration track only.

Frame geometry, from `LAYOUTS` in the generator — do not guess these, they are
what the compositor uses:

| Cut | Canvas | Presenter box | Position (x, y) | Effect on the slide |
|-----|--------|---------------|-----------------|---------------------|
| 16:9 landscape | 1920×1080 | 372×496 (0.75:1) | 1428, 352 | body column narrows 1680 → 1236px |
| 9:16 portrait | 1080×1920 | 312×380 (0.82:1) | 384, 1136 | body must end by y=1104 |
| 1:1 square | 1080×1080 | letterboxed from the 16:9 master | — | inherits the landscape PiP |

Both boxes are near-square and portrait-ish. Frame yourself for a **square
crop**: head and shoulders, eyes on the upper third, and do not rely on anything
at the left or right edge of your shot surviving.

The vertical cut is the one to check first. There the presenter sits in the
middle of the frame, between the body content and the caption plate, and the
generator *shortens the slide* to make room — if a scene's content cannot fit
above y=1104 the render fails with a layout overflow rather than drawing you over
the text. That failure is the feature. If it fires, cut a word from the scene in
`buildScenes()`, do not move the box.

### What "shortens the slide" actually means

A presenter costs the landscape column 372px of width and the portrait body 404px
of height. Rather than fail on every presenter render, a scene body that does not
fit at its design sizes is re-composed once in a **compact** pass: verdict-row
input type steps 30 → 28 → 26px (portrait 28 → 26 → 24px) until the rows need the
fewest lines they can, and metric-tile captions step 22 → 20 → 18px until the
qualifier fits inside the tile. Only then, if it still overflows, does the render
stop.

Two rules hold through compaction, and both are enforced rather than trusted:

- **No row and no caption is ever dropped.** Caption overflow is a build failure,
  not a silent truncation — those captions carry the qualifiers (`never tuned
  against`, `0/322 benign controls`) that make the numbers honest.
- **Slides that already fit are untouched.** Compaction only runs for a body that
  overflowed, so the no-presenter frames render exactly as they do today.

So a presenter render legitimately shows slightly smaller body type than the
no-presenter render of the same scene. That is the trade the geometry forces; it
is not a rendering bug.

---

## 2. Which scenes you are in

Presenter windows are the scenes flagged `presenter: true`: **`hook`,
`surfaces`, `honesty`, `cta`**. The short cut contains three of them
(`surfaces` is full-cut only).

| Cut | On-camera scenes | Approx. on-camera time |
|-----|------------------|------------------------|
| short (~1:00) | `hook`, `honesty`, `cta` | ~32s of 60s |
| full (~3:45) | `hook`, `surfaces`, `honesty`, `cta` | ~75s |

The pattern is intentional: you open, you appear for the one honest claim about
the benchmark, and you close. The three middle scenes — the actual product
demonstrations — have no face on them, because the verdict pill is the thing the
viewer needs to read there.

Exact in/out timecodes and the exact lines are in the generated shooting script,
never here:

- `marketing/video/SCRIPT-short-hi.md`, `SCRIPT-full-hi.md`
- `marketing/video/SCRIPT-short-en.md`, `SCRIPT-full-en.md`
- machine-readable: `marketing/video/manifest-<cut>-<lang>.json` → `scenes[].presenter`, `.start`, `.end`, `.narration`

Those files are regenerated on every run. **Do not copy narration into this
brief** — a line that lives in two places is a line that will disagree with the
benchmark one day.

---

## 3. Lip-sync: read this before you record yourself talking

The presenter overlay is **not lip-synced**, and it cannot be with a single
looped clip: the voice track is per-scene narration, the video is one clip
repeated across the windows. Pick one of these three, honestly:

**Route A — B-roll presence (works today, no sync problem).**
A silent clip of you at the desk: slight movement, occasional nod, looking at the
screen or just past the camera. Mouth closed or barely moving. This reads as
"the person who built this is here" and never looks dubbed. Cheapest, and it is
what the current pipeline is designed around.

**Route B — recorded voice + matching B-roll (the honest "real human" version).**
Record the audio properly, one file per scene, and let the human voice replace
the neural one:

```
marketing/video/voice/hook.wav
marketing/video/voice/honesty.wav
marketing/video/voice/cta.wav
...one per scene id you want in your own voice
```

```bash
node scripts/marketing/generate-video.mjs --cut short --crops \
  --vo-dir marketing/video/voice \
  --presenter marketing/video/presenter/presenter.mp4
```

Any scene without a file falls back to the neural voice, the render prints
exactly which ones did, and `manifest-<cut>-<lang>.json` records
`voiceSource: "recorded" | "mixed" | "tts"`. A recorded take also *drives* its
scene length — the slide holds as long as you speak, so nothing gets clipped and
you do not have to hit a stopwatch target. Combine with Route A framing (no
visible speech) and the result is a real human voice with no sync artefact.

**Route C — true talking head.** Requires per-scene presenter clips composited
before the concat, which this generator does not do yet. Do not fake it by
recording yourself speaking and overlaying it on TTS: the mismatch is obvious,
and on a product whose entire pitch is "we publish the number that makes us look
bad", a dubbed founder is an own goal.

### If you use an avatar tool instead

HeyGen / Synthesia / Argil are fine, with one rule: the avatar must not be
presented as a real person who said these words. Either use a visibly
stylised/labelled avatar, or use your own likeness with your own consent. Paste
the narration from `SCRIPT-*.md` verbatim — it is already claim-checked. Export
9:16 or 1:1, keep the head small in frame (the box is 372–420px wide), and
prefer a solid background you can key.

---

## 4. Recording spec

| Setting | Target | Why |
|---------|--------|-----|
| Resolution | 1080p or better | it is downscaled to ≤420px wide; more pixels means a clean crop |
| Frame rate | 30fps | matches the render; 60fps is fine, it gets resampled |
| Orientation | portrait or square | the box is 0.75:1 and 0.81:1 |
| Length | ≥ 20s, loop-safe | it repeats; start and end in a similar pose so the loop point is not a jump cut |
| Background | dark, plain, or solid green | the slide is `#05080f` near-black; a bright kitchen wall fights it |
| Lighting | soft key from the front, slight side | the palette is dark and cool; hard yellow ceiling light looks pasted on |
| Wardrobe | plain dark or mid-tone, no fine stripes | small in frame + x264 = moiré on patterns |
| Audio | record it anyway | discarded by the PiP, but it is your Route B source |

Framing: eyes on the upper third, shoulders visible, ~10% headroom. Anything
below your collarbone is cropped away in the 372×496 box.

### Chroma key

Only pass `--presenter-chroma` if you actually shot on a green/blue screen.
The filter is `colorkey=<hex>:0.32:0.12`, which is a moderate tolerance — good
for even lighting, unforgiving of a shadowed or wrinkled screen.

```bash
# either spelling works; #RRGGBB is normalised to 0xRRGGBB
node scripts/marketing/generate-video.mjs --cut short --crops \
  --presenter marketing/video/presenter/presenter.mp4 \
  --presenter-chroma "#00b140"
```

Sample your actual screen colour from a still — do not use a nominal value.
`00b140` is standard digital green; `0057b7` is typical blue. If you see a green
fringe, light the screen more evenly and re-shoot: raising the tolerance eats
into skin tones, and there is no despill stage in this pipeline.

Shot against a dark wall, skip the flag entirely. The 4px brand border makes a

---

## 5. What the presenter may not say

The generated narration is already inside these rules. If you improvise, you are
outside them, and the claim gate in `tests/marketing-video-claims.test.ts` only
sees the manifest — it cannot police an ad-lib in a recorded take. The rules
come from `lib/marketing/launchStatus.ts` and
`marketing/13-SEPTEMBER-2026-GROWTH-SPRINT.md`:

**Never, in any take:**

- "100% secure", "fully secure", "unbreakable", "guaranteed protection"
- "SOC 2 compliant" / "SOC 2 certified" (not held)
- "independently validated", "third-party audited", "externally benchmarked"
- "zero false positives" as a standing property
- any recall/latency number that is not the one currently in
  `benchmarks/results/latest.json`

**Always, whenever a number is spoken:**

- the blind held-out result next to the tuned aggregate — never the good one alone
- "self-maintained synthetic benchmark, not an independent audit"
- "synthetic test values" when identifiers are on screen

The `honesty` scene exists to say the unflattering number out loud, and it is a
presenter scene on purpose: a face delivering the weak number is the entire
credibility play. Do not soften it, do not add "but in practice it's much
better", and do not shorten it to fit a stopwatch — a recorded take stretches its
own scene.

---

## 6. Render commands

```bash
# 0. layout gate only — no network, no encoding, milliseconds
node scripts/marketing/generate-video.mjs --dry-run --crops

# 1. current state: slides + neural voice, no face
node scripts/marketing/generate-video.mjs --cut short --crops

# 2. add the face (16:9 + 9:16 + 1:1)
node scripts/marketing/generate-video.mjs --cut short --crops \
  --presenter marketing/video/presenter/presenter.mp4

# 3. add the face and your own voice
node scripts/marketing/generate-video.mjs --cut short --crops \
  --presenter marketing/video/presenter/presenter.mp4 \
  --vo-dir marketing/video/voice

# 4. the long cut, and the English variant
node scripts/marketing/generate-video.mjs --crops --presenter marketing/video/presenter/presenter.mp4
node scripts/marketing/generate-video.mjs --lang en --crops --presenter marketing/video/presenter/presenter.mp4

# 5. verify the claims that shipped
npm run test:marketing-video
```

A missing clip is not an error: the render says
`Presenter clip not found … rendering without the picture-in-picture` and
produces a complete video anyway. That is deliberate — the video must never be
blocked on a human being available.

`*.mp4` is gitignored repo-wide, so `presenter.mp4` stays local. Keep the master
take in your own storage; this folder is a drop point, not an archive.

---

## 7. Before you publish

- [ ] Watched on a phone, at arm's length, with the sound off — captions carry it
- [ ] Watched with sound on — the voice and the burned-in captions agree
- [ ] The 9:16 cut: the presenter box does not cover the verdict pill or the caption plate
- [ ] The 1:1 cut: nothing important lost to the letterbox
- [ ] Loop point of the presenter clip is not a visible jump
- [ ] `manifest-<cut>-<lang>.json` says `voiceSource: "recorded"` if you are claiming a human voice
- [ ] `npm run test:marketing-video` passes
- [ ] Logged in `marketing/07-metrics-tracker.md` under its asset name

hard-edged box read as deliberate rather than unfinished.
