/**
 * Hardcoded-colour audit.
 *
 * The light theme is delivered by mirroring the Tailwind ramps rather than by
 * editing ~5,200 call sites (see the header of tailwind.config.ts). That works
 * because a class like `text-slate-300` is *indirect*: it resolves through the
 * theme, so one config change moved every one of them at once.
 *
 * The failure mode is a call site that bypasses the theme. `bg-[#0b1420]`,
 * `style={{ color: "#00c8c8" }}`, and `rgba(49,215,200,.15)` are literals — no
 * config change can reach them, so they silently keep the *old* theme and the page
 * ends up half-converted. Six pages did exactly this before the conversion and
 * still rendered near-black on a white site.
 *
 * This audit is the countdown that keeps them from coming back. It reports every
 * literal colour in `app/` and `components/`, with the two legitimate exceptions
 * carved out explicitly.
 *
 * Usage: node scripts/audit-hardcoded-colors.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components"];

/**
 * Files where inline literals are unavoidable, not sloppiness.
 *
 * - **`lib/`** holds the two allowlisted sources of truth: `lib/brand.ts` (for
 *   email, the embeddable badge, and PDF output) and `lib/og/theme.ts` (for
 *   Satori). Everything else imports from them.
 * - **`next/og` cards** render in Satori, which never loads the stylesheet: no
 *   Tailwind, no CSS variables.
 * - **Browser-chrome metadata** (`app/layout.tsx` `themeColor`, `app/manifest.ts`)
 *   is read by the OS and the browser UI, not the page.
 * - **`app/badge.js`** executes on a customer's site, where our CSS is absent.
 *
 * `components/ui/Chart.tsx` is deliberately *not* here: it imports its two SVG
 * stroke colours from `lib/brand.ts` like everything else.
 */
const ALLOWED = [
  /^lib\//,
  /opengraph-image\.tsx$/,
  /twitter-image\.tsx$/,
  /icon\.tsx$/,
  // Root layout `themeColor` and the PWA manifest are consumed by the *browser
  // chrome*, not the page, so they cannot read the stylesheet. Both are commented
  // to say they track `--surface-0`.
  /^app\/layout\.tsx$/,
  /^app\/manifest\.ts$/,
  // Embeddable badge: runs on a customer's page where our CSS does not exist.
  // It imports from lib/brand.ts; the one remaining literal is a shadow alpha.
  /^app\/badge\.js\/route\.ts$/,
];

/**
 * Patterns that indicate a colour is being written outside the theme.
 *
 * `#fff` inside a `-webkit-mask` is excluded at the call site below: mask
 * gradients use white as an *alpha channel*, not as a colour, so flagging them
 * would train readers to ignore this script — the fastest way to make an audit
 * worthless.
 */
const PATTERNS = [
  { name: "arbitrary Tailwind colour", re: /(?:bg|text|border|ring|fill|stroke|shadow|from|to|via|divide|outline|decoration|accent|caret|placeholder)-\[#[0-9a-fA-F]{3,8}\]/g },
  { name: "hex literal", re: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g },
  { name: "rgb()/rgba() literal", re: /\brgba?\(\s*\d/g },
  { name: "hsl() literal", re: /\bhsla?\(\s*\d/g },
];

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Blank comments while preserving line numbers, so documented values don't trip this. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (line, prefix) => prefix + " ".repeat(line.length - prefix.length));
}

const findings = [];

for (const root of ROOTS) {
  for (const file of collect(root)) {
    const rel = relative(process.cwd(), file).replaceAll("\\", "/");
    if (ALLOWED.some((allowed) => allowed.test(rel))) continue;

    const lines = stripComments(readFileSync(file, "utf8")).split(/\r?\n/);
    lines.forEach((line, index) => {
      // Mask gradients use #fff / #000 as an alpha ramp, not as a colour.
      if (/-?webkit-mask|\bmask-image|\bmask:/.test(line)) return;

      for (const { name, re } of PATTERNS) {
        for (const match of line.matchAll(re)) {
          findings.push({ file: rel, line: index + 1, name, value: match[0] });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log("No hardcoded colours outside the theme.");
} else {
  const byFile = new Map();
  for (const f of findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);

  console.log(`${findings.length} hardcoded colour(s) across ${byFile.size} file(s):\n`);
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.value}  (${f.name})`);

  console.log("\nThese bypass the theme, so a palette change cannot reach them.");
  console.log("Use a token: text-slate-*/bg-slate-*/text-cyan, or rgb(var(--brand)) in CSS.");
  console.log("Genuine exceptions (next/og, SVG attributes) belong in ALLOWED here.");
  process.exitCode = 1;
}
